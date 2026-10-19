<?php

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StoreSetting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

it('forbids non-admin users from the admin area', function () {
    $this->actingAs(User::factory()->create())->get(route('admin.dashboard'))->assertForbidden();
});

it('creates a product with ordered uploaded images and variants', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);

    $response = $this->actingAs($admin)->post(route('admin.products.store'), [
        'category_id' => $category->id,
        'name' => 'Studio Tee',
        'description' => 'Cotton tee',
        'price' => 199000,
        'weight' => 620,
        'discount_percent' => 15,
        'is_active' => 1,
        'is_featured' => 1,
        'variants' => [['size' => 'M', 'stock' => 5], ['size' => 'L', 'stock' => 3]],
        'images' => [UploadedFile::fake()->image('front.jpg'), UploadedFile::fake()->image('back.png')],
        'image_orders' => [1, 0],
    ]);

    $product = Product::query()->where('name', 'Studio Tee')->firstOrFail();
    $response->assertRedirect(route('admin.products.index'));
    expect($product->images()->orderBy('sort_order')->first()?->path)->toStartWith('products/');
    expect($product->variants()->count())->toBe(2);
    Storage::disk('public')->assertExists($product->images()->firstOrFail()->path);
});

it('removes deselected product images when replacing them with new uploads', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Studio Tee',
        'slug' => 'studio-tee',
        'description' => 'Cotton tee',
        'price' => 199000,
        'weight' => 620,
        'is_active' => true,
    ]);
    Storage::disk('public')->put('products/old.jpg', 'old image');
    $oldImage = $product->images()->create(['path' => 'products/old.jpg', 'sort_order' => 0]);

    $this->actingAs($admin)->put(route('admin.products.update', $product), [
        'category_id' => $category->id,
        'name' => $product->name,
        'description' => $product->description,
        'price' => $product->price,
        'weight' => $product->weight,
        'is_active' => true,
        'is_featured' => false,
        'variants' => [['size' => 'M', 'stock' => 5]],
        'sync_existing_images' => true,
        'images' => [UploadedFile::fake()->image('replacement.jpg')],
        'image_orders' => [0],
    ])->assertRedirect(route('admin.products.index'));

    $images = $product->images()->get();
    expect($images)->toHaveCount(1);
    $newImage = $images->firstOrFail();
    expect($newImage->path)->not->toBe('products/old.jpg');
    $this->assertDatabaseMissing('product_images', ['id' => $oldImage->id]);
    Storage::disk('public')->assertMissing('products/old.jpg');
    Storage::disk('public')->assertExists($newImage->path);
});

it('zeros stock for removed variants that are referenced by order history', function () {
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();
    $buyer = User::factory()->create();
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Studio Tee',
        'slug' => 'studio-tee',
        'description' => 'Cotton tee',
        'price' => 199000,
        'weight' => 620,
        'is_active' => true,
    ]);
    $removedVariant = ProductVariant::query()->create([
        'product_id' => $product->id,
        'size' => 'M',
        'stock' => 5,
    ]);
    $order = Order::query()->create([
        'user_id' => $buyer->id,
        'order_number' => 'MLF-TEST-VARIANT',
        'recipient_name' => 'Buyer',
        'phone' => '0812345678',
        'address' => 'Jakarta',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 18000,
        'payment_method' => 'QRIS',
        'subtotal' => 199000,
        'total' => 217000,
    ]);
    $order->items()->create([
        'product_id' => $product->id,
        'variant_id' => $removedVariant->id,
        'product_name' => $product->name,
        'size' => 'M',
        'qty' => 1,
        'unit_price' => 199000,
    ]);

    $this->actingAs($admin)->put(route('admin.products.update', $product), [
        'category_id' => $category->id,
        'name' => $product->name,
        'description' => $product->description,
        'price' => $product->price,
        'weight' => $product->weight,
        'is_active' => true,
        'is_featured' => false,
        'variants' => [['size' => 'L', 'stock' => 0]],
    ])->assertRedirect(route('admin.products.index'));

    expect($removedVariant->fresh()->stock)->toBe(0);

    $this->get(route('shop.index'))
        ->assertInertia(fn ($page) => $page
            ->where('products.data.0.stock', 0));
});

it('restores order stock only once when rejecting an order', function () {
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();
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

it('updates the legacy home hero image', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();

    $this->actingAs($admin)->put(route('admin.home-settings.update'), [
        'hero_image' => UploadedFile::fake()->image('hero.webp'),
    ])->assertRedirect();

    $heroImagePath = StoreSetting::query()->where('key', 'hero_image')->value('value');

    expect($heroImagePath)->toBeString();
    Storage::disk('public')->assertExists($heroImagePath);
});

it('stores multiple home videos and page two images for the storefront', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();

    $this->actingAs($admin)->put(route('admin.home-settings.update'), [
        'hero_videos' => [
            UploadedFile::fake()->create('campaign-one.mp4', 100, 'video/mp4'),
            UploadedFile::fake()->create('campaign-two.webm', 100, 'video/webm'),
        ],
        'page2_images' => [
            UploadedFile::fake()->image('look-one.jpg', 1672, 941),
            UploadedFile::fake()->image('look-two.webp', 1200, 800),
        ],
    ])->assertRedirect();

    $heroVideos = json_decode(StoreSetting::query()->where('key', 'home_page1_videos')->value('value'), true, flags: JSON_THROW_ON_ERROR);
    $page2Images = json_decode(StoreSetting::query()->where('key', 'home_page2_images')->value('value'), true, flags: JSON_THROW_ON_ERROR);

    expect($heroVideos)->toHaveCount(2)
        ->and($page2Images)->toHaveCount(2);

    foreach ([...$heroVideos, ...array_column($page2Images, 'path')] as $path) {
        Storage::disk('public')->assertExists($path);
    }

    $this->get(route('home'))->assertInertia(fn ($page) => $page
        ->has('heroVideos', 2)
        ->has('productSlides', 2)
        ->where('productSlides.0.width', 1672)
        ->where('productSlides.0.height', 941)
        ->where('productSlides.1.width', 1200)
        ->where('productSlides.1.height', 800));
});

it('removes selected home media and keeps the rest', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();
    $videoPaths = ['storefront/home/videos/one.mp4', 'storefront/home/videos/two.mp4'];
    $imagePaths = ['storefront/home/images/one.jpg', 'storefront/home/images/two.jpg'];

    foreach ([...$videoPaths, ...$imagePaths] as $path) {
        Storage::disk('public')->put($path, 'media');
    }

    StoreSetting::query()->create(['key' => 'home_page1_videos', 'value' => json_encode($videoPaths, JSON_THROW_ON_ERROR)]);
    StoreSetting::query()->create(['key' => 'home_page2_images', 'value' => json_encode($imagePaths, JSON_THROW_ON_ERROR)]);

    $this->actingAs($admin)->put(route('admin.home-settings.update'), [
        'remove_hero_video_indexes' => [0],
        'remove_page2_image_indexes' => [1],
    ])->assertRedirect();

    expect(json_decode(StoreSetting::query()->where('key', 'home_page1_videos')->value('value'), true, flags: JSON_THROW_ON_ERROR))
        ->toBe([$videoPaths[1]])
        ->and(array_column(json_decode(StoreSetting::query()->where('key', 'home_page2_images')->value('value'), true, flags: JSON_THROW_ON_ERROR), 'path'))
        ->toBe([$imagePaths[0]]);

    Storage::disk('public')->assertMissing($videoPaths[0]);
    Storage::disk('public')->assertMissing($imagePaths[1]);
    Storage::disk('public')->assertExists($videoPaths[1]);
    Storage::disk('public')->assertExists($imagePaths[0]);
});

it('rejects unsupported files for home video and image uploads', function () {
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();

    $this->actingAs($admin)->put(route('admin.home-settings.update'), [
        'hero_videos' => [UploadedFile::fake()->image('not-a-video.png')],
        'page2_images' => [UploadedFile::fake()->create('not-an-image.txt', 10, 'text/plain')],
    ])->assertSessionHasErrors(['hero_videos.0', 'page2_images.0']);
});
