<?php

namespace App\Http\Controllers;

use App\Http\Requests\PlaceOrderRequest;
use App\Mail\OrderPlaced;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentMethod;
use App\Models\ShippingCourier;
use App\Services\CheckoutItemsService;
use App\Services\QrislyService;
use App\Services\QrisPaymentSettlement;
use App\Services\ShippingRateException;
use App\Services\ShippingRateService;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
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
            ? Order::query()->with('items.product.images')->whereBelongsTo($request->user())->where('order_number', $orderNumber)->first()
            : null;

        return Inertia::render('store/checkout', [
            'paymentMethods' => PaymentMethod::query()
                ->where('is_active', true)
                ->where('code', 'qris')
                ->get(['id', 'name', 'code']),
            'order' => $order ? [
                'id' => $order->id,
                'orderNumber' => $order->order_number,
                'status' => $order->status,
                'total' => $order->total,
                'subtotal' => $order->subtotal,
                'shippingCost' => $order->shipping_cost,
                'shippingCourier' => $order->shipping_courier,
                'shippingService' => $order->shipping_service,
                'items' => $order->items->map(function (OrderItem $item): array {
                    $imagePath = $item->product?->images->first()?->path;

                    return [
                        'name' => $item->product_name,
                        'size' => $item->size,
                        'quantity' => $item->qty,
                        'unitPrice' => $item->unit_price,
                        'imageUrl' => $imagePath ? asset('storage/'.$imagePath) : null,
                    ];
                })->all(),
                'paymentMethodCode' => $order->payment_method_code,
                'hasQris' => $order->qrisly_history_id !== null,
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
        $isDirectCod = $data['delivery_method'] === 'direct_cod';
        $rate = [
            'name' => 'COD',
            'code' => null,
            'service' => null,
            'etd' => null,
            'cost' => 0,
        ];
        $destinationLabel = $isDirectCod ? 'COD' : null;

        if (! $isDirectCod) {
            $courierCodes = ShippingCourier::activeCodes();
            if ($courierCodes === []) {
                throw ValidationException::withMessages(['courier_code' => 'Ekspedisi belum tersedia. Silakan hubungi kami.']);
            }

            try {
                $shippingRate = $shippingRates->findRate(
                    (int) $data['destination_id'],
                    $shippingRates->weightFor($rateVariants, $quantitiesByVariant),
                    $courierCodes,
                    $data['courier_code'],
                    $data['courier_service'],
                );
            } catch (ShippingRateException $exception) {
                throw ValidationException::withMessages(['destination_id' => $exception->getMessage()]);
            }
            if (! $shippingRate) {
                throw ValidationException::withMessages(['courier_service' => 'Layanan ongkir ini sudah tidak tersedia. Pilih layanan lain.']);
            }
            if ((int) $data['expected_shipping_cost'] !== $shippingRate['cost']) {
                throw ValidationException::withMessages(['courier_service' => 'Ongkir berubah, silakan periksa total.']);
            }

            $rate = $shippingRate;
            $destinationLabel = $shippingRates->destinationLabel((int) $data['destination_id'])
                ?? mb_substr(trim(strip_tags($data['destination_label'])), 0, 255);
        }

        $order = DB::transaction(function () use ($data, $request, $items, $quantitiesByVariant, $rate, $destinationLabel, $checkoutItems, $isDirectCod): Order {
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
                'destination_id' => $isDirectCod ? null : $data['destination_id'], 'destination_label' => $destinationLabel,
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
                $this->storeGeneratedQris($order, $qris);
            } catch (Throwable $exception) {
                Log::warning('QRISLY QRIS generation failed.', [
                    'event' => 'payment.generation',
                    'order_id' => $order->id,
                    'history_id' => $order->qrisly_history_id,
                    'decision' => 'generation_failed:'.$exception::class,
                    'failure_reason' => $this->qrisGenerationFailureReason($exception),
                ]);
                $this->markQrisGenerationFailed($order);
            }
        }

        $this->queueOrderNotifications($order->load(['user', 'items']));

        return redirect()->route('checkout.show')->with('order_number', $order->order_number);
    }

    private function queueOrderNotifications(Order $order): void
    {
        $recipients = [
            [config('mail.order_notification_email'), true],
            [$order->user->email, false],
        ];

        foreach ($recipients as [$email, $forAdmin]) {
            try {
                Mail::to($email)->queue(new OrderPlaced($order, $forAdmin));
            } catch (Throwable $exception) {
                Log::warning('Order email notification could not be queued.', [
                    'order_id' => $order->id,
                    'recipient_type' => $forAdmin ? 'admin' : 'customer',
                    'exception' => $exception::class,
                ]);
            }
        }
    }

    public function paymentStatus(Request $request, Order $order, QrislyService $qrisly, QrisPaymentSettlement $settlement): JsonResponse
    {
        abort_unless($request->user()?->is($order->user), 404);
        abort_if($order->payment_method_code !== 'qris' || ! $order->qrisly_history_id, 404);

        try {
            $status = Cache::remember(QrisPaymentSettlement::statusCacheKey($order), now()->addSeconds(7), function () use ($qrisly, $settlement, $order): string {
                $status = $qrisly->paymentStatus((int) $order->qrisly_history_id);
                $settlement->synchronize($order, $status, 'payment.polling');

                return $status;
            });
        } catch (Throwable) {
            return response()->json(['message' => 'Status pembayaran belum dapat diperbarui.'], 503);
        }

        return response()->json(['payment_status' => $status]);
    }

    public function cancelQrisPayment(Request $request, Order $order, QrislyService $qrisly, QrisPaymentSettlement $settlement): RedirectResponse
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
                ]);

                abort(503, 'Status pembayaran belum dapat dipastikan. Coba batalkan kembali sebentar lagi.');
            }

            if ($providerStatus === 'paid') {
                $settlement->synchronize($order, $providerStatus, 'payment.cancel_check');

                return redirect()->route('checkout.show', ['order' => $order->order_number]);
            }
        }

        $settlement->cancelPendingOrder($order);

        return redirect()->route('checkout.show');
    }

    public function regenerateQris(Request $request, Order $order, QrislyService $qrisly, QrisPaymentSettlement $settlement): RedirectResponse
    {
        abort_unless($request->user()?->is($order->user), 404);
        abort_unless($order->payment_method_code === 'qris', 404);

        try {
            return Cache::lock('qrisly:regenerate:'.$order->id, 45)->block(3, function () use ($order, $qrisly, $settlement): RedirectResponse {
                $currentOrder = Order::query()->findOrFail($order->id);
                abort_unless($currentOrder->payment_method_code === 'qris', 404);
                abort_unless($currentOrder->status === 'pending_payment', 409);

                $canRegenerate = in_array($currentOrder->qris_payment_status, ['failed', 'expired', 'cancelled'], true);
                $hasActiveQr = $currentOrder->qris_payment_status === 'unpaid'
                    && $currentOrder->qrisly_history_id !== null;
                abort_unless($canRegenerate || $hasActiveQr, 409);

                if ($currentOrder->qrisly_history_id) {
                    try {
                        $providerStatus = $qrisly->paymentStatus((int) $currentOrder->qrisly_history_id);
                    } catch (Throwable) {
                        Log::warning('QRIS payment status could not be verified before regeneration.', [
                            'event' => 'payment.regeneration_check',
                            'order_id' => $currentOrder->id,
                            'history_id' => $currentOrder->qrisly_history_id,
                            'decision' => 'retry_later',
                        ]);

                        abort(503, 'Status pembayaran belum dapat dipastikan. Coba generate QRIS kembali sebentar lagi.');
                    }

                    if ($providerStatus === 'paid') {
                        $settlement->synchronize($currentOrder, $providerStatus, 'payment.regeneration_check');

                        return redirect()->route('checkout.show', ['order' => $currentOrder->order_number]);
                    }

                    if ($providerStatus === 'unpaid') {
                        $settlement->synchronize($currentOrder, $providerStatus, 'payment.regeneration_check');

                        return redirect()->route('checkout.show', ['order' => $currentOrder->order_number]);
                    }

                    if (! $canRegenerate && ! in_array($providerStatus, ['expired', 'cancelled'], true)) {
                        abort(409);
                    }
                }

                $shouldGenerate = DB::transaction(function () use ($currentOrder): bool {
                    $lockedOrder = Order::query()->lockForUpdate()->findOrFail($currentOrder->id);
                    abort_unless($lockedOrder->status === 'pending_payment', 409);

                    if ($lockedOrder->qris_payment_status === 'paid') {
                        return false;
                    }

                    abort_unless($lockedOrder->qris_regeneration_count < 3, 429);
                    $lockedOrder->increment('qris_regeneration_count');

                    return true;
                });

                if (! $shouldGenerate) {
                    return redirect()->route('checkout.show', ['order' => $currentOrder->order_number]);
                }

                try {
                    $qris = $qrisly->generate($currentOrder);
                    $this->storeGeneratedQris($currentOrder, $qris);
                } catch (Throwable $exception) {
                    Log::warning('QRISLY QRIS regeneration failed.', [
                        'event' => 'payment.regeneration',
                        'order_id' => $currentOrder->id,
                        'history_id' => $currentOrder->qrisly_history_id,
                        'decision' => 'generation_failed:'.$exception::class,
                        'failure_reason' => $this->qrisGenerationFailureReason($exception),
                    ]);
                    $this->markQrisGenerationFailed($currentOrder);
                }

                Cache::forget(QrisPaymentSettlement::statusCacheKey($currentOrder));

                return redirect()->route('checkout.show')->with('order_number', $currentOrder->order_number);
            });
        } catch (LockTimeoutException) {
            abort(409, 'Permintaan QRIS sedang diproses. Coba kembali sebentar lagi.');
        }
    }

    /** @param array{history_id: int, qris_string: string, original_amount: int, final_amount: int, payment_status: string, expiry_time: string} $qris */
    private function storeGeneratedQris(Order $order, array $qris): void
    {
        DB::transaction(function () use ($order, $qris): void {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            if ($lockedOrder->qris_payment_status === 'paid') {
                return;
            }

            $lockedOrder->update([
                'qrisly_history_id' => $qris['history_id'],
                'qris_string' => $qris['qris_string'],
                'qris_original_amount' => $qris['original_amount'],
                'qris_final_amount' => $qris['final_amount'],
                'qris_payment_status' => $qris['payment_status'],
                'qris_expiry_time' => $qris['expiry_time'],
            ]);
        });
    }

    private function markQrisGenerationFailed(Order $order): void
    {
        DB::transaction(function () use ($order): void {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            if ($lockedOrder->qris_payment_status !== 'paid') {
                $lockedOrder->update(['qris_payment_status' => 'failed']);
            }
        });
    }

    private function qrisGenerationFailureReason(Throwable $exception): string
    {
        if ($exception instanceof RequestException) {
            return 'provider_http_'.$exception->response->status();
        }

        if ($exception instanceof ConnectionException) {
            return 'provider_connection_error';
        }

        if ($exception instanceof \RuntimeException) {
            return match ($exception->getMessage()) {
                'QRISLY is not configured.' => 'qrisly_not_configured',
                'QRISLY requires an HTTPS base URL.' => 'invalid_provider_url',
                'Order total is outside QRISLY limits.' => 'amount_out_of_range',
                'QRISLY returned an invalid QRIS response.' => 'invalid_provider_response',
                'QRISLY returned an amount that does not match the order total.' => 'amount_mismatch',
                'QRISLY returned an unusable QRIS payload.' => 'invalid_qris_payload',
                'QRIS payload amount does not match provider final amount.' => 'qris_payload_amount_mismatch',
                default => 'runtime_exception',
            };
        }

        return class_basename($exception);
    }
}
