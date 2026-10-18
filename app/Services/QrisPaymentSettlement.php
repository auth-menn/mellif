<?php

namespace App\Services;

use App\Mail\OrderPaymentConfirmed;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class QrisPaymentSettlement
{
    public function synchronize(Order $order, string $status, string $event = 'payment.status'): Order
    {
        $paymentWasConfirmed = false;
        $settledOrder = DB::transaction(function () use ($order, $status, $event, &$paymentWasConfirmed): Order {
            $lockedOrder = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);

            if ($status === 'paid') {
                $variantIds = $lockedOrder->items->pluck('variant_id')->filter()->unique();
                if ($variantIds->isNotEmpty()) {
                    CartItem::query()->where('user_id', $lockedOrder->user_id)
                        ->whereIn('product_variant_id', $variantIds)
                        ->delete();
                }
            }

            if ($lockedOrder->qris_payment_status === 'paid' && $status !== 'paid') {
                return $lockedOrder;
            }

            if (in_array($lockedOrder->status, ['cancelled', 'rejected'], true)) {
                if ($status === 'paid' && $lockedOrder->qris_payment_status !== 'paid') {
                    $lockedOrder->update(['qris_payment_status' => 'paid']);
                    $paymentWasConfirmed = true;
                    Log::warning('QRIS payment received after order cancellation.', [
                        'event' => $event,
                        'order_id' => $lockedOrder->id,
                        'history_id' => $lockedOrder->qrisly_history_id,
                        'decision' => 'paid_after_cancellation_manual_review',
                    ]);
                }

                return $lockedOrder;
            }

            if ($status !== 'paid' || $lockedOrder->qris_payment_status === 'paid') {
                $lockedOrder->update(['qris_payment_status' => $status]);

                return $lockedOrder;
            }

            $updates = ['qris_payment_status' => 'paid'];

            if ($lockedOrder->status === 'pending_payment' && ! $lockedOrder->stock_deducted) {
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
                    Log::warning('Paid QRIS order requires manual stock review.', [
                        'event' => $event,
                        'order_id' => $lockedOrder->id,
                        'history_id' => $lockedOrder->qrisly_history_id,
                        'decision' => 'paid_insufficient_stock_manual_review',
                    ]);
                }

            } elseif ($lockedOrder->status === 'pending_payment') {
                $updates['status'] = 'processing';
            }

            $lockedOrder->update($updates);
            $paymentWasConfirmed = true;

            return $lockedOrder;
        });

        Cache::forget(self::statusCacheKey($order));

        if ($paymentWasConfirmed) {
            $this->notifyPaymentConfirmed($settledOrder->load(['user', 'items']));
        }

        return $settledOrder;
    }

    private function notifyPaymentConfirmed(Order $order): void
    {
        $recipients = [
            [config('mail.order_notification_email'), true],
            [$order->user?->email, false],
        ];

        foreach ($recipients as [$email, $forAdmin]) {
            if (! is_string($email) || trim($email) === '') {
                continue;
            }

            try {
                Mail::to($email)->queue(new OrderPaymentConfirmed($order, $forAdmin));
            } catch (Throwable $exception) {
                Log::warning('Order payment confirmation email could not be queued.', [
                    'order_id' => $order->id,
                    'recipient_type' => $forAdmin ? 'admin' : 'customer',
                    'exception' => $exception::class,
                ]);
            }
        }
    }

    public function cancelPendingOrder(Order $order): Order
    {
        $cancelledOrder = DB::transaction(function () use ($order): Order {
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

            return $lockedOrder;
        });

        Cache::forget(self::statusCacheKey($order));

        return $cancelledOrder;
    }

    public static function statusCacheKey(Order $order): string
    {
        return 'qrisly:payment-status:'.$order->id.':'.$order->qrisly_history_id;
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
