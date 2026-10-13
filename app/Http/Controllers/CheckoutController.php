<?php

namespace App\Http\Controllers;

use App\Http\Requests\PlaceOrderRequest;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentMethod;
use App\Models\ProductVariant;
use App\Models\ShippingCourier;
use App\Services\ShippingRateException;
use App\Services\ShippingRateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CheckoutController extends Controller
{
    public function show(Request $request): Response
    {
        return Inertia::render('store/checkout', [
            'paymentMethods' => PaymentMethod::query()->where('is_active', true)->get(['id', 'name']),
            'orderNumber' => $request->session()->pull('order_number'),
        ]);
    }

    public function store(PlaceOrderRequest $request, ShippingRateService $shippingRates): RedirectResponse
    {
        $data = $request->validated();
        $items = collect($data['items']);
        $quantitiesByVariant = $items->groupBy('variant_id')->map(fn ($variantItems): int => $variantItems->sum('qty'));
        $rateVariants = ProductVariant::query()->with('product')->whereIn('id', $quantitiesByVariant->keys())->get()->keyBy('id');
        if ($rateVariants->count() !== $quantitiesByVariant->count()) {
            abort(422, 'Produk pada keranjang tidak ditemukan.');
        }
        foreach ($quantitiesByVariant as $variantId => $quantity) {
            $variant = $rateVariants->get((int) $variantId);
            if (! $variant->product->is_active || $variant->stock < $quantity) {
                abort(422, 'Stok produk berubah. Perbarui keranjang Anda.');
            }
        }
        $courierCodes = ShippingCourier::query()->where('is_active', true)->pluck('code')->all();
        try {
            $rate = $shippingRates->findRate(
                (int) $data['destination_id'],
                $shippingRates->weightFor($rateVariants, $quantitiesByVariant),
                $courierCodes,
                $data['courier_code'],
                $data['courier_service'],
            );
        } catch (ShippingRateException $exception) {
            throw ValidationException::withMessages(['destination_id' => $exception->getMessage()]);
        }
        if (! $rate) {
            throw ValidationException::withMessages(['courier_service' => 'Layanan ongkir ini sudah tidak tersedia. Pilih layanan lain.']);
        }

        $order = DB::transaction(function () use ($data, $request, $items, $quantitiesByVariant, $rate): Order {
            $paymentMethod = PaymentMethod::query()->whereKey($data['payment_method_id'])->where('is_active', true)->firstOrFail();
            $variants = ProductVariant::query()
                ->with('product')
                ->whereIn('id', $quantitiesByVariant->keys())
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($variants->count() !== $quantitiesByVariant->count()) {
                abort(422, 'Produk berubah. Perbarui keranjang Anda.');
            }

            foreach ($quantitiesByVariant as $variantId => $quantity) {
                $variant = $variants->get((int) $variantId);

                if (! $variant->product->is_active || $variant->stock < $quantity) {
                    abort(422, 'Stok produk berubah. Perbarui keranjang Anda.');
                }
            }

            $subtotal = $items->sum(function (array $item) use ($variants): int {
                $variant = $variants->get((int) $item['variant_id']);

                return $variant->product->discounted_price * $item['qty'];
            });
            $order = Order::query()->create([
                'user_id' => $request->user()->id,
                'order_number' => 'MLF-'.now()->format('ymd').'-'.Str::upper(Str::random(6)),
                'recipient_name' => $data['recipient_name'], 'phone' => $data['phone'],
                'address' => $data['address'], 'address_detail' => $data['address_detail'] ?? null,
                'shipping_courier' => $rate['name'], 'shipping_courier_code' => $rate['code'],
                'shipping_service' => $rate['service'], 'shipping_etd' => $rate['etd'],
                'destination_id' => $data['destination_id'], 'destination_label' => $data['destination_label'],
                'shipping_cost' => $rate['cost'],
                'payment_method' => $paymentMethod->name, 'subtotal' => $subtotal,
                'total' => $subtotal + $rate['cost'], 'status' => 'pending_payment',
            ]);

            foreach ($quantitiesByVariant as $variantId => $quantity) {
                $variants->get((int) $variantId)->decrement('stock', $quantity);
            }

            $timestamp = now();
            OrderItem::query()->insert($items->map(function (array $item) use ($order, $variants, $timestamp): array {
                $variant = $variants->get((int) $item['variant_id']);

                return [
                    'order_id' => $order->id,
                    'product_id' => $variant->product_id,
                    'variant_id' => $variant->id,
                    'product_name' => $variant->product->name, 'size' => $variant->size,
                    'qty' => $item['qty'], 'unit_price' => $variant->product->discounted_price,
                    'created_at' => $timestamp, 'updated_at' => $timestamp,
                ];
            })->all());

            CartItem::query()->whereBelongsTo($request->user())
                ->whereIn('product_variant_id', $quantitiesByVariant->keys())
                ->delete();

            return $order;
        });

        return redirect()->route('checkout.show')->with('order_number', $order->order_number);
    }
}
