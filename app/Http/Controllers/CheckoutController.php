<?php

namespace App\Http\Controllers;

use App\Http\Requests\PlaceOrderRequest;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\ProductVariant;
use App\Models\ShippingCourier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CheckoutController extends Controller
{
    public function show(Request $request): Response
    {
        return Inertia::render('store/checkout', [
            'couriers' => ShippingCourier::query()->where('is_active', true)->get(['id', 'name', 'flat_cost']),
            'paymentMethods' => PaymentMethod::query()->where('is_active', true)->get(['id', 'name']),
            'orderNumber' => $request->session()->pull('order_number'),
        ]);
    }

    public function store(PlaceOrderRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $order = DB::transaction(function () use ($data, $request): Order {
            $courier = ShippingCourier::query()->whereKey($data['shipping_courier_id'])->where('is_active', true)->firstOrFail();
            $paymentMethod = PaymentMethod::query()->whereKey($data['payment_method_id'])->where('is_active', true)->firstOrFail();
            $lockedVariants = collect($data['items'])->map(function (array $item): array {
                $variant = ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($item['variant_id']);
                if (! $variant->product->is_active || $variant->stock < $item['qty']) {
                    abort(422, 'Stok produk berubah. Perbarui keranjang Anda.');
                }

                return [$variant, $item['qty']];
            });

            $subtotal = $lockedVariants->sum(fn (array $line): int => $line[0]->product->discounted_price * $line[1]);
            $order = Order::query()->create([
                'user_id' => $request->user()->id,
                'order_number' => 'MLF-'.now()->format('ymd').'-'.Str::upper(Str::random(6)),
                'recipient_name' => $data['recipient_name'], 'phone' => $data['phone'],
                'address' => $data['address'], 'address_detail' => $data['address_detail'] ?? null,
                'shipping_courier' => $courier->name, 'shipping_cost' => $courier->flat_cost,
                'payment_method' => $paymentMethod->name, 'subtotal' => $subtotal,
                'total' => $subtotal + $courier->flat_cost, 'status' => 'pending_payment',
            ]);

            foreach ($lockedVariants as [$variant, $quantity]) {
                $variant->decrement('stock', $quantity);
                $order->items()->create([
                    'product_id' => $variant->product_id, 'variant_id' => $variant->id,
                    'product_name' => $variant->product->name, 'size' => $variant->size,
                    'qty' => $quantity, 'unit_price' => $variant->product->discounted_price,
                ]);
            }

            return $order;
        });

        return redirect()->route('checkout.show')->with('order_number', $order->order_number);
    }
}
