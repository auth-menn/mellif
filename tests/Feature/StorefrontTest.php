<?php

use App\Models\CartItem;
use App\Models\Category;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingCourier;
use App\Models\User;
use Illuminate\Support\Facades\Http;

it('shares a valid English locale cookie with Inertia pages', function () {
    $this->withUnencryptedCookie('locale', 'en')
        ->get(route('home'))
        ->assertInertia(fn ($page) => $page->where('locale', 'en'))
        ->assertSee('<html lang="en"', false);
});

it('falls back to Indonesian for an invalid locale cookie', function () {
    $this->withUnencryptedCookie('locale', 'fr')
        ->get(route('home'))
        ->assertInertia(fn ($page) => $page->where('locale', 'id'))
        ->assertSee('<html lang="id"', false);
});

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
    config(['services.rajaongkir.key' => 'test-key', 'services.rajaongkir.origin_id' => 1391]);
    Http::fake(['*calculate/domestic-cost' => Http::response(['meta' => ['status' => 'success', 'code' => 200], 'data' => [[
        'name' => 'JNE', 'code' => 'jne', 'service' => 'REG', 'description' => 'Regular', 'cost' => 18000, 'etd' => '2-3',
    ]]])]);
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
    CartItem::query()->create(['user_id' => $user->id, 'product_variant_id' => $variant->id, 'quantity' => 2]);
    $courier = ShippingCourier::query()->create(['name' => 'JNE', 'code' => 'jne', 'flat_cost' => 18000, 'is_active' => true]);
    $payment = PaymentMethod::query()->create(['name' => 'QRIS', 'code' => 'qris', 'is_active' => true]);

    $this->actingAs($user)->post('/checkout', [
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'destination_id' => 1376,
        'destination_label' => 'Kebayoran Baru, Jakarta Selatan, DKI Jakarta, 12110',
        'courier_code' => 'jne',
        'courier_service' => 'REG',
        'payment_method_id' => $payment->id,
        'items' => [['variant_id' => $variant->id, 'qty' => 2]],
    ])->assertRedirect(route('checkout.show'));

    $this->assertDatabaseHas('orders', ['user_id' => $user->id, 'subtotal' => 300000, 'shipping_cost' => 18000, 'total' => 318000]);
    Http::assertSent(fn ($request): bool => $request->url() === 'https://rajaongkir.komerce.id/api/v1/calculate/domestic-cost'
        && (int) $request['weight'] === 1000
        && (int) $request['origin'] === 1391
        && (int) $request['destination'] === 1376);
    $this->assertDatabaseHas('order_items', ['product_id' => $product->id, 'qty' => 2, 'unit_price' => 150000]);
    expect($variant->fresh()->stock)->toBe(2);
    expect($user->cartItems()->count())->toBe(0);
});

it('rejects a shipping service that is not returned by the rate provider', function () {
    config(['services.rajaongkir.key' => 'test-key', 'services.rajaongkir.origin_id' => 1391]);
    Http::fake(['*calculate/domestic-cost' => Http::response(['meta' => ['status' => 'success', 'code' => 200], 'data' => [[
        'name' => 'JNE', 'code' => 'jne', 'service' => 'REG', 'description' => 'Regular', 'cost' => 18000, 'etd' => '2-3',
    ]]])]);
    $user = User::factory()->create();
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 'invalid-rate-shirt']);
    $product = Product::query()->create([
        'category_id' => $category->id, 'name' => 'Rate Tee', 'slug' => 'rate-tee',
        'description' => 'Cotton', 'price' => 100000, 'weight' => 750, 'is_active' => true,
    ]);
    $variant = ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => 2]);
    ShippingCourier::query()->create(['name' => 'JNE', 'code' => 'jne', 'flat_cost' => 0, 'is_active' => true]);
    $payment = PaymentMethod::query()->create(['name' => 'QRIS', 'code' => 'rate-qris', 'is_active' => true]);

    $this->actingAs($user)->post('/checkout', [
        'recipient_name' => 'Test Buyer', 'phone' => '08123456789', 'address' => 'Jakarta',
        'destination_id' => 1376, 'destination_label' => 'Jakarta Selatan',
        'courier_code' => 'jne', 'courier_service' => 'EXP', 'payment_method_id' => $payment->id,
        'items' => [['variant_id' => $variant->id, 'qty' => 1]],
    ])->assertSessionHasErrors('courier_service');

    $this->assertDatabaseCount('orders', 0);
    expect($variant->fresh()->stock)->toBe(2);
});

it('rejects checkout when quantity is fractional or exceeds current stock', function () {
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

    $checkoutData = [
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'destination_id' => 1376,
        'destination_label' => 'Jakarta Selatan',
        'courier_code' => 'jne',
        'courier_service' => 'REG',
        'payment_method_id' => $payment->id,
        'items' => [['variant_id' => $variant->id, 'qty' => 1.4]],
    ];

    $this->actingAs($user)->post('/checkout', $checkoutData)->assertSessionHasErrors('items.0.qty');

    $checkoutData['items'][0]['qty'] = 2;
    $this->actingAs($user)->post('/checkout', $checkoutData)->assertStatus(422);

    $this->assertDatabaseCount('orders', 0);
    expect($variant->fresh()->stock)->toBe(1);
});
