<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\QrislyService;
use App\Services\QrisPaymentSettlement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class QrislyWebhookController extends Controller
{
    public function __invoke(
        Request $request,
        string $token,
        QrislyService $qrisly,
        QrisPaymentSettlement $settlement,
    ): JsonResponse {
        $configuredToken = trim((string) config('services.qrisly.webhook_token'));
        if ($configuredToken === '' || ! hash_equals($configuredToken, $token)) {
            abort(404);
        }

        $event = $request->input('event');
        $historyId = $request->input('data.qris_history_id', $request->input('data.history_id'));

        if (! in_array($event, ['payment.success', 'payment.expired'], true)
            || (! is_string($historyId) && ! is_int($historyId))
            || trim((string) $historyId) === ''
            || strlen((string) $historyId) > 64) {
            return $this->ignored();
        }

        $order = Order::query()
            ->where('payment_method_code', 'qris')
            ->where('qrisly_history_id', (string) $historyId)
            ->first();

        if (! $order) {
            Log::info('QRISLY webhook ignored.', [
                'event' => $event,
                'order_id' => null,
                'history_id' => (string) $historyId,
                'decision' => 'order_not_found',
            ]);

            return $this->ignored();
        }

        $payloadAmount = $request->input('data.amount');
        if (is_numeric($payloadAmount)
            && $order->qris_final_amount !== null
            && (int) $payloadAmount !== $order->qris_final_amount) {
            Log::warning('QRISLY webhook amount differs from stored amount; verifying with provider status.', [
                'event' => $event,
                'order_id' => $order->id,
                'history_id' => (string) $historyId,
                'decision' => 'amount_mismatch_ignored',
            ]);
        }

        try {
            $status = $qrisly->paymentStatus((int) $order->qrisly_history_id);
        } catch (Throwable) {
            Log::warning('QRISLY webhook status verification failed.', [
                'event' => $event,
                'order_id' => $order->id,
                'history_id' => (string) $historyId,
                'decision' => 'provider_unavailable_retry',
            ]);

            return response()->json(['success' => false, 'message' => 'Payment status verification unavailable.'], 503);
        }

        $settlement->synchronize($order, $status, $event);
        Cache::forget(QrisPaymentSettlement::statusCacheKey($order));

        Log::info('QRISLY webhook processed.', [
            'event' => $event,
            'order_id' => $order->id,
            'history_id' => (string) $historyId,
            'decision' => 'provider_status_'.$status,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Webhook received and processed',
        ]);
    }

    private function ignored(): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'ignored']);
    }
}
