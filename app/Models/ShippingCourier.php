<?php

namespace App\Models;

use Database\Factories\ShippingCourierFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class ShippingCourier extends Model
{
    /** @use HasFactory<ShippingCourierFactory> */
    use HasFactory;

    protected $fillable = ['name', 'code', 'flat_cost', 'is_active'];

    /** @return list<string> */
    public static function activeCodes(): array
    {
        return Cache::remember('shipping:active-courier-codes', now()->addMinutes(5), fn (): array => static::query()
            ->where('is_active', true)
            ->whereNotNull('code')
            ->where('code', '!=', '')
            ->pluck('code')
            ->map(fn (string $code): string => strtolower(trim($code)))
            ->filter(fn (string $code): bool => $code !== '' && in_array($code, config('shipping.courier_codes', []), true))
            ->unique()
            ->values()
            ->all());
    }

    public static function clearActiveCodesCache(): void
    {
        Cache::forget('shipping:active-courier-codes');
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
