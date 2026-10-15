<?php

namespace App\Http\Controllers;

use App\Http\Requests\PlaceOrderRequest;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentMethod;
use App\Models\ProductVariant;
use App\Models\ShippingCourier;
use App\Services\CheckoutItemsService;
use App\Services\QrislyService;
use App\Services\ShippingRateException;
use App\Services\ShippingRateService;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class CheckoutController extends Controller
{
    public function show(Request $request): Response
    {
        $orderNumber = $request->query('order', $request->session()->pull('order_number'));
        $order = $request->user() && is_string($orderNumber)
            ? Order::query()->whereBelongsTo($request->user())->where('order_number', $orderNumber)->first()
            : null;

        return Inertia::render('store/checkout', [
            'paymentMethods' => PaymentMethod::query()->where('is_active', true)->get(['id', 'name', 'code']),
            'order' => $order ? [
                'id' => $order->id,
                'orderNumber' => $order->order_number,
                'status' => $order->status,
                'total' => $order->total,
                'paymentMethodCode' => $order->payment_method_code,
                'qrisString' => $order->qris_string,
                'qrisImage' => $order->qris_string && $order->qris_payment_status === 'unpaid'
                    ? 'data:image/svg+xml;base64,'.base64_encode((new Writer(new ImageRenderer(new RendererStyle(280, 4), new SvgImageBackEnd)))->writeString($order->qris_string))
                    : null,
                'qrisFinalAmount' => $order->qris_final_amount,
                'qrisPaymentStatus' => $order->qris_payment_status,
                'qrisExpiryTime' => $order->qris_expiry_time?->toIso8601String(),
            ] : null,
        ]);
    }

    public function store(PlaceOrderRequest $request, ShippingRateService $shippingRates, CheckoutItemsService $checkoutItems, QrislyService $qrisly): RedirectResponse
    {
        $data = $request->validated();
        $items = collect($data['items']);
        ['variants' => $rateVariants, 'quantities' => $quantitiesByVariant] = $checkoutItems->resolve($data['items']);
        $courierCodes = ShippingCourier::activeCodes();
        if ($courierCodes === []) {
            throw ValidationException::withMessages(['courier_code' => 'Ekspedisi belum tersedia. Silakan hubungi kami.']);
        }
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
        if ((int) $data['expected_shipping_cost'] !== $rate['cost']) {
            throw ValidationException::withMessages(['courier_service' => 'Ongkir berubah, silakan periksa total.']);
        }

        $destinationLabel = $shippingRates->destinationLabel((int) $data['destination_id'])
            ?? mb_substr(trim(strip_tags($data['destination_label'])), 0, 255);

        $order = DB::transaction(function () use ($data, $request, $items, $quantitiesByVariant, $rate, $destinationLabel, $checkoutItems): Order {
            $paymentMethod = PaymentMethod::query()->whereKey($data['payment_method_id'])->where('is_active', true)->firstOrFail();
            ['variants' => $variants] = $checkoutItems->resolve($data['items'], true);

            $subtotal = $items->sum(function (array $item) use ($variants): int {
                $variant = $variants->get((int) $item['variant_id']);

                return $variant->product->discounted_price * $item['qty'];
            });
            $total = $subtotal + $rate['cost'];
            if ($paymentMethod->code === 'qris' && ($total < 1000 || $total > 100000000)) {
                throw ValidationException::withMessages([
                    'payment_method_id' => 'Total QRIS harus antara Rp1.000 dan Rp100.000.000.',
                ]);
            }

            $order = Order::query()->create([
                'user_id' => $request->user()->id,
                'order_number' => 'MLF-'.now()->format('ymd').'-'.Str::upper(Str::random(6)),
                'recipient_name' => $data['recipient_name'], 'phone' => $data['phone'],
                'address' => $data['address'], 'address_detail' => $data['address_detail'] ?? null,
                'shipping_courier' => $rate['name'], 'shipping_courier_code' => $rate['code'],
                'shipping_service' => $rate['service'], 'shipping_etd' => $rate['etd'],
                'destination_id' => $data['destination_id'], 'destination_label' => $destinationLabel,
                'shipping_cost' => $rate['cost'],
                'payment_method' => $paymentMethod->name, 'payment_method_code' => $paymentMethod->code, 'subtotal' => $subtotal,
                'total' => $total, 'status' => 'pending_payment',
                'stock_deducted' => $paymentMethod->code !== 'qris',
            ]);

            if ($paymentMethod->code !== 'qris') {
                foreach ($quantitiesByVariant as $variantId => $quantity) {
                    $variants->get((int) $variantId)->decrement('stock', $quantity);
                }
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

            if ($paymentMethod->code !== 'qris') {
                CartItem::query()->whereBelongsTo($request->user())
                    ->whereIn('product_variant_id', array_keys($quantitiesByVariant))
                    ->delete();
            }

            return $order;
        });

        if ($order->payment_method_code === 'qris') {
            try {
                $qris = $qrisly->generate($order);
                $order->update([
                    'qrisly_history_id' => $qris['history_id'],
                    'qris_string' => $qris['qris_string'],
                    'qris_original_amount' => $qris['original_amount'],
                    'qris_final_amount' => $qris['final_amount'],
                    'qris_payment_status' => $qris['payment_status'],
                    'qris_expiry_time' => $qris['expiry_time'],
                ]);
            } catch (Throwable $exception) {
                Log::warning('QRISLY QRIS generation failed.', [
                    'order_id' => $order->id,
                    'exception' => $exception::class,
                    'message' => $exception->getMessage(),
                ]);
                $order->update(['qris_payment_status' => 'failed']);
            }
        }

        return redirect()->route('checkout.show')->with('order_number', $order->order_number);
    }

    public function paymentStatus(Request $request, Order $order, QrislyService $qrisly): JsonResponse
    {
        abort_unless($request->user()?->is($order->user), 404);
        abort_if($order->payment_method_code !== 'qris' || ! $order->qrisly_history_id, 404);

        try {
            $status = $qrisly->paymentStatus((int) $order->qrisly_history_id);
        } catch (Throwable) {
            return response()->json(['message' => 'Status pembayaran belum dapat diperbarui.'], 503);
        }

        $order = $this->syncQrisPaymentStatus($order, $status);

        return response()->json(['payment_status' => $status]);
    }

    public function cancelQrisPayment(Request $request, Order $order, QrislyService $qrisly): RedirectResponse
    {
        abort_unless($request->user()?->is($order->user), 404);
        abort_unless($order->payment_method_code === 'qris', 404);
        abort_unless($order->status === 'pending_payment', 409);

        if ($order->qrisly_history_id) {
            try {
                $providerStatus = $qrisly->paymentStatus((int) $order->qrisly_history_id);
            } catch (Throwable $exception) {
                Log::warning('QRIS payment status could not be verified before cancellation.', [
                    'order_id' => $order->id,
                    'exception' => $exception::class,
                    'message' => $exception->getMessage(),
                ]);

                abort(503, 'Status pembayaran belum dapat dipastikan. Coba batalkan kembali sebentar lagi.');
            }

            if ($providerStatus === 'paid') {
                $this->syncQrisPaymentStatus($order, $providerStatus);

                return redirect()->route('checkout.show', ['order' => $order->order_number]);
            }
        }

        DB::transaction(function () use ($order): void {
            $lockedOrder = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);
            abort_unless($lockedOrder->status === 'pending_payment', 409);
            abort_unless($lockedOrder->qris_payment_status !== 'paid', 409);

            if ($lockedOrder->stock_deducted) {
                $this->restoreOrderStock($lockedOrder);
            }

            $lockedOrder->update([
                'status' => 'cancelled',
                'qris_payment_status' => 'cancelled',
                'stock_deducted' => false,
            ]);
        });

        return redirect()->route('checkout.show');
    }

    public function regenerateQris(Request $request, Order $order, QrislyService $qrisly): RedirectResponse
    {
        abort_unless($request->user()?->is($order->user), 404);
        abort_unless($order->payment_method_code === 'qris', 404);
        abort_unless($order->status === 'pending_payment', 409);

        $isExpiredByTime = $order->qris_expiry_time?->isPast() ?? false;
        $canRegenerate = in_array($order->qris_payment_status, ['failed', 'expired', 'cancelled'], true)
            || ($order->qris_payment_status === 'unpaid' && $isExpiredByTime);
        abort_unless($canRegenerate, 409);

        if ($order->qrisly_history_id) {
            try {
                $providerStatus = $qrisly->paymentStatus((int) $order->qrisly_history_id);
            } catch (Throwable $exception) {
                Log::warning('QRIS payment status could not be verified before regeneration.', [
                    'order_id' => $order->id,
                    'exception' => $exception::class,
                    'message' => $exception->getMessage(),
                ]);

                abort(503, 'Status pembayaran belum dapat dipastikan. Coba generate QRIS kembali sebentar lagi.');
            }

            if ($providerStatus === 'paid') {
                $this->syncQrisPaymentStatus($order, $providerStatus);

                return redirect()->route('checkout.show', ['order' => $order->order_number]);
            }

            if ($order->qris_payment_status === 'unpaid' && ! $isExpiredByTime && $providerStatus === 'unpaid') {
                abort(409);
            }
        }

        try {
            $qris = $qrisly->generate($order);
            $order->update([
                'qrisly_history_id' => $qris['history_id'],
                'qris_string' => $qris['qris_string'],
                'qris_original_amount' => $qris['original_amount'],
                'qris_final_amount' => $qris['final_amount'],
                'qris_payment_status' => $qris['payment_status'],
                'qris_expiry_time' => $qris['expiry_time'],
            ]);
        } catch (Throwable $exception) {
            Log::warning('QRISLY QRIS regeneration failed.', [
                'order_id' => $order->id,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);
            $order->update(['qris_payment_status' => 'failed']);
        }

        return redirect()->route('checkout.show')->with('order_number', $order->order_number);
    }

    private function syncQrisPaymentStatus(Order $order, string $status): Order
    {
        return DB::transaction(function () use ($order, $status): Order {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);

            if (in_array($lockedOrder->status, ['cancelled', 'rejected'], true)) {
                if ($status === 'paid') {
                    $lockedOrder->update(['qris_payment_status' => 'paid']);
                    Log::warning('QRIS payment was received after the order was cancelled.', [
                        'order_id' => $lockedOrder->id,
                        'order_number' => $lockedOrder->order_number,
                    ]);
                }

                return $lockedOrder;
            }

            $updates = ['qris_payment_status' => $status];
            if ($status === 'paid' && $lockedOrder->status === 'pending_payment') {
                if (! $lockedOrder->stock_deducted) {
                    $lockedOrder->load('items');
                    $quantitiesByVariant = $lockedOrder->items
                        ->whereNotNull('variant_id')
                        ->groupBy('variant_id')
                        ->map(fn ($items): int => $items->sum('qty'));
                    $variants = ProductVariant::query()
                        ->whereIn('id', $quantitiesByVariant->keys())
                        ->orderBy('id')
                        ->lockForUpdate()
                        ->get()
                        ->keyBy('id');
                    $hasAvailableStock = $variants->count() === $quantitiesByVariant->count();

                    foreach ($quantitiesByVariant as $variantId => $quantity) {
                        if (($variants->get((int) $variantId)?->stock ?? 0) < $quantity) {
                            $hasAvailableStock = false;
                            break;
                        }
                    }

                    if ($hasAvailableStock) {
                        foreach ($quantitiesByVariant as $variantId => $quantity) {
                            $variants->get((int) $variantId)->decrement('stock', $quantity);
                        }
                        $updates['stock_deducted'] = true;
                        $updates['status'] = 'processing';
                    } else {
                        $updates['status'] = 'paid';
                        Log::warning('Paid QRIS order has insufficient stock for automatic processing.', [
                            'order_id' => $lockedOrder->id,
                            'order_number' => $lockedOrder->order_number,
                        ]);
                    }

                    CartItem::query()->where('user_id', $lockedOrder->user_id)
                        ->whereIn('product_variant_id', $quantitiesByVariant->keys())
                        ->delete();
                } else {
                    $updates['status'] = 'processing';
                }
            }

            $lockedOrder->update($updates);

            return $lockedOrder;
        });
    }

    private function restoreOrderStock(Order $order): void
    {
        $quantitiesByVariant = $order->items
            ->whereNotNull('variant_id')
            ->groupBy('variant_id')
            ->map(fn ($items): int => $items->sum('qty'));
        $variants = ProductVariant::query()
            ->whereIn('id', $quantitiesByVariant->keys())
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        foreach ($quantitiesByVariant as $variantId => $quantity) {
            $variants->get((int) $variantId)?->increment('stock', $quantity);
        }
    }
}
