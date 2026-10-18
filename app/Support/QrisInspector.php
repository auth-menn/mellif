<?php

namespace App\Support;

/**
 * Memeriksa apakah sebuah string QRIS (format EMV QR) layak dijadikan QR.
 * Murni lokal: tidak memanggil API apa pun dan tidak mencetak isi string.
 */
final class QrisInspector
{
    /** @return array<string, string>|null null jika struktur TLV rusak */
    public static function parseTlv(string $data): ?array
    {
        $result = [];
        $length = strlen($data);
        $position = 0;

        while ($position < $length) {
            if ($position + 4 > $length) {
                return null;
            }

            $tag = substr($data, $position, 2);
            $declared = substr($data, $position + 2, 2);

            if (! ctype_digit($tag) || ! ctype_digit($declared)) {
                return null;
            }

            $valueLength = (int) $declared;

            if ($position + 4 + $valueLength > $length) {
                return null;
            }

            $result[$tag] = substr($data, $position + 4, $valueLength);
            $position += 4 + $valueLength;
        }

        return $result;
    }

    public static function crc16(string $data): string
    {
        $crc = 0xFFFF;

        for ($i = 0, $n = strlen($data); $i < $n; $i++) {
            $crc ^= ord($data[$i]) << 8;

            for ($bit = 0; $bit < 8; $bit++) {
                $crc = ($crc & 0x8000) ? (($crc << 1) ^ 0x1021) : ($crc << 1);
                $crc &= 0xFFFF;
            }
        }

        return strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));
    }

    /**
     * @return array{ok: bool, checks: list<array{label: string, pass: bool, detail: string}>}
     */
    public static function inspect(string $qris, ?int $expectedAmount = null): array
    {
        $checks = [];
        $add = static function (string $label, bool $pass, string $detail = '') use (&$checks): void {
            $checks[] = ['label' => $label, 'pass' => $pass, 'detail' => $detail];
        };

        $add('Panjang minimal 100 karakter', strlen($qris) >= 100, strlen($qris).' karakter');
        $add('Tidak berisi placeholder "INVALID"', ! str_contains(strtoupper($qris), 'INVALID'));

        $tlv = self::parseTlv($qris);
        $add('Struktur TLV valid', $tlv !== null);

        if ($tlv === null) {
            return ['ok' => false, 'checks' => $checks];
        }

        $add('Diawali 000201', str_starts_with($qris, '000201'));

        $crcOk = strlen($qris) > 8
            && substr($qris, -8, 4) === '6304'
            && self::crc16(substr($qris, 0, -4)) === strtoupper(substr($qris, -4));
        $add('Checksum CRC16 valid', $crcOk);

        $add('Kode negara (tag 58) = ID', ($tlv['58'] ?? '') === 'ID', $tlv['58'] ?? '-');
        $add('Nama merchant (tag 59) ada', ($tlv['59'] ?? '') !== '', $tlv['59'] ?? '-');
        $add('Kota (tag 60) ada', ($tlv['60'] ?? '') !== '', $tlv['60'] ?? '-');
        $add('Nominal (tag 54) ada', isset($tlv['54']), $tlv['54'] ?? '-');

        if ($expectedAmount !== null && isset($tlv['54'])) {
            $add(
                'Nominal di QR = final_amount',
                abs((float) $tlv['54'] - $expectedAmount) < 0.01,
                $tlv['54'].' vs '.$expectedAmount,
            );
        }

        $add('Jenis QR (tag 01)', true, ($tlv['01'] ?? '') === '12' ? 'dinamis (12)' : 'statis ('.($tlv['01'] ?? '?').')');

        $failed = array_filter($checks, static fn (array $check): bool => ! $check['pass']);

        return ['ok' => $failed === [], 'checks' => $checks];
    }
}
