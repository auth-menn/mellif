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

it('shares a valid English locale cookie with Inertia pages', function () {
    $this->withUnencryptedCookie('locale', 'en')
        ->get(route('home'))
        ->assertInertia(fn ($page) => $page
            ->where('locale', 'en')
            ->where('canonicalUrl', route('home')))
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

it('provides the canonical URL for an active product page', function () {
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 'canonical-shirts']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Canonical Tee',
        'slug' => 'canonical-tee',
        'description' => 'A public product page',
        'price' => 100000,
        'is_active' => true,
    ]);

    $this->get(route('shop.show', ['product' => $product->slug]))
        ->assertInertia(fn ($page) => $page
            ->component('store/product')
            ->where('canonicalUrl', route('shop.show', ['product' => $product->slug])));
});

it('shows active products with zero stock in the shop and filters them out when in-stock is selected', function () {
    $category = Category::query()->create(['name' => 'Accessories', 'slug' => 'accessories']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Sold Out Cap',
        'slug' => 'sold-out-cap',
        'description' => 'A sold out product',
        'price' => 50000,
        'is_active' => true,
    ]);
    ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'One Size', 'stock' => 0]);

    $this->get('/shop')
        ->assertInertia(fn ($page) => $page
            ->where('products.data.0.name', 'Sold Out Cap')
            ->where('products.data.0.stock', 0));

    $this->get('/shop?in_stock=1')
        ->assertInertia(fn ($page) => $page->where('products.total', 0));
});

it('combines the selected shop category and size filters on the same product', function () {
    $categoryA = Category::query()->create(['name' => 'Category A', 'slug' => 'category-a']);
    $categoryB = Category::query()->create(['name' => 'Category B', 'slug' => 'category-b']);

    $productA = Product::query()->create([
        'category_id' => $categoryA->id,
        'name' => 'Product A',
        'slug' => 'product-a-filter-test',
        'description' => 'Product A sizes',
        'price' => 100000,
        'is_active' => true,
    ]);
    ProductVariant::query()->create(['product_id' => $productA->id, 'size' => 'S', 'stock' => 1]);
    ProductVariant::query()->create(['product_id' => $productA->id, 'size' => 'L', 'stock' => 1]);

    $productB = Product::query()->create([
        'category_id' => $categoryB->id,
        'name' => 'Product B',
        'slug' => 'product-b-filter-test',
        'description' => 'Product B sizes',
        'price' => 100000,
        'is_active' => true,
    ]);
    ProductVariant::query()->create(['product_id' => $productB->id, 'size' => 'L', 'stock' => 1]);
    ProductVariant::query()->create(['product_id' => $productB->id, 'size' => 'XL', 'stock' => 1]);
    ProductVariant::query()->create(['product_id' => $productB->id, 'size' => 'XXL', 'stock' => 1]);

    $this->get('/shop?categories='.$categoryB->id.'&size=S')
        ->assertInertia(fn ($page) => $page
            ->where('products.total', 0));
});

it('lists available sizes in clothing order in the shop filters', function () {
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt-sizes']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Filter Order Tee',
        'slug' => 'filter-order-tee',
        'description' => 'A tee to verify filter ordering',
        'price' => 100000,
        'is_active' => true,
    ]);

    foreach (['XL', 'L', 'M', 'S'] as $size) {
        ProductVariant::query()->create(['product_id' => $product->id, 'size' => $size, 'stock' => 1]);
    }

    $this->get('/shop')
        ->assertInertia(fn ($page) => $page
            ->where('sizes', ['S', 'M', 'L', 'XL']));
});

it('returns Turnstile verification failures as checkout form errors for Inertia requests', function () {
    config([
        'app.url' => 'https://mellifstudio.com',
        'services.turnstile.site_key' => 'test-site-key',
        'services.turnstile.secret_key' => 'test-secret-key',
    ]);
    Http::fake([
        'challenges.cloudflare.com/turnstile/v0/siteverify' => Http::response([
            'success' => false,
            'error-codes' => ['timeout-or-duplicate'],
        ]),
    ]);

    $user = User::factory()->create();
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 'turnstile-shirt']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Turnstile Tee',
        'slug' => 'turnstile-tee',
        'description' => 'A tee for checkout verification',
        'price' => 100000,
        'is_active' => true,
    ]);
    $variant = ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => 1]);
    $payment = PaymentMethod::query()->create(['name' => 'QRIS', 'code' => 'qris', 'is_active' => true]);

    $this->actingAs($user)
        ->withHeaders([
            'Accept' => 'text/html, application/xhtml+xml',
            'X-Inertia' => 'true',
            'X-Requested-With' => 'XMLHttpRequest',
        ])
        ->from(route('checkout.show'))
        ->post(route('checkout.store'), [
            'recipient_name' => 'Test Buyer',
            'phone' => '08123456789',
            'address' => 'Jakarta',
            'delivery_method' => 'direct_cod',
            'destination_id' => null,
            'destination_label' => null,
            'courier_code' => null,
            'courier_service' => null,
            'expected_shipping_cost' => null,
            'payment_method_id' => $payment->id,
            'turnstile_token' => 'used-token',
            'items' => [['variant_id' => $variant->id, 'qty' => 1]],
        ])
        ->assertRedirect(route('checkout.show'))
        ->assertSessionHasErrors([
            'turnstile_token' => 'Verifikasi keamanan tidak berhasil. Periksa koneksi internet, lalu selesaikan verifikasi lagi.',
        ]);

    $this->assertDatabaseCount('orders', 0);
});

it('creates an order with server prices without reducing stock before QRIS payment', function () {
    config(['services.rajaongkir.key' => 'test-key', 'services.rajaongkir.origin_id' => 1391]);
    config([
        'services.qrisly.key' => 'test-qrisly-key',
        'services.qrisly.qris_id' => 123,
        'services.qrisly.base_url' => 'https://api-sandbox.collaborator.komerce.id/user',
    ]);
    Http::fake([
        '*destination/domestic-destination*' => Http::response(['meta' => ['status' => 'success', 'code' => 200], 'data' => [[
            'id' => 1376, 'label' => 'Kebayoran Baru, Jakarta Selatan, DKI Jakarta, 12110',
        ]]]),
        '*calculate/domestic-cost' => Http::response(['meta' => ['status' => 'success', 'code' => 200], 'data' => [[
            'name' => 'JNE', 'code' => 'jne', 'service' => 'REG', 'description' => 'Regular', 'cost' => 18000, 'etd' => '2-3',
        ]]]),
        'api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/generate-qris' => Http::response([
            'meta' => ['message' => 'QRIS successfully generated', 'code' => 200, 'status' => 'success'],
            'data' => [
                'history_id' => 8759,
                'qris_string' => qrisPayloadWithAmount(318001),
                'original_amount' => 318000,
                'final_amount' => 318001,
                'payment_status' => 'unpaid',
                'expiry_time' => '2026-10-14 11:57:54',
            ],
        ]),
    ]);
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

    $this->getJson(route('shipping.destinations', ['q' => 'Jakarta Selatan']))->assertOk();

    $this->actingAs($user)->post('/checkout', [
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Jakarta',
        'destination_id' => 1376,
        'destination_label' => 'Label tujuan palsu dari browser',
        'courier_code' => 'jne',
        'courier_service' => 'REG',
        'expected_shipping_cost' => 18000,
        'payment_method_id' => $payment->id,
        'items' => [['variant_id' => $variant->id, 'qty' => 2]],
    ])->assertRedirect(route('checkout.show', ['order' => Order::query()->value('order_number')]))
        ->assertSessionHas('order_number', Order::query()->value('order_number'));

    $this->assertDatabaseHas('orders', [
        'user_id' => $user->id,
        'subtotal' => 300000,
        'shipping_cost' => 18000,
        'total' => 318000,
        'destination_label' => 'Kebayoran Baru, Jakarta Selatan, DKI Jakarta, 12110',
        'payment_method_code' => 'qris',
        'qrisly_history_id' => 8759,
        'qris_final_amount' => 318001,
        'qris_payment_status' => 'unpaid',
    ]);
    Http::assertSent(fn ($request): bool => $request->url() === 'https://rajaongkir.komerce.id/api/v1/calculate/domestic-cost'
        && (int) $request['weight'] === 1000
        && (int) $request['origin'] === 1391
        && (int) $request['destination'] === 1376);
    Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/qrisly/generate-qris')
        && $request['qris_id'] === 123
        && $request['amount'] === 318000
        && $request['unique_amount'] === true
        && $request['output_type'] === 'string');
    $this->assertDatabaseHas('order_items', ['product_id' => $product->id, 'qty' => 2, 'unit_price' => 150000]);
    $this->actingAs($user)
        ->get(route('checkout.show', ['order' => Order::query()->value('order_number')]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('order.qrisImage', fn ($image): bool => is_string($image) && str_starts_with($image, 'data:image/svg+xml;base64,'))
            ->where('order.qrisPaymentStatus', 'unpaid'));
    expect($variant->fresh()->stock)->toBe(4);
    expect($user->cartItems()->count())->toBe(1);
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
        'courier_code' => 'jne', 'courier_service' => 'EXP', 'expected_shipping_cost' => 18000, 'payment_method_id' => $payment->id,
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
        'expected_shipping_cost' => 18000,
        'payment_method_id' => $payment->id,
        'items' => [['variant_id' => $variant->id, 'qty' => 1.4]],
    ];

    $this->actingAs($user)->post('/checkout', $checkoutData)->assertSessionHasErrors('items.0.qty');

    $checkoutData['items'][0]['qty'] = 2;
    $this->actingAs($user)->post('/checkout', $checkoutData)->assertSessionHasErrors('items');

    $this->assertDatabaseCount('orders', 0);
    expect($variant->fresh()->stock)->toBe(1);
});
