<?php

use App\Jobs\SendProductLaunchNotifications;
use App\Mail\ProductLaunched;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

it('queues a launch announcement when an admin creates an active product', function () {
    Queue::fake([SendProductLaunchNotifications::class]);

    $admin = User::factory()->create(['is_admin' => true]);
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);

    $this->actingAs($admin)->post(route('admin.products.store'), [
        'category_id' => $category->id,
        'name' => 'New Studio Tee',
        'description' => 'A newly launched shirt',
        'price' => 150000,
        'weight' => 500,
        'is_active' => true,
        'is_featured' => false,
        'variants' => [['size' => 'M', 'stock' => 5]],
    ])->assertRedirect(route('admin.products.index'));

    $product = Product::query()->where('name', 'New Studio Tee')->firstOrFail();

    Queue::assertPushed(SendProductLaunchNotifications::class, fn (SendProductLaunchNotifications $job): bool => $job->productId === $product->id);
});

it('does not queue a launch announcement for an inactive product', function () {
    Queue::fake([SendProductLaunchNotifications::class]);

    $admin = User::factory()->create(['is_admin' => true]);
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);

    $this->actingAs($admin)->post(route('admin.products.store'), [
        'category_id' => $category->id,
        'name' => 'Draft Studio Tee',
        'description' => 'A draft shirt',
        'price' => 150000,
        'weight' => 500,
        'is_active' => false,
        'is_featured' => false,
        'variants' => [['size' => 'M', 'stock' => 5]],
    ])->assertRedirect(route('admin.products.index'));

    Queue::assertNotPushed(SendProductLaunchNotifications::class);
});

it('queues the new product email for every registered user', function () {
    Mail::fake();
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);

    $product = Product::factory()->create([
        'category_id' => $category->id,
        'name' => 'New Studio Tee',
        'slug' => 'new-studio-tee',
        'description' => 'A newly launched shirt',
        'price' => 150000,
        'is_active' => true,
    ]);
    $firstUser = User::factory()->create(['email' => 'first@example.com']);
    $secondUser = User::factory()->unverified()->create(['email' => 'second@example.com']);

    (new SendProductLaunchNotifications($product->id))->handle();

    Mail::assertQueued(ProductLaunched::class, 2);
    Mail::assertQueued(ProductLaunched::class, fn (ProductLaunched $mail): bool => $mail->hasTo($firstUser->email));
    Mail::assertQueued(ProductLaunched::class, fn (ProductLaunched $mail): bool => $mail->hasTo($secondUser->email));
    Mail::assertQueued(ProductLaunched::class, fn (ProductLaunched $mail): bool => str_contains($mail->render(), 'New Studio Tee')
        && str_contains($mail->render(), 'Rp 150.000'));
});
