<?php

use App\Models\Category;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingCourier;
use App\Models\User;

it('shows active products in the shop with database prices', function () {
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Everyday Tee',
        'slug' => 'everyday-tee',
        'description' => 'Soft cotton',
        'price' => 200000,
        'discount_percent' => 25,
        'is_active' => true,
    ]);
    ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => 4]);

    $this->get('/shop')->assertOk()->assertInertia(fn ($page) => $page
        ->component('store/shop')
        ->where('products.data.0.discounted_price', 150000)
        ->where('products.data.0.stock', 4));
});

it('creates an order with server prices and reduces locked variant stock', function () {
    $user = User::factory()->create();
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Everyday Tee',
        'slug' => 'everyday-tee',
        'description' => 'Soft cotton',
        'price' => 200000,
        'discount_percent' => 25,
        'is_active' => true,
    ]);
    $variant = ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => 4]);
    $courier = ShippingCourier::query()->create(['name' => 'JNE', 'code' => 'jne', 'flat_cost' => 18000, 'is_active' => true]);
    $payment = PaymentMethod::query()->create(['name' => 'QRIS', 'code' => 'qris', 'is_active' => true]);

    $this->actingAs($user)->post('/checkout', [
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'shipping_courier_id' => $courier->id,
        'payment_method_id' => $payment->id,
        'items' => [['variant_id' => $variant->id, 'qty' => 2]],
    ])->assertRedirect(route('checkout.show'));

    $this->assertDatabaseHas('orders', ['user_id' => $user->id, 'subtotal' => 300000, 'shipping_cost' => 18000, 'total' => 318000]);
    $this->assertDatabaseHas('order_items', ['product_id' => $product->id, 'qty' => 2, 'unit_price' => 150000]);
    expect($variant->fresh()->stock)->toBe(2);
});

it('rejects checkout when requested quantity exceeds current stock', function () {
    $user = User::factory()->create();
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Everyday Tee',
        'slug' => 'everyday-tee',
        'description' => 'Soft cotton',
        'price' => 200000,
        'is_active' => true,
    ]);
    $variant = ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => 1]);
    $courier = ShippingCourier::query()->create(['name' => 'JNE', 'code' => 'jne', 'flat_cost' => 18000, 'is_active' => true]);
    $payment = PaymentMethod::query()->create(['name' => 'QRIS', 'code' => 'qris', 'is_active' => true]);

    $this->actingAs($user)->post('/checkout', [
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'shipping_courier_id' => $courier->id,
        'payment_method_id' => $payment->id,
        'items' => [['variant_id' => $variant->id, 'qty' => 2]],
    ])->assertStatus(422);

    $this->assertDatabaseCount('orders', 0);
    expect($variant->fresh()->stock)->toBe(1);
});
