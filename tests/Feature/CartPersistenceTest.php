<?php

use App\Models\CartItem;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\User;

function createCartVariant(int $stock = 5): ProductVariant
{
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);
    $product = Product::query()->create([
        'category_id' => $category->id, 'name' => 'Everyday Tee', 'slug' => 'everyday-tee',
        'description' => 'Cotton', 'price' => 100000, 'is_active' => true,
    ]);

    return ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => $stock]);
}

function createCartHistoryOrder(User $user, ProductVariant $variant, string $orderNumber, string $paymentStatus): Order
{
    $order = Order::query()->create([
        'user_id' => $user->id,
        'order_number' => $orderNumber,
        'recipient_name' => 'Test buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 0,
        'payment_method' => 'QRIS',
        'payment_method_code' => 'qris',
        'subtotal' => 100000,
        'total' => 100000,
        'status' => $paymentStatus === 'paid' ? 'processing' : 'pending_payment',
        'qris_payment_status' => $paymentStatus,
    ]);
    $order->items()->create([
        'product_id' => $variant->product_id,
        'variant_id' => $variant->id,
        'product_name' => $variant->product->name,
        'size' => $variant->size,
        'qty' => 1,
        'unit_price' => 100000,
    ]);

    return $order;
}

it('stores and updates authenticated cart items while validating current stock', function () {
    $user = User::factory()->create();
    $variant = createCartVariant(4);

    $this->actingAs($user)->postJson(route('cart.items.store'), [
        'variant_id' => $variant->id,
        'quantity' => 2,
    ])->assertCreated()->assertJsonPath('item.quantity', 2);

    $this->putJson(route('cart.items.update', $variant->id), ['quantity' => 5])->assertUnprocessable();
    $this->getJson(route('cart.index'))->assertOk()->assertJsonPath('items.0.quantity', 2);
});

it('rejects adding more than the remaining stock to an existing cart item', function () {
    $user = User::factory()->create();
    $variant = createCartVariant(4);
    CartItem::query()->create(['user_id' => $user->id, 'product_variant_id' => $variant->id, 'quantity' => 3]);

    $this->actingAs($user)->postJson(route('cart.items.store'), [
        'variant_id' => $variant->id,
        'quantity' => 2,
    ])->assertUnprocessable();

    expect($user->cartItems()->firstOrFail()->quantity)->toBe(3);
});

it('merges guest items into the account cart and caps quantities to available stock', function () {
    $user = User::factory()->create();
    $variant = createCartVariant(4);
    CartItem::query()->create(['user_id' => $user->id, 'product_variant_id' => $variant->id, 'quantity' => 2]);

    $this->actingAs($user)->postJson(route('cart.sync'), [
        'items' => [['variant_id' => $variant->id, 'quantity' => 5]],
    ])->assertOk()->assertJsonPath('items.0.quantity', 4);

    expect($user->cartItems()->count())->toBe(1);
    expect($user->cartItems()->firstOrFail()->quantity)->toBe(4);
});

it('requires authentication for server cart access', function () {
    $this->getJson(route('cart.index'))->assertUnauthorized();
});

it('shows this user their unpaid orders and paid product history in the cart', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $variant = createCartVariant();
    ProductImage::query()->create([
        'product_id' => $variant->product_id,
        'path' => 'products/everyday-tee.jpg',
        'sort_order' => 0,
    ]);
    createCartHistoryOrder($user, $variant, 'MLF-CART-UNPAID', 'unpaid');
    createCartHistoryOrder($user, $variant, 'MLF-CART-PAID', 'paid');
    createCartHistoryOrder($otherUser, $variant, 'MLF-CART-OTHER', 'paid');

    $this->actingAs($user)->getJson(route('cart.index'))
        ->assertOk()
        ->assertJsonCount(1, 'orders.awaitingPayment')
        ->assertJsonPath('orders.awaitingPayment.0.orderNumber', 'MLF-CART-UNPAID')
        ->assertJsonPath('orders.awaitingPayment.0.items.0.productName', 'Everyday Tee')
        ->assertJsonCount(1, 'orders.paid')
        ->assertJsonPath('orders.paid.0.orderNumber', 'MLF-CART-PAID')
        ->assertJsonPath('orders.paid.0.items.0.size', 'M')
        ->assertJsonPath('orders.paid.0.items.0.imageUrl', asset('storage/products/everyday-tee.jpg'));
});

it('rejects non-canonical cart quantities with a 422 response', function (mixed $quantity) {
    $user = User::factory()->create();
    $variant = createCartVariant(5);

    $this->actingAs($user)->postJson(route('cart.items.store'), [
        'variant_id' => $variant->id,
        'quantity' => $quantity,
    ])->assertUnprocessable()->assertJsonValidationErrors('quantity');

    expect($user->cartItems()->count())->toBe(0);
})->with([0, 1.4, '01']);
