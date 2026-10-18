<?php

namespace App\Console\Commands;

use App\Support\QrisInspector;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class QrislyDebug extends Command
{
    protected $signature = 'qrisly:debug
        {--generate : Buat 1 QR uji ke QRISLY (di Live Mode dikenai biaya sekitar Rp100)}
        {--amount=1000 : Nominal uji dalam rupiah, minimal 1000}
        {--status= : Cek status pembayaran berdasarkan history_id}';

    protected $description = 'Diagnosa konfigurasi QRISLY. Tidak pernah mencetak API key atau isi qris_string.';

    public function handle(): int
    {
        $baseUrl = rtrim((string) config('services.qrisly.base_url'), '/');
        $key = (string) config('services.qrisly.key');
        $qrisId = (int) config('services.qrisly.qris_id');
        $host = (string) parse_url($baseUrl, PHP_URL_HOST);
        $sandbox = str_contains($host, 'sandbox');

        $this->components->info('1. Konfigurasi (isi rahasia tidak ditampilkan)');
        $this->line('   Host         : '.($host !== '' ? $host : '(kosong)'));
        $this->line('   Mode host    : '.($sandbox ? 'SANDBOX (QR selalu dummy INVALID_DATA)' : 'LIVE'));
        $this->line('   API key      : '.($key !== '' ? 'terisi, '.strlen($key).' karakter' : '(KOSONG)'));
        $this->line('   qris_id      : '.($qrisId > 0 ? $qrisId : '(tidak valid)'));

        $problems = [];

        if (! str_starts_with($baseUrl, 'https://')) {
            $problems[] = 'QRISLY_BASE_URL harus diawali https://';
        }
        if ($key === '') {
            $problems[] = 'QRISLY_KEY kosong.';
        }
        if ($qrisId < 1) {
            $problems[] = 'QRISLY_QRIS_ID harus berupa angka positif.';
        }
        if ($sandbox) {
            $problems[] = 'Host masih SANDBOX. qris_id, API key, dan host harus dari mode yang sama. '
                .'Untuk Live pakai https://api.collaborator.komerce.id/user dan API key QRISLY milik mode Live.';
        }

        foreach ($problems as $problem) {
            $this->components->warn($problem);
        }

        if ($statusId = $this->option('status')) {
            return $this->checkStatus($baseUrl, $key, (string) $statusId);
        }

        if (! $this->option('generate')) {
            $this->newLine();
            $this->line('Tambahkan --generate untuk membuat 1 QR uji (berbiaya di Live Mode).');

            return $problems === [] ? self::SUCCESS : self::FAILURE;
        }

        if ($key === '' || $qrisId < 1 || $baseUrl === '') {
            $this->components->error('Perbaiki konfigurasi di atas dulu.');

            return self::FAILURE;
        }

        $amount = max(1000, (int) $this->option('amount'));

        if (! $this->confirm("Ini membuat QR SUNGGUHAN senilai Rp{$amount} (dapat dibayar, dikenai biaya). Lanjut?", false)) {
            return self::SUCCESS;
        }

        $this->components->info('2. Permintaan generate');

        try {
            $response = Http::baseUrl($baseUrl)
                ->withHeaders(['X-API-Key' => $key])
                ->acceptJson()->asJson()->timeout(10)
                ->post('/api/v1/qrisly/generate-qris', [
                    'qris_id' => $qrisId,
                    'amount' => $amount,
                    'unique_amount' => true,
                    'output_type' => 'string',
                ]);
        } catch (\Throwable $exception) {
            $this->components->error('Gagal terhubung: '.class_basename($exception).' - '.mb_substr($exception->getMessage(), 0, 200));

            return self::FAILURE;
        }

        $this->line('   HTTP status  : '.$response->status());
        $this->line('   Pesan        : '.($response->json('meta.message') ?? '-'));

        if (! $response->successful() || $response->json('meta.status') !== 'success') {
            $this->components->error('API menolak permintaan. Detail: '.mb_substr(json_encode($response->json('data') ?? $response->body()), 0, 300));

            return self::FAILURE;
        }

        $data = (array) $response->json('data');
        $qris = (string) ($data['qris_string'] ?? '');
        $final = isset($data['final_amount']) ? (int) $data['final_amount'] : null;

        $this->line('   history_id   : '.($data['history_id'] ?? '-'));
        $this->line('   Nominal awal : '.($data['original_amount'] ?? '-'));
        $this->line('   Nominal akhir: '.($final ?? '-').'  (inilah yang harus dibayar pembeli)');
        $this->line('   Status       : '.($data['payment_status'] ?? '-'));
        $this->line('   Kedaluwarsa  : '.($data['expiry_time'] ?? '-'));

        $this->components->info('3. Pemeriksaan qris_string (isi string tidak dicetak)');
        $report = QrisInspector::inspect($qris, $final);

        foreach ($report['checks'] as $check) {
            $this->line(sprintf('   [%s] %s%s', $check['pass'] ? ' OK ' : 'GAGAL', $check['label'], $check['detail'] !== '' ? '  ('.$check['detail'].')' : ''));
        }

        $this->newLine();

        if ($report['ok']) {
            $this->components->info('QR VALID. Langkah berikut: pindai dan bayar nominal akhir dari dompet digital LAIN, lalu cek status dengan:');
            $this->line('   php artisan qrisly:debug --status='.($data['history_id'] ?? 'HISTORY_ID'));

            return self::SUCCESS;
        }

        $this->components->error('QR TIDAK VALID. Jangan dipindai atau dibayar. Cek mode, API key, dan qris_id (lihat bagian 1).');

        return self::FAILURE;
    }

    private function checkStatus(string $baseUrl, string $key, string $historyId): int
    {
        if (! ctype_digit($historyId)) {
            $this->components->error('history_id harus berupa angka.');

            return self::FAILURE;
        }

        $this->components->info('Cek status history_id '.$historyId);

        try {
            // Path mengikuti dokumentasi QRISLY. Samakan dengan path di service pembayaran Anda jika berbeda.
            $response = Http::baseUrl($baseUrl)
                ->withHeaders(['X-API-Key' => $key])
                ->acceptJson()->timeout(10)
                ->get('/api/v1/qrisly/payment-status/'.$historyId);
        } catch (\Throwable $exception) {
            $this->components->error('Gagal terhubung: '.class_basename($exception));

            return self::FAILURE;
        }

        $this->line('   HTTP status  : '.$response->status());
        $this->line('   Pesan        : '.($response->json('meta.message') ?? '-'));
        $this->line('   Data         : '.mb_substr((string) json_encode($response->json('data')), 0, 400));

        return $response->successful() ? self::SUCCESS : self::FAILURE;
    }
}
