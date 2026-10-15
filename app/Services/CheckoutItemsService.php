<?php

namespace App\Services;

use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

class CheckoutItemsService
{
    /**
     * @param  list<array{variant_id: int|string, qty: int|string}>  $items
     * @return array{variants: Collection<int, ProductVariant>, quantities: array<int, int>}
     */
    public function resolve(array $items, bool $lockForUpdate = false): array
    {
        $quantities = [];
        foreach ($items as $item) {
            $variantId = (int) $item['variant_id'];
            $quantities[$variantId] = ($quantities[$variantId] ?? 0) + (int) $item['qty'];
        }

        $query = ProductVariant::query()->with('product')->whereIn('id', array_keys($quantities))->orderBy('id');
        if ($lockForUpdate) {
            $query->lockForUpdate();
        }
        $variants = $query->get()->keyBy('id');

        if ($variants->count() !== count($quantities)) {
            throw ValidationException::withMessages(['items' => 'Produk pada keranjang tidak ditemukan.']);
        }

        foreach ($quantities as $variantId => $quantity) {
            $variant = $variants->get($variantId);
            if (! $variant->product->is_active || $variant->stock < $quantity) {
                throw ValidationException::withMessages(['items' => 'Stok produk berubah. Perbarui keranjang Anda.']);
            }
        }

        return ['variants' => $variants, 'quantities' => $quantities];
    }
}
