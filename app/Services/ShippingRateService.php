<?php

namespace App\Services;

use App\Models\ProductVariant;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class ShippingRateService
{
    /** @return list<array{id: int, label: string}> */
    public function searchDestinations(string $query): array
    {
        $normalizedQuery = mb_strtolower(preg_replace('/\s+/u', ' ', trim($query)) ?? trim($query));
        $key = 'rajaongkir:destinations:'.hash('sha256', $normalizedQuery);

        if (is_array($cached = Cache::get($key))) {
            return $cached;
        }

        return $this->withLock($key.':lock', 10, function () use ($key, $normalizedQuery): array {
            if (is_array($cached = Cache::get($key))) {
                return $cached;
            }

            $data = $this->request('get', 'destination/domestic-destination', [
                'search' => $normalizedQuery, 'limit' => 10, 'offset' => 0,
            ]);

            $destinations = collect($data)->filter(fn (mixed $row): bool => is_array($row) && isset($row['id']))
                ->map(fn (array $row): array => [
                    'id' => (int) $row['id'],
                    'label' => (string) ($row['label'] ?? implode(', ', array_filter([
                        $row['subdistrict_name'] ?? null, $row['district_name'] ?? null,
                        $row['city_name'] ?? null, $row['province_name'] ?? null, $row['zip_code'] ?? null,
                    ]))),
                ])->values()->all();

            Cache::put($key, $destinations, now()->addMinutes($destinations === [] ? 1 : 60));
            foreach ($destinations as $destination) {
                Cache::put(
                    'rajaongkir:destination-label:'.$destination['id'],
                    strip_tags(trim($destination['label'])),
                    now()->addDay(),
                );
            }

            return $destinations;
        });
    }

    public function destinationLabel(int $destinationId): ?string
    {
        $label = Cache::get('rajaongkir:destination-label:'.$destinationId);

        return is_string($label) ? $label : null;
    }

    /** @param list<string> $courierCodes
     * @return list<array{code: string, name: string, service: string, description: string, cost: int, etd: string|null}>
     */
    public function rates(int $destinationId, int $weightGram, array $courierCodes): array
    {
        $validCodes = config('shipping.courier_codes', []);
        $courierCodes = array_values(array_unique(array_filter(array_map(
            fn (string $code): string => strtolower(trim($code)),
            $courierCodes,
        ), fn (string $code): bool => in_array($code, $validCodes, true))));
        sort($courierCodes);

        if ($courierCodes === []) {
            return [];
        }

        $cacheKey = 'rajaongkir:rates:'.hash('sha256', json_encode([$destinationId, $weightGram, $courierCodes]));
        $rates = $this->withLock($cacheKey.':lock', 15, function () use ($cacheKey, $destinationId, $weightGram, $courierCodes): array {
            return Cache::remember($cacheKey, now()->addMinutes(10), function () use ($destinationId, $weightGram, $courierCodes): array {
                $data = $this->request('post', 'calculate/domestic-cost', [
                    'origin' => (int) config('services.rajaongkir.origin_id'),
                    'destination' => $destinationId,
                    'weight' => $weightGram,
                    'courier' => implode(':', $courierCodes),
                    'price' => 'lowest',
                ]);

                return collect($data)->filter(fn (mixed $row): bool => is_array($row)
                    && isset($row['code'], $row['service'], $row['cost'])
                    && is_numeric($row['cost'])
                    && (int) $row['cost'] >= 0)
                    ->map(fn (array $row): array => [
                        'code' => strtolower((string) $row['code']),
                        'name' => (string) ($row['name'] ?? $row['code']),
                        'service' => (string) $row['service'],
                        'description' => (string) ($row['description'] ?? ''),
                        'cost' => (int) $row['cost'],
                        'etd' => trim((string) ($row['etd'] ?? '')) ?: null,
                    ])->values()->all();
            });
        });

        return collect($rates)->reject(function (array $rate): bool {
            $filters = config('shipping.excluded_services');

            foreach ($filters['service_prefixes'] as $prefix) {
                if (str_starts_with(strtoupper($rate['service']), $prefix)) {
                    return true;
                }
            }

            foreach ($filters['description_contains'] as $phrase) {
                if (str_contains(mb_strtolower($rate['description']), mb_strtolower($phrase))) {
                    return true;
                }
            }

            return false;
        })->values()->all();
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
            $productWeight = (int) ($variant?->product?->weight ?? 0);
            $total += ($productWeight > 0 ? $productWeight : 500) * (int) $quantity;
        }

        return max(1, $total);
    }

    /** @param array<string, int|string> $parameters
     * @return array<mixed>
     */
    private function request(string $method, string $path, array $parameters): array
    {
        $apiKey = (string) config('services.rajaongkir.key');
        $baseUrl = rtrim((string) config('services.rajaongkir.base_url'), '/');
        $originId = filter_var(config('services.rajaongkir.origin_id'), FILTER_VALIDATE_INT);

        $originConfig = config('services.rajaongkir.origin_id');
        $baseUrlValid = str_starts_with($baseUrl, 'https://');
        if ($apiKey === '' || ! $baseUrlValid || ($method === 'post' && (! $originId || $originId < 1))) {
            Log::warning('RajaOngkir configuration is invalid.', [
                'path' => $path,
                'origin_id' => is_scalar($originConfig) ? mb_substr((string) $originConfig, 0, 32) : gettype($originConfig),
                'origin_valid' => $originId !== false && $originId > 0,
                'base_url_valid' => $baseUrlValid,
            ]);
            throw new ShippingRateException('Layanan ongkir sedang sibuk. Coba lagi sebentar.');
        }

        $counterKey = 'rajaongkir:daily:'.now()->format('Y-m-d');
        Cache::add($counterKey, 0, now()->endOfDay());
        $requestCount = Cache::increment($counterKey);

        if ($requestCount > max(1, (int) config('services.rajaongkir.daily_limit', 90))) {
            throw new ShippingRateException('Layanan ongkir sedang sibuk. Coba lagi sebentar.');
        }

        try {
            $pending = Http::baseUrl($baseUrl)
                ->acceptJson()
                ->withHeaders(['key' => $apiKey])
                ->timeout(10)
                ->connectTimeout(5);
            $response = $method === 'get'
                ? $pending->get($path, $parameters)
                : $pending->asForm()->post($path, $parameters);

            if ($method === 'get' && $response->status() === 404) {
                return [];
            }

            if (! $response->successful()) {
                $exception = $response->toException();
                Log::warning('RajaOngkir request failed.', [
                    'path' => $path,
                    'status' => $response->status(),
                    'body' => $this->safeLogText($response->body(), $apiKey),
                    'exception' => $this->safeLogText($exception?->getMessage() ?? 'HTTP response was not successful', $apiKey),
                ]);
                throw new ShippingRateException('Layanan ongkir sedang tidak tersedia. Coba lagi sebentar.');
            }

            $payload = $response->json();
        } catch (ShippingRateException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            Log::warning('RajaOngkir request raised an exception.', [
                'path' => $path,
                'status' => null,
                'body' => '',
                'exception' => $this->safeLogText($exception->getMessage(), $apiKey),
            ]);
            throw new ShippingRateException('Layanan ongkir sedang tidak tersedia. Coba lagi sebentar.', previous: $exception);
        }

        if (! is_array($payload) || ($payload['meta']['status'] ?? null) !== 'success') {
            Log::warning('RajaOngkir response was invalid.', [
                'path' => $path,
                'status' => $response->status(),
                'body' => $this->safeLogText($response->body(), $apiKey),
                'exception' => 'Invalid response payload',
            ]);
            if ($method === 'get' && (int) ($payload['meta']['code'] ?? 0) === 404) {
                return [];
            }

            throw new ShippingRateException('Layanan ongkir sedang tidak tersedia. Coba lagi sebentar.');
        }

        return is_array($payload['data'] ?? null) ? $payload['data'] : [];
    }

    /** @param callable(): array<mixed> $callback
     * @return array<mixed>
     */
    private function withLock(string $key, int $seconds, callable $callback): array
    {
        try {
            return Cache::lock($key, $seconds)->block(5, $callback);
        } catch (LockTimeoutException $exception) {
            throw new ShippingRateException('Layanan ongkir sedang sibuk. Coba lagi sebentar.', previous: $exception);
        }
    }

    private function safeLogText(string $value, string $apiKey): string
    {
        if ($apiKey !== '') {
            $value = str_replace($apiKey, '[redacted]', $value);
        }

        return mb_substr($value, 0, 500);
    }
}
