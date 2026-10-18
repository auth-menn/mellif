<?php

use App\Models\CartItem;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** @return array{order: Order, variant: ProductVariant, owner: User} */
function makeQrisWebhookOrder(
    int $historyId = 8801,
    int $stock = 5,
    int $quantity = 1,
    string $status = 'pending_payment',
    string $paymentStatus = 'unpaid',
): array {
    $owner = User::factory()->create();
    $category = Category::query()->create([
        'name' => 'QRIS webhook '.$historyId,
        'slug' => 'qris-webhook-'.$historyId,
    ]);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Webhook product',
        'slug' => 'qris-webhook-product-'.$historyId,
        'description' => 'Webhook test product',
        'price' => 100000,
        'is_active' => true,
    ]);
    $variant = ProductVariant::query()->create([
        'product_id' => $product->id,
        'size' => 'M',
        'stock' => $stock,
    ]);
    $order = Order::query()->create([
        'user_id' => $owner->id,
        'order_number' => 'MLF-WEBHOOK-'.$historyId,
        'recipient_name' => 'Webhook buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 0,
        'payment_method' => 'QRIS',
        'payment_method_code' => 'qris',
        'subtotal' => 100000 * $quantity,
        'total' => 100000 * $quantity,
        'status' => $status,
        'stock_deducted' => false,
        'qrisly_history_id' => $historyId,
        'qris_string' => '0002010102112661006299VALID_QRIS_PAYLOAD540410016304E8E2',
        'qris_original_amount' => 100000 * $quantity,
        'qris_final_amount' => 100001 * $quantity,
        'qris_payment_status' => $paymentStatus,
    ]);
    $order->items()->create([
        'product_id' => $product->id,
        'variant_id' => $variant->id,
        'product_name' => $product->name,
        'size' => $variant->size,
        'qty' => $quantity,
        'unit_price' => 100000,
    ]);

    return compact('order', 'variant', 'owner');
}

function configureQrisWebhook(string $token = 'test-webhook-token'): void
{
    config([
        'services.qrisly.webhook_token' => $token,
        'services.qrisly.key' => 'test-qrisly-key',
        'services.qrisly.base_url' => 'https://api-sandbox.collaborator.komerce.id/user',
    ]);
}

function qrisWebhookUrl(string $token = 'test-webhook-token'): string
{
    return route('webhooks.qrisly', ['token' => $token]);
}

function qrisProviderStatusResponse(int $historyId, string $status): array
{
    return [
        'meta' => ['status' => 'success', 'code' => 200],
        'data' => ['history_id' => $historyId, 'payment_status' => $status],
    ];
}

it('returns 404 when the webhook token is wrong or not configured', function () {
    Http::preventStrayRequests();
    configureQrisWebhook();

    $this->postJson(qrisWebhookUrl('wrong-token'), [])->assertNotFound();

    config(['services.qrisly.webhook_token' => '']);
    $this->postJson(qrisWebhookUrl(), [])->assertNotFound();
});

it('ignores malformed webhook events and unknown history IDs without contacting QRISLY', function () {
    Http::preventStrayRequests();
    configureQrisWebhook();

    $this->postJson(qrisWebhookUrl(), ['event' => 'payment.failed', 'data' => ['history_id' => 1]])
        ->assertOk()
        ->assertExactJson(['success' => true, 'message' => 'ignored']);
    $this->postJson(qrisWebhookUrl(), ['event' => 'payment.success', 'data' => ['history_id' => '999999']])
        ->assertOk()
        ->assertExactJson(['success' => true, 'message' => 'ignored']);
});

it('does not settle a forged paid webhook when QRISLY status remains unpaid', function () {
    Http::preventStrayRequests();
    configureQrisWebhook();
    $context = makeQrisWebhookOrder();
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8801' => Http::response(qrisProviderStatusResponse(8801, 'unpaid')),
    ]);

    $this->postJson(qrisWebhookUrl(), [
        'event' => 'payment.success',
        'data' => ['qris_history_id' => '8801', 'status' => 'paid', 'amount' => 100001],
    ])->assertOk()->assertExactJson([
        'success' => true,
        'message' => 'Webhook received and processed',
    ]);

    $this->assertDatabaseHas('orders', [
        'id' => $context['order']->id,
        'status' => 'pending_payment',
        'qris_payment_status' => 'unpaid',
        'stock_deducted' => false,
    ]);
    expect($context['variant']->fresh()->stock)->toBe(5);
});

it('settles a verified payment once when the webhook is delivered twice', function () {
    Http::preventStrayRequests();
    configureQrisWebhook();
    $context = makeQrisWebhookOrder();
    CartItem::query()->create([
        'user_id' => $context['owner']->id,
        'product_variant_id' => $context['variant']->id,
        'quantity' => 1,
    ]);
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8801' => Http::response(qrisProviderStatusResponse(8801, 'paid')),
    ]);

    $payload = ['event' => 'payment.success', 'data' => ['history_id' => 8801, 'amount' => 100001]];
    $this->postJson(qrisWebhookUrl(), $payload)->assertOk();
    $this->postJson(qrisWebhookUrl(), $payload)->assertOk();

    $this->assertDatabaseHas('orders', [
        'id' => $context['order']->id,
        'status' => 'processing',
        'qris_payment_status' => 'paid',
        'stock_deducted' => true,
    ]);
    expect($context['variant']->fresh()->stock)->toBe(4);
    $this->assertDatabaseMissing('cart_items', [
        'user_id' => $context['owner']->id,
        'product_variant_id' => $context['variant']->id,
    ]);
    Http::assertSentCount(2);
});

it('keeps polling and webhook settlement idempotent for the same paid order', function () {
    Http::preventStrayRequests();
    configureQrisWebhook();
    $context = makeQrisWebhookOrder();
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8801' => Http::response(qrisProviderStatusResponse(8801, 'paid')),
    ]);

    $this->actingAs($context['owner'])
        ->getJson(route('checkout.orders.qris-status', $context['order']))
        ->assertOk();
    $this->postJson(qrisWebhookUrl(), [
        'event' => 'payment.success',
        'data' => ['history_id' => 8801, 'amount' => 100001],
    ])->assertOk();

    $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'processing', 'stock_deducted' => true]);
    expect($context['variant']->fresh()->stock)->toBe(4);
});

it('marks a provider-verified expired QRIS as expired without restoring stock that was never deducted', function () {
    Http::preventStrayRequests();
    configureQrisWebhook();
    $context = makeQrisWebhookOrder();
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8801' => Http::response(qrisProviderStatusResponse(8801, 'expired')),
    ]);

    $this->postJson(qrisWebhookUrl(), [
        'event' => 'payment.expired',
        'data' => ['qris_history_id' => 8801, 'status' => 'expired'],
    ])->assertOk();

    $this->assertDatabaseHas('orders', [
        'id' => $context['order']->id,
        'status' => 'pending_payment',
        'qris_payment_status' => 'expired',
        'stock_deducted' => false,
    ]);
    expect($context['variant']->fresh()->stock)->toBe(5);
});

it('records payment after cancellation and exposes the order for manual review', function () {
    Http::preventStrayRequests();
    configureQrisWebhook();
    $context = makeQrisWebhookOrder(status: 'cancelled', paymentStatus: 'cancelled');
    CartItem::query()->create([
        'user_id' => $context['owner']->id,
        'product_variant_id' => $context['variant']->id,
        'quantity' => 1,
    ]);
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8801' => Http::response(qrisProviderStatusResponse(8801, 'paid')),
    ]);

    $this->postJson(qrisWebhookUrl(), [
        'event' => 'payment.success',
        'data' => ['history_id' => 8801, 'status' => 'paid', 'amount' => 100001],
    ])->assertOk();

    $this->assertDatabaseHas('orders', [
        'id' => $context['order']->id,
        'status' => 'cancelled',
        'qris_payment_status' => 'paid',
        'stock_deducted' => false,
    ]);
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();
    config(['inertia.ssr.enabled' => false]);
    $this->actingAs($admin)->get(route('admin.dashboard'))->assertOk()
        ->assertInertia(fn ($page) => $page->where('manualReviewOrders.0.reason', 'paid_after_cancellation'));
    expect($context['variant']->fresh()->stock)->toBe(5);
    $this->assertDatabaseMissing('cart_items', [
        'user_id' => $context['owner']->id,
        'product_variant_id' => $context['variant']->id,
    ]);
});

it('sends a paid order with insufficient stock to manual review', function () {
    Http::preventStrayRequests();
    configureQrisWebhook();
    $context = makeQrisWebhookOrder(stock: 0);
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8801' => Http::response(qrisProviderStatusResponse(8801, 'paid')),
    ]);

    $this->postJson(qrisWebhookUrl(), [
        'event' => 'payment.success',
        'data' => ['history_id' => 8801, 'status' => 'paid', 'amount' => 100001],
    ])->assertOk();

    $this->assertDatabaseHas('orders', [
        'id' => $context['order']->id,
        'status' => 'paid',
        'qris_payment_status' => 'paid',
        'stock_deducted' => false,
    ]);
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();
    config(['inertia.ssr.enabled' => false]);
    $this->actingAs($admin)->get(route('admin.dashboard'))->assertOk()
        ->assertInertia(fn ($page) => $page->where('manualReviewOrders.0.reason', 'insufficient_stock'));
});

it('returns 503 and leaves the order unchanged when provider status cannot be checked', function () {
    Http::preventStrayRequests();
    configureQrisWebhook();
    $context = makeQrisWebhookOrder();
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8801' => Http::response([], 503),
    ]);

    $this->postJson(qrisWebhookUrl(), [
        'event' => 'payment.success',
        'data' => ['history_id' => 8801, 'status' => 'paid'],
    ])->assertServiceUnavailable();

    $this->assertDatabaseHas('orders', [
        'id' => $context['order']->id,
        'status' => 'pending_payment',
        'qris_payment_status' => 'unpaid',
        'stock_deducted' => false,
    ]);
    expect($context['variant']->fresh()->stock)->toBe(5);
});

it('logs only safe identifiers and records a payload amount mismatch without trusting it', function () {
    Http::preventStrayRequests();
    configureQrisWebhook();
    $context = makeQrisWebhookOrder();
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8801' => Http::response(qrisProviderStatusResponse(8801, 'unpaid')),
    ]);
    Log::spy();

    $this->postJson(qrisWebhookUrl(), [
        'event' => 'payment.success',
        'data' => [
            'history_id' => 8801,
            'status' => 'paid',
            'amount' => 2,
            'qris_string' => 'DO_NOT_LOG_QRIS_STRING',
        ],
    ])->assertOk();

    Log::shouldHaveReceived('warning')->withArgs(function (string $message, array $context): bool {
        return $message === 'QRISLY webhook amount differs from stored amount; verifying with provider status.'
            && array_keys($context) === ['event', 'order_id', 'history_id', 'decision']
            && $context['decision'] === 'amount_mismatch_ignored';
    });
    Log::shouldHaveReceived('info')->withArgs(function (string $message, array $context): bool {
        return $message === 'QRISLY webhook processed.'
            && array_keys($context) === ['event', 'order_id', 'history_id', 'decision'];
    });
    $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'qris_payment_status' => 'unpaid']);
});

it('does not expose the raw QRIS string in Inertia page props', function () {
    $context = makeQrisWebhookOrder();
    $this->actingAs($context['owner'])
        ->get(route('checkout.show', ['order' => $context['order']->order_number]))
        ->assertInertia(fn ($page) => $page
            ->missing('order.qrisString')
            ->where('order.hasQris', true)
            ->where('order.qrisImage', fn ($image): bool => is_string($image) && str_starts_with($image, 'data:image/svg+xml;base64,')));
});
