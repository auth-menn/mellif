<?php

use App\Models\Category;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingCourier;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/** @return array{owner: User, order: Order} */
function makeCheckoutQrisOrder(string $orderNumber, array $attributes = []): array
{
    $owner = User::factory()->create();
    $order = Order::query()->create(array_merge([
        'user_id' => $owner->id,
        'order_number' => $orderNumber,
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 0,
        'payment_method' => 'QRIS',
        'payment_method_code' => 'qris',
        'subtotal' => 100000,
        'total' => 100000,
        'status' => 'pending_payment',
        'qrisly_history_id' => 8759,
        'qris_payment_status' => 'expired',
        'qris_expiry_time' => now()->subMinute(),
    ], $attributes));

    return compact('owner', 'order');
}

it('confirms QRIS payment status only for the order owner', function () {
    Http::preventStrayRequests();
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8759' => Http::response([
            'meta' => ['status' => 'success', 'code' => 200],
            'data' => ['history_id' => 8759, 'payment_status' => 'paid', 'amount' => 318001],
        ]),
    ]);
    config([
        'services.qrisly.key' => 'test-qrisly-key',
        'services.qrisly.base_url' => 'https://api-sandbox.collaborator.komerce.id/user',
    ]);
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $order = Order::query()->create([
        'user_id' => $owner->id,
        'order_number' => 'MLF-QRIS-OWNER',
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 18000,
        'payment_method' => 'QRIS',
        'payment_method_code' => 'qris',
        'subtotal' => 300000,
        'total' => 318000,
        'status' => 'pending_payment',
        'qrisly_history_id' => 8759,
        'qris_string' => 'qris-payload',
        'qris_original_amount' => 318000,
        'qris_final_amount' => 318001,
        'qris_payment_status' => 'unpaid',
    ]);

    $this->actingAs($otherUser)->getJson(route('checkout.orders.qris-status', $order))->assertNotFound();

    $this->actingAs($owner)->getJson(route('checkout.orders.qris-status', $order))
        ->assertOk()
        ->assertExactJson(['payment_status' => 'paid']);

    $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'processing', 'qris_payment_status' => 'paid']);
    Http::assertSent(fn ($request): bool => $request->url() === 'https://api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8759'
        && $request->hasHeader('X-API-Key', 'test-qrisly-key'));
});

it('generates a replacement QRIS for an expired order', function () {
    Http::preventStrayRequests();
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8759' => Http::response([
            'meta' => ['status' => 'success', 'code' => 200],
            'data' => ['history_id' => 8759, 'payment_status' => 'expired'],
        ]),
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/generate-qris' => Http::response([
            'meta' => ['status' => 'success', 'code' => 200],
            'data' => [
                'history_id' => 8760,
                'qris_string' => 'replacement-qris-payload',
                'original_amount' => 118000,
                'final_amount' => 118002,
                'payment_status' => 'unpaid',
                'expiry_time' => '2026-10-14 12:15:00',
            ],
        ]),
    ]);
    config([
        'services.qrisly.key' => 'test-qrisly-key',
        'services.qrisly.qris_id' => 123,
        'services.qrisly.base_url' => 'https://api-sandbox.collaborator.komerce.id/user',
    ]);
    $owner = User::factory()->create();
    $order = Order::query()->create([
        'user_id' => $owner->id,
        'order_number' => 'MLF-QRIS-EXPIRED',
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 18000,
        'payment_method' => 'QRIS',
        'payment_method_code' => 'qris',
        'subtotal' => 100000,
        'total' => 118000,
        'status' => 'pending_payment',
        'qrisly_history_id' => 8759,
        'qris_payment_status' => 'expired',
    ]);

    $this->actingAs($owner)->post(route('checkout.orders.qris.regenerate', $order))
        ->assertRedirect(route('checkout.show'));

    $this->assertDatabaseHas('orders', [
        'id' => $order->id,
        'qrisly_history_id' => 8760,
        'qris_string' => 'replacement-qris-payload',
        'qris_final_amount' => 118002,
        'qris_payment_status' => 'unpaid',
    ]);
});

it('does not store the provider placeholder as a QRIS payment code', function () {
    Http::preventStrayRequests();
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8759' => Http::response([
            'meta' => ['status' => 'success', 'code' => 200],
            'data' => ['history_id' => 8759, 'payment_status' => 'expired'],
        ]),
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/generate-qris' => Http::response([
            'meta' => ['status' => 'success', 'code' => 200],
            'data' => [
                'history_id' => 8761,
                'qris_string' => '0002010102112661006299INVALID_DATA540410016304E8E2',
                'original_amount' => 118000,
                'final_amount' => 118001,
                'payment_status' => 'unpaid',
                'expiry_time' => '2026-10-14 12:15:00',
            ],
        ]),
    ]);
    config([
        'services.qrisly.key' => 'test-qrisly-key',
        'services.qrisly.qris_id' => 123,
        'services.qrisly.base_url' => 'https://api-sandbox.collaborator.komerce.id/user',
    ]);
    $owner = User::factory()->create();
    $order = Order::query()->create([
        'user_id' => $owner->id,
        'order_number' => 'MLF-QRIS-INVALID',
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 18000,
        'payment_method' => 'QRIS',
        'payment_method_code' => 'qris',
        'subtotal' => 100000,
        'total' => 118000,
        'status' => 'pending_payment',
        'qris_payment_status' => 'expired',
    ]);

    $this->actingAs($owner)->post(route('checkout.orders.qris.regenerate', $order))
        ->assertRedirect(route('checkout.show'));

    $this->assertDatabaseHas('orders', [
        'id' => $order->id,
        'qris_payment_status' => 'failed',
        'qris_string' => null,
    ]);
});

it('rejects QRIS orders below the provider minimum before reserving stock', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*destination/domestic-destination*' => Http::response([
            'meta' => ['status' => 'success', 'code' => 200],
            'data' => [['id' => 1376, 'label' => 'Jakarta Selatan, DKI Jakarta']],
        ]),
        '*calculate/domestic-cost' => Http::response([
            'meta' => ['status' => 'success', 'code' => 200],
            'data' => [['name' => 'JNE', 'code' => 'jne', 'service' => 'REG', 'cost' => 0, 'etd' => '2-3']],
        ]),
    ]);
    config(['services.rajaongkir.key' => 'test-rajaongkir-key', 'services.rajaongkir.origin_id' => 1391]);
    $user = User::factory()->create();
    $category = Category::query()->create(['name' => 'Accessory', 'slug' => 'qris-minimum']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Low-priced item',
        'slug' => 'low-priced-item',
        'description' => 'Test item',
        'price' => 500,
        'is_active' => true,
    ]);
    $variant = ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'One Size', 'stock' => 1]);
    ShippingCourier::query()->create(['name' => 'JNE', 'code' => 'jne', 'flat_cost' => 0, 'is_active' => true]);
    $payment = PaymentMethod::query()->create(['name' => 'QRIS', 'code' => 'qris', 'is_active' => true]);

    $this->actingAs($user)->post(route('checkout.store'), [
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'destination_id' => 1376,
        'destination_label' => 'Jakarta Selatan',
        'courier_code' => 'jne',
        'courier_service' => 'REG',
        'expected_shipping_cost' => 0,
        'payment_method_id' => $payment->id,
        'items' => [['variant_id' => $variant->id, 'qty' => 1]],
    ])->assertSessionHasErrors('payment_method_id');

    $this->assertDatabaseCount('orders', 0);
    expect($variant->fresh()->stock)->toBe(1);
});

it('denies another user access to QRIS cancellation and regeneration', function () {
    Http::preventStrayRequests();
    config(['inertia.ssr.enabled' => false]);
    $context = makeCheckoutQrisOrder('MLF-QRIS-OWNER-ONLY');
    $otherUser = User::factory()->create();

    $this->actingAs($otherUser)->post(route('checkout.orders.qris.cancel', $context['order']))->assertNotFound();
    $this->actingAs($otherUser)->post(route('checkout.orders.qris.regenerate', $context['order']))->assertNotFound();
});

it('returns the existing active QR instead of creating another one', function () {
    Http::preventStrayRequests();
    $context = makeCheckoutQrisOrder('MLF-QRIS-ACTIVE', [
        'qris_payment_status' => 'unpaid',
        'qris_expiry_time' => now()->addMinutes(10),
    ]);
    config([
        'services.qrisly.key' => 'test-qrisly-key',
        'services.qrisly.base_url' => 'https://api-sandbox.collaborator.komerce.id/user',
    ]);
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8759' => Http::response([
            'meta' => ['status' => 'success', 'code' => 200],
            'data' => ['history_id' => 8759, 'payment_status' => 'unpaid'],
        ]),
    ]);

    $this->actingAs($context['owner'])->post(route('checkout.orders.qris.regenerate', $context['order']))
        ->assertRedirect(route('checkout.show', ['order' => $context['order']->order_number]));

    Http::assertSentCount(1);
    $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'qris_regeneration_count' => 0]);
});

it('limits QRIS regeneration to three attempts per order', function () {
    Http::preventStrayRequests();
    $context = makeCheckoutQrisOrder('MLF-QRIS-REGEN-LIMIT');
    config([
        'services.qrisly.key' => 'test-qrisly-key',
        'services.qrisly.qris_id' => 123,
        'services.qrisly.base_url' => 'https://api-sandbox.collaborator.komerce.id/user',
    ]);
    $generatedHistoryId = 8760;
    $generatedCount = 0;
    Http::fake(function ($request) use (&$generatedHistoryId, &$generatedCount) {
        if (preg_match('~/payment-status/[0-9]+$~', $request->url()) === 1) {
            return Http::response([
                'meta' => ['status' => 'success', 'code' => 200],
                'data' => ['payment_status' => 'expired'],
            ]);
        }

        if (str_ends_with($request->url(), '/generate-qris')) {
            $generatedCount++;

            return Http::response([
                'meta' => ['status' => 'success', 'code' => 200],
                'data' => [
                    'history_id' => $generatedHistoryId++,
                    'qris_string' => 'VALID_QRIS_PAYLOAD',
                    'original_amount' => 100000,
                    'final_amount' => 100001,
                    'payment_status' => 'unpaid',
                    'expiry_time' => now()->addMinutes(10)->toDateTimeString(),
                ],
            ]);
        }

        return Http::response([], 404);
    });

    for ($attempt = 0; $attempt < 3; $attempt++) {
        $this->actingAs($context['owner'])->post(route('checkout.orders.qris.regenerate', $context['order']))
            ->assertRedirect(route('checkout.show'));
    }

    $this->actingAs($context['owner'])->post(route('checkout.orders.qris.regenerate', $context['order']))
        ->assertStatus(429);

    expect($generatedCount)->toBe(3);
    $this->assertDatabaseHas('orders', [
        'id' => $context['order']->id,
        'qris_regeneration_count' => 3,
        'qrisly_history_id' => 8762,
    ]);
});

it('rejects a concurrent QRIS regeneration while the order lock is held', function () {
    Http::preventStrayRequests();
    $context = makeCheckoutQrisOrder('MLF-QRIS-REGEN-LOCK');
    $lock = Cache::lock('qrisly:regenerate:'.$context['order']->id, 45);
    expect($lock->get())->toBeTrue();

    try {
        $this->actingAs($context['owner'])->post(route('checkout.orders.qris.regenerate', $context['order']))
            ->assertStatus(409);
    } finally {
        $lock->release();
    }
});

it('caches repeated payment status polls briefly', function () {
    Http::preventStrayRequests();
    $context = makeCheckoutQrisOrder('MLF-QRIS-POLL-CACHE', [
        'qris_payment_status' => 'unpaid',
        'qris_expiry_time' => now()->addMinutes(10),
    ]);
    config([
        'services.qrisly.key' => 'test-qrisly-key',
        'services.qrisly.base_url' => 'https://api-sandbox.collaborator.komerce.id/user',
    ]);
    Http::fake([
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/8759' => Http::response([
            'meta' => ['status' => 'success', 'code' => 200],
            'data' => ['history_id' => 8759, 'payment_status' => 'unpaid'],
        ]),
    ]);

    foreach (range(1, 2) as $_) {
        $this->actingAs($context['owner'])->getJson(route('checkout.orders.qris-status', $context['order']))
            ->assertOk()
            ->assertExactJson(['payment_status' => 'unpaid']);
    }

    Http::assertSentCount(1);
});
