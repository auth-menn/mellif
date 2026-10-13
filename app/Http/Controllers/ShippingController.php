<?php

namespace App\Http\Controllers;

use App\Models\ProductVariant;
use App\Models\ShippingCourier;
use App\Services\ShippingRateException;
use App\Services\ShippingRateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ShippingController extends Controller
{
    public function destinations(Request $request, ShippingRateService $shippingRates): JsonResponse
    {
        $data = $request->validate(['q' => ['required', 'string', 'min:3', 'max:100']]);

        try {
            return response()->json(['destinations' => $shippingRates->searchDestinations($data['q'])]);
        } catch (ShippingRateException $exception) {
            return response()->json(['message' => $exception->getMessage()], 502);
        }
    }

    public function rates(Request $request, ShippingRateService $shippingRates): JsonResponse
    {
        $data = $request->validate([
            'destination_id' => ['required', 'integer', 'min:1'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.variant_id' => ['required', 'integer', 'min:1'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
        ]);
        $quantities = collect($data['items'])->groupBy('variant_id')->map(fn ($items): int => $items->sum('qty'));
        $variants = ProductVariant::query()->with('product')->whereIn('id', $quantities->keys())->get()->keyBy('id');

        if ($variants->count() !== $quantities->count()) {
            throw ValidationException::withMessages(['items' => 'Produk pada keranjang tidak ditemukan.']);
        }

        foreach ($quantities as $variantId => $quantity) {
            $variant = $variants->get((int) $variantId);
            if (! $variant->product->is_active || $variant->stock < $quantity) {
                throw ValidationException::withMessages(['items' => 'Stok produk berubah. Perbarui keranjang Anda.']);
            }
        }

        $courierCodes = ShippingCourier::query()->where('is_active', true)->pluck('code')->all();
        if ($courierCodes === []) {
            return response()->json(['message' => 'Belum ada ekspedisi aktif.'], 422);
        }

        try {
            return response()->json([
                'rates' => $shippingRates->rates((int) $data['destination_id'], $shippingRates->weightFor($variants, $quantities), $courierCodes),
            ]);
        } catch (ShippingRateException $exception) {
            return response()->json(['message' => $exception->getMessage()], 502);
        }
    }
}
