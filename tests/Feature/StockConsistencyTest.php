<?php

use App\Models\CartItem;
use App\Models\Category;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingCourier;
use App\Models\User;
use Illuminate\Support\Facades\Http;

function makeStockConsistencyProduct(
    string $slug = 'stock-consistency-product',
    bool $isActive = true,
    int $price = 100000,
    ?int $discountPercent = null,
): Product {
    $category = Category::query()->firstOrCreate(
        ['slug' => 'stock-consistency'],
        ['name' => 'Stock Consistency'],
    );

    return Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Stock Consistency Product',
        'slug' => $slug,
        'description' => 'Product for stock consistency tests.',
        'price' => $price,
        'discount_percent' => $discountPercent,
        'is_active' => $isActive,
    ]);
}

function makeStockConsistencyVariant(Product $product, int $stock, string $size = 'M'): ProductVariant
{
    return ProductVariant::query()->create([
        'product_id' => $product->id,
        'size' => $size,
        'stock' => $stock,
    ]);
}

/** @return array{user: User, courier: ShippingCourier, payment: PaymentMethod} */
function makeStockConsistencyCheckoutContext(): array
{
    return [
        'user' => User::factory()->create(),
        'courier' => ShippingCourier::query()->create([
            'name' => 'JNE', 'code' => 'jne', 'flat_cost' => 18000, 'is_active' => true,
        ]),
        'payment' => PaymentMethod::query()->create([
            'name' => 'Test Payment', 'code' => 'stock-test-payment', 'is_active' => true,
        ]),
    ];
}

/** @param array<int, array{variant_id: int, qty: int}> $items
 * @return array<string, mixed>
 */
function stockConsistencyCheckoutPayload(array $context, array $items): array
{
    return [
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'delivery_method' => 'courier',
        'destination_id' => 1376,
        'destination_label' => 'Jakarta Selatan',
        'courier_code' => 'jne',
        'courier_service' => 'REG',
        'expected_shipping_cost' => 18000,
        'payment_method_id' => $context['payment']->id,
        'items' => $items,
    ];
}

function makeStockConsistencyOrder(User $buyer): Order
{
    return Order::query()->create([
        'user_id' => $buyer->id,
        'order_number' => 'MLF-STOCK-'.str()->upper(str()->random(12)),
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'shipping_courier' => 'Test Courier',
        'shipping_cost' => 18000,
        'payment_method' => 'Test Payment',
        'subtotal' => 100000,
        'total' => 118000,
        'status' => 'pending_payment',
    ]);
}

describe('checkout stock consistency', function () {
    beforeEach(function (): void {
        config(['services.rajaongkir.key' => 'test-key', 'services.rajaongkir.origin_id' => 1391]);
        Http::fake(['*calculate/domestic-cost' => Http::response(['meta' => ['status' => 'success', 'code' => 200], 'data' => [[
            'name' => 'JNE', 'code' => 'jne', 'service' => 'REG', 'description' => 'Regular', 'cost' => 18000, 'etd' => '2-3',
        ]]])]);
    });
    it('returns 422 and preserves stock when duplicate variant quantities exceed stock', function () {
        $context = makeStockConsistencyCheckoutContext();
        $product = makeStockConsistencyProduct();
        $variant = makeStockConsistencyVariant($product, 5);

        $this->actingAs($context['user'])
            ->post('/checkout', stockConsistencyCheckoutPayload($context, [
                ['variant_id' => $variant->id, 'qty' => 3],
                ['variant_id' => $variant->id, 'qty' => 3],
            ]))
            ->assertSessionHasErrors('items');

        $this->assertDatabaseCount('orders', 0);
        expect($variant->fresh()->stock)->toBe(5);
    });

    it('sells duplicate variant lines totaling available stock without making stock negative', function () {
        $context = makeStockConsistencyCheckoutContext();
        $product = makeStockConsistencyProduct();
        $variant = makeStockConsistencyVariant($product, 5);

        $this->actingAs($context['user'])
            ->post('/checkout', stockConsistencyCheckoutPayload($context, [
                ['variant_id' => $variant->id, 'qty' => 3],
                ['variant_id' => $variant->id, 'qty' => 2],
            ]))
            ->assertRedirect(route('checkout.show'))
            ->assertSessionHas('order_number', Order::query()->value('order_number'));

        expect($variant->fresh()->stock)->toBe(0)
            ->and($variant->fresh()->stock)->toBeGreaterThanOrEqual(0);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 2);
    });

    it('creates a QRIS order for direct COD handover with zero shipping and no pre-payment stock deduction', function () {
        $context = makeStockConsistencyCheckoutContext();
        $context['payment']->delete();
        $context['payment'] = PaymentMethod::query()->create([
            'name' => 'QRIS', 'code' => 'qris', 'is_active' => true,
        ]);
        $product = makeStockConsistencyProduct();
        $variant = makeStockConsistencyVariant($product, 5);
        CartItem::query()->create([
            'user_id' => $context['user']->id,
            'product_variant_id' => $variant->id,
            'quantity' => 1,
        ]);

        config([
            'services.qrisly.base_url' => 'https://api-sandbox.collaborator.komerce.id',
            'services.qrisly.key' => 'test-key',
            'services.qrisly.qris_id' => '1297',
        ]);
        Http::fake([
            'https://api-sandbox.collaborator.komerce.id/api/v1/qrisly/generate-qris' => Http::response([
                'meta' => ['status' => 'success', 'code' => 200],
                'data' => [
                    'history_id' => 12345,
                    'qris_string' => '0002010102112661006299VALID_QRIS540410016304E8E2',
                    'original_amount' => 100000,
                    'final_amount' => 100000,
                    'payment_status' => 'unpaid',
                    'expiry_time' => '2026-10-18 12:00:00',
                ],
            ]),
        ]);
        $payload = stockConsistencyCheckoutPayload($context, [
            ['variant_id' => $variant->id, 'qty' => 1],
        ]);
        $payload['delivery_method'] = 'direct_cod';
        unset(
            $payload['destination_id'],
            $payload['destination_label'],
            $payload['courier_code'],
            $payload['courier_service'],
            $payload['expected_shipping_cost'],
        );

        $this->actingAs($context['user'])
            ->post('/checkout', $payload)
            ->assertRedirect(route('checkout.show'));

        $this->assertDatabaseHas('orders', [
            'payment_method' => 'QRIS',
            'payment_method_code' => 'qris',
            'status' => 'pending_payment',
            'shipping_courier' => 'COD',
            'shipping_cost' => 0,
            'destination_id' => null,
            'destination_label' => 'COD',
            'shipping_service' => null,
            'total' => 100000,
            'stock_deducted' => false,
            'qrisly_history_id' => 12345,
            'qris_original_amount' => 100000,
            'qris_final_amount' => 100000,
            'qris_payment_status' => 'unpaid',
        ]);
        Http::assertNotSent(fn ($request): bool => str_contains($request->url(), 'calculate/domestic-cost'));
        Http::assertSent(fn ($request): bool => str_contains($request->url(), 'generate-qris')
            && $request['amount'] === 100000);
        expect($variant->fresh()->stock)->toBe(5)
            ->and($context['user']->cartItems()->count())->toBe(1);
    });

    it('returns 422 without creating an order for a missing variant', function () {
        $context = makeStockConsistencyCheckoutContext();

        $this->actingAs($context['user'])
            ->post('/checkout', stockConsistencyCheckoutPayload($context, [
                ['variant_id' => 999999, 'qty' => 1],
            ]))
            ->assertSessionHasErrors('items');

        $this->assertDatabaseCount('orders', 0);
    });

    it('returns 422 and preserves stock for an inactive product', function () {
        $context = makeStockConsistencyCheckoutContext();
        $product = makeStockConsistencyProduct(isActive: false);
        $variant = makeStockConsistencyVariant($product, 4);

        $this->actingAs($context['user'])
            ->post('/checkout', stockConsistencyCheckoutPayload($context, [
                ['variant_id' => $variant->id, 'qty' => 1],
            ]))
            ->assertSessionHasErrors('items');

        $this->assertDatabaseCount('orders', 0);
        expect($variant->fresh()->stock)->toBe(4);
    });

    it('removes purchased cart lines only for the ordering user and variant', function () {
        $context = makeStockConsistencyCheckoutContext();
        $otherUser = User::factory()->create();
        $product = makeStockConsistencyProduct();
        $purchasedVariant = makeStockConsistencyVariant($product, 5);
        $otherVariant = makeStockConsistencyVariant($product, 5, 'L');
        $purchasedCartItem = CartItem::query()->create([
            'user_id' => $context['user']->id, 'product_variant_id' => $purchasedVariant->id, 'quantity' => 1,
        ]);
        $otherVariantCartItem = CartItem::query()->create([
            'user_id' => $context['user']->id, 'product_variant_id' => $otherVariant->id, 'quantity' => 2,
        ]);
        $otherUserCartItem = CartItem::query()->create([
            'user_id' => $otherUser->id, 'product_variant_id' => $purchasedVariant->id, 'quantity' => 3,
        ]);

        $this->actingAs($context['user'])
            ->post('/checkout', stockConsistencyCheckoutPayload($context, [
                ['variant_id' => $purchasedVariant->id, 'qty' => 1],
            ]))
            ->assertRedirect(route('checkout.show'))
            ->assertSessionHas('order_number', Order::query()->value('order_number'));

        $this->assertDatabaseMissing('cart_items', ['id' => $purchasedCartItem->id]);
        $this->assertDatabaseHas('cart_items', ['id' => $otherVariantCartItem->id, 'quantity' => 2]);
        $this->assertDatabaseHas('cart_items', ['id' => $otherUserCartItem->id, 'quantity' => 3]);
    });

    it('returns validation errors when checkout contains more than fifty item lines', function () {
        $context = makeStockConsistencyCheckoutContext();
        $product = makeStockConsistencyProduct();
        $variant = makeStockConsistencyVariant($product, 99);
        $items = array_fill(0, 51, ['variant_id' => $variant->id, 'qty' => 1]);

        $this->actingAs($context['user'])
            ->post('/checkout', stockConsistencyCheckoutPayload($context, $items))
            ->assertSessionHasErrors('items');

        $this->assertDatabaseCount('orders', 0);
    });
});

describe('cart synchronization consistency', function () {
    it('merges duplicate variant quantities and caps the result at stock', function () {
        $user = User::factory()->create();
        $product = makeStockConsistencyProduct();
        $variant = makeStockConsistencyVariant($product, 8);
        CartItem::query()->create([
            'user_id' => $user->id, 'product_variant_id' => $variant->id, 'quantity' => 2,
        ]);

        $this->actingAs($user)->postJson(route('cart.sync'), [
            'items' => [
                ['variant_id' => $variant->id, 'quantity' => 3],
                ['variant_id' => $variant->id, 'quantity' => 4],
            ],
        ])->assertOk();

        expect($user->cartItems()->count())->toBe(1)
            ->and($user->cartItems()->firstOrFail()->quantity)->toBe(8);
    });

    it('returns 422 for a missing variant without changing existing cart items', function () {
        $user = User::factory()->create();
        $product = makeStockConsistencyProduct();
        $variant = makeStockConsistencyVariant($product, 5);
        $cartItem = CartItem::query()->create([
            'user_id' => $user->id, 'product_variant_id' => $variant->id, 'quantity' => 2,
        ]);

        $this->actingAs($user)->postJson(route('cart.sync'), [
            'items' => [['variant_id' => 999999, 'quantity' => 1]],
        ])->assertStatus(422);

        $this->assertDatabaseHas('cart_items', ['id' => $cartItem->id, 'quantity' => 2]);
        expect($user->cartItems()->count())->toBe(1);
    });

    it('skips inactive and out-of-stock variants while saving valid variants', function () {
        $user = User::factory()->create();
        $inactiveProduct = makeStockConsistencyProduct(slug: 'stock-inactive-product', isActive: false);
        $inactiveVariant = makeStockConsistencyVariant($inactiveProduct, 5);
        $emptyProduct = makeStockConsistencyProduct(slug: 'stock-empty-product');
        $emptyVariant = makeStockConsistencyVariant($emptyProduct, 0);
        $validProduct = makeStockConsistencyProduct(slug: 'stock-valid-product');
        $validVariant = makeStockConsistencyVariant($validProduct, 5);

        $this->actingAs($user)->postJson(route('cart.sync'), [
            'items' => [
                ['variant_id' => $inactiveVariant->id, 'quantity' => 1],
                ['variant_id' => $emptyVariant->id, 'quantity' => 1],
                ['variant_id' => $validVariant->id, 'quantity' => 2],
            ],
        ])->assertOk()->assertJsonCount(1, 'items');

        expect($user->cartItems()->count())->toBe(1)
            ->and($user->cartItems()->firstOrFail()->product_variant_id)->toBe($validVariant->id);
    });

    it('adds repeated sync requests to one existing cart line', function () {
        $user = User::factory()->create();
        $product = makeStockConsistencyProduct();
        $variant = makeStockConsistencyVariant($product, 10);

        $this->actingAs($user)->postJson(route('cart.sync'), [
            'items' => [['variant_id' => $variant->id, 'quantity' => 2]],
        ])->assertOk();
        $this->postJson(route('cart.sync'), [
            'items' => [['variant_id' => $variant->id, 'quantity' => 3]],
        ])->assertOk();

        expect($user->cartItems()->count())->toBe(1)
            ->and($user->cartItems()->firstOrFail()->quantity)->toBe(5);
    });

    it('returns success without changing the cart for an empty sync request', function () {
        $user = User::factory()->create();
        $product = makeStockConsistencyProduct();
        $variant = makeStockConsistencyVariant($product, 5);
        $cartItem = CartItem::query()->create([
            'user_id' => $user->id, 'product_variant_id' => $variant->id, 'quantity' => 2,
        ]);

        $this->actingAs($user)->postJson(route('cart.sync'), ['items' => []])
            ->assertOk()->assertJsonPath('items.0.quantity', 2);

        $this->assertDatabaseHas('cart_items', ['id' => $cartItem->id, 'quantity' => 2]);
        expect($user->cartItems()->count())->toBe(1);
    });
});

describe('admin order stock restoration', function () {
    it('restores the summed quantity for duplicate variant order lines', function () {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $buyer = User::factory()->create();
        $product = makeStockConsistencyProduct();
        $variant = makeStockConsistencyVariant($product, 1);
        $order = makeStockConsistencyOrder($buyer);
        $order->items()->create([
            'product_id' => $product->id, 'variant_id' => $variant->id, 'product_name' => $product->name,
            'size' => 'M', 'qty' => 2, 'unit_price' => 100000,
        ]);
        $order->items()->create([
            'product_id' => $product->id, 'variant_id' => $variant->id, 'product_name' => $product->name,
            'size' => 'M', 'qty' => 3, 'unit_price' => 100000,
        ]);

        $this->actingAs($admin)->patch(route('admin.orders.update', $order), ['status' => 'rejected'])
            ->assertRedirect();

        expect($variant->fresh()->stock)->toBe(6);
    });

    it('handles null order item variants without changing unrelated stock', function () {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $buyer = User::factory()->create();
        $product = makeStockConsistencyProduct();
        $unrelatedVariant = makeStockConsistencyVariant($product, 4);
        $order = makeStockConsistencyOrder($buyer);
        $order->items()->create([
            'product_id' => null, 'variant_id' => null, 'product_name' => 'Deleted product',
            'size' => 'M', 'qty' => 2, 'unit_price' => 100000,
        ]);

        $this->actingAs($admin)->patch(route('admin.orders.update', $order), ['status' => 'cancelled'])
            ->assertRedirect();

        expect($unrelatedVariant->fresh()->stock)->toBe(4);
    });

    it('does not change stock when moving an order to a non-terminal status', function () {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $buyer = User::factory()->create();
        $product = makeStockConsistencyProduct();
        $variant = makeStockConsistencyVariant($product, 3);
        $order = makeStockConsistencyOrder($buyer);
        $order->items()->create([
            'product_id' => $product->id, 'variant_id' => $variant->id, 'product_name' => $product->name,
            'size' => 'M', 'qty' => 2, 'unit_price' => 100000,
        ]);

        $this->actingAs($admin)->patch(route('admin.orders.update', $order), ['status' => 'processing'])
            ->assertRedirect();

        expect($variant->fresh()->stock)->toBe(3);
    });
});
