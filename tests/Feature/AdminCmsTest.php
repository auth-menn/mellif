<?php

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

it('forbids non-admin users from the admin area', function () {
    $this->actingAs(User::factory()->create())->get(route('admin.dashboard'))->assertForbidden();
});

it('creates a product with ordered uploaded images and variants', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['is_admin' => true]);
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);

    $response = $this->actingAs($admin)->post(route('admin.products.store'), [
        'category_id' => $category->id,
        'name' => 'Studio Tee',
        'description' => 'Cotton tee',
        'price' => 199000,
        'discount_percent' => 15,
        'is_active' => 1,
        'is_featured' => 1,
        'variants' => [['size' => 'M', 'stock' => 5], ['size' => 'L', 'stock' => 3]],
        'images' => [UploadedFile::fake()->image('front.jpg'), UploadedFile::fake()->image('back.png')],
        'image_orders' => [1, 0],
    ]);

    $product = Product::query()->where('name', 'Studio Tee')->firstOrFail();
    $response->assertRedirect(route('admin.products.edit', $product));
    expect($product->images()->orderBy('sort_order')->first()?->path)->toStartWith('products/');
    expect($product->variants()->count())->toBe(2);
    Storage::disk('public')->assertExists($product->images()->firstOrFail()->path);
});

it('restores order stock only once when rejecting an order', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $buyer = User::factory()->create();
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);
    $product = Product::query()->create([
        'category_id' => $category->id, 'name' => 'Tee', 'slug' => 'tee',
        'description' => 'Cotton', 'price' => 100000, 'is_active' => true,
    ]);
    $variant = ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => 2]);
    $order = Order::query()->create([
        'user_id' => $buyer->id, 'order_number' => 'MLF-TEST-000001', 'recipient_name' => 'Buyer',
        'phone' => '0812345678', 'address' => 'Jakarta', 'shipping_courier' => 'JNE',
        'shipping_cost' => 18000, 'payment_method' => 'QRIS', 'subtotal' => 100000,
        'total' => 118000, 'status' => 'pending_payment',
    ]);
    $order->items()->create([
        'product_id' => $product->id, 'variant_id' => $variant->id, 'product_name' => $product->name,
        'size' => 'M', 'qty' => 2, 'unit_price' => 50000,
    ]);

    $this->actingAs($admin)->patch(route('admin.orders.update', $order), ['status' => 'rejected'])->assertRedirect();
    expect($variant->fresh()->stock)->toBe(4);
    $this->patch(route('admin.orders.update', $order), ['status' => 'cancelled'])->assertUnprocessable();
    expect($variant->fresh()->stock)->toBe(4);
});

it('updates the home hero image and tagline', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['is_admin' => true]);

    $this->actingAs($admin)->put(route('admin.home-settings.update'), [
        'tagline' => 'Wear your point of view.',
        'hero_image' => UploadedFile::fake()->image('hero.webp'),
    ])->assertRedirect();

    $this->get(route('home'))->assertInertia(fn ($page) => $page->where('tagline', 'Wear your point of view.'));
});
