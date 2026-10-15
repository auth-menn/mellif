<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class QrislyService
{
    /** @return array{history_id: int, qris_string: string, original_amount: int, final_amount: int, payment_status: string, expiry_time: string} */
    public function generate(Order $order): array
    {
        $qrisId = (string) config('services.qrisly.qris_id');
        if (! ctype_digit($qrisId) || ! config('services.qrisly.key')) {
            throw new RuntimeException('QRISLY is not configured.');
        }

        if ($order->total < 1000 || $order->total > 100000000) {
            throw new RuntimeException('Order total is outside QRISLY limits.');
        }

        $response = $this->client()->post('/api/v1/qrisly/generate-qris', [
            'qris_id' => (int) $qrisId,
            'amount' => (int) $order->total,
            'unique_amount' => true,
            'output_type' => 'string',
        ])->throw()->json();

        if (! is_array($response)) {
            throw new RuntimeException('QRISLY returned an invalid QRIS response.');
        }

        $data = $response['data'] ?? null;
        $isSuccessful = ($response['meta']['status'] ?? null) === 'success'
            || ($response['success'] ?? false) === true;

        if (! $isSuccessful || ! is_array($data)
            || ! isset($data['history_id'], $data['qris_string'], $data['original_amount'], $data['final_amount'], $data['payment_status'], $data['expiry_time'])) {
            throw new RuntimeException('QRISLY returned an invalid QRIS response.');
        }

        if (! is_string($data['qris_string']) || trim($data['qris_string']) === '' || str_contains($data['qris_string'], 'INVALID_DATA')) {
            throw new RuntimeException('QRISLY returned an unusable QRIS payload.');
        }

        return [
            'history_id' => (int) $data['history_id'],
            'qris_string' => (string) $data['qris_string'],
            'original_amount' => (int) $data['original_amount'],
            'final_amount' => (int) $data['final_amount'],
            'payment_status' => (string) $data['payment_status'],
            'expiry_time' => (string) $data['expiry_time'],
        ];
    }

    public function paymentStatus(int $historyId): string
    {
        $response = $this->client()->get('/api/v1/qrisly/payment-status/'.$historyId)->throw()->json();
        $status = $response['data']['payment_status'] ?? null;

        if (($response['meta']['status'] ?? null) !== 'success'
            || ! in_array($status, ['unpaid', 'paid', 'expired', 'cancelled'], true)) {
            throw new RuntimeException('QRISLY returned an invalid payment status.');
        }

        return $status;
    }

    private function client(): PendingRequest
    {
        $baseUrl = rtrim((string) config('services.qrisly.base_url'), '/');
        if (! str_starts_with($baseUrl, 'https://')) {
            throw new RuntimeException('QRISLY requires an HTTPS base URL.');
        }

        return Http::baseUrl($baseUrl)
            ->withHeaders(['X-API-Key' => (string) config('services.qrisly.key')])
            ->acceptJson()
            ->asJson()
            ->connectTimeout(5)
            ->timeout(10);
    }
}
