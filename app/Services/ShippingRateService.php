<?php

namespace App\Services;

use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class ShippingRateService
{
    /** @return list<array{id: int, label: string}> */
    public function searchDestinations(string $query): array
    {
        $key = 'rajaongkir:destinations:'.mb_strtolower(trim($query));
        $cached = Cache::get($key);

        if (is_array($cached)) {
            return $cached;
        }

        $data = $this->request('get', 'destination/domestic-destination', [
            'search' => trim($query), 'limit' => 10, 'offset' => 0,
        ], false);

        $destinations = collect($data)->filter(fn (mixed $row): bool => is_array($row) && isset($row['id']))
            ->map(fn (array $row): array => [
                'id' => (int) $row['id'],
                'label' => (string) ($row['label'] ?? implode(', ', array_filter([
                    $row['subdistrict_name'] ?? null, $row['district_name'] ?? null,
                    $row['city_name'] ?? null, $row['province_name'] ?? null, $row['zip_code'] ?? null,
                ]))),
            ])->values()->all();

        if ($destinations !== []) {
            Cache::put($key, $destinations, now()->addDay());
        }

        return $destinations;
    }

    /** @param list<string> $courierCodes
     * @return list<array{code: string, name: string, service: string, description: string, cost: int, etd: string|null}>
     */
    public function rates(int $destinationId, int $weightGram, array $courierCodes): array
    {
        $courierCodes = array_values(array_unique(array_filter(array_map('strtolower', $courierCodes))));
        sort($courierCodes);
        $cacheKey = 'rajaongkir:rates:'.hash('sha256', json_encode([$destinationId, $weightGram, $courierCodes]));

        return Cache::remember($cacheKey, now()->addMinutes(10), function () use ($destinationId, $weightGram, $courierCodes): array {
            $data = $this->request('post', 'calculate/domestic-cost', [
                'origin' => (int) config('services.rajaongkir.origin_id'),
                'destination' => $destinationId,
                'weight' => $weightGram,
                'courier' => implode(':', $courierCodes),
                'price' => 'lowest',
            ], true);

            return collect($data)->filter(fn (mixed $row): bool => is_array($row) && isset($row['code'], $row['service'], $row['cost']))
                ->map(fn (array $row): array => [
                    'code' => strtolower((string) $row['code']),
                    'name' => (string) ($row['name'] ?? $row['code']),
                    'service' => (string) $row['service'],
                    'description' => (string) ($row['description'] ?? ''),
                    'cost' => (int) $row['cost'],
                    'etd' => isset($row['etd']) ? (string) $row['etd'] : null,
                ])->values()->all();
        });
    }

    /** @param list<string> $courierCodes
     * @return array{code: string, name: string, service: string, description: string, cost: int, etd: string|null}|null
     */
    public function findRate(int $destinationId, int $weightGram, array $courierCodes, string $code, string $service): ?array
    {
        return collect($this->rates($destinationId, $weightGram, $courierCodes))
            ->first(fn (array $rate): bool => $rate['code'] === strtolower($code) && $rate['service'] === $service);
    }

    /** @param EloquentCollection<int, ProductVariant>|Collection<int, ProductVariant> $variants
     * @param  Collection<int|string, int>|array<int|string, int>  $quantitiesByVariant
     */
    public function weightFor(EloquentCollection|Collection $variants, Collection|array $quantitiesByVariant): int
        {
            $total = 0;

            foreach ($quantitiesByVariant as $variantId => $quantity) {
                $variant = $variants->get((int) $variantId);
                $total += (int) ($variant?->product?->weight ?? 500) * (int) $quantity;
            }

            return max(1, $total);
        }
    /** @param array<string, int|string> $parameters
     * @return array<mixed>
     */
    private function request(string $method, string $path, array $parameters, bool $form): array
    {
        $apiKey = (string) config('services.rajaongkir.key');
        $baseUrl = rtrim((string) config('services.rajaongkir.base_url'), '/');

        if ($apiKey === '' || $baseUrl === '' || ($method === 'post' && (int) config('services.rajaongkir.origin_id') < 1)) {
            throw new ShippingRateException('Konfigurasi ongkir belum lengkap.');
        }

        try {
            $pending = Http::baseUrl($baseUrl)->acceptJson()->withHeaders(['key' => $apiKey])->timeout(15);
            if ($form) {
                $pending = $pending->asForm();
            }
            $response = $method === 'get'
                ? $pending->get($path, $parameters)
                : $pending->post($path, $parameters);
            if ($method === 'get' && $response->status() === 404) {
                return [];
            }
            $response->throw();
            $payload = $response->json();
        } catch (\Throwable $exception) {
            throw new ShippingRateException('Layanan ongkir sedang tidak tersedia. Coba lagi sebentar.', previous: $exception);
        }

        if (! is_array($payload) || ($payload['meta']['status'] ?? null) !== 'success') {
            if ($method === 'get' && (int) ($payload['meta']['code'] ?? 0) === 404) {
                return [];
            }
            throw new ShippingRateException('Layanan ongkir mengembalikan respons yang tidak valid.');
        }

        return is_array($payload['data'] ?? null) ? $payload['data'] : [];
    }
}
