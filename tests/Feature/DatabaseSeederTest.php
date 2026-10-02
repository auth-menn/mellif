<?php

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoCustomerSeeder;
use Database\Seeders\DemoOrderSeeder;
use Illuminate\Support\Facades\Artisan;

beforeEach(function (): void {
    config([
        'services.mellif.admin_email' => 'admin@mellif.test',
        'services.mellif.admin_password' => 'admin-secret',
        'services.mellif.demo_password' => 'customer-secret',
    ]);
});

it('seeds all development records idempotently and keeps admin roles separate', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    $this->assertDatabaseCount('categories', 5);
    $this->assertDatabaseCount('products', 12);
    $this->assertDatabaseCount('product_variants', 48);
    $this->assertDatabaseCount('product_images', 12);
    $this->assertDatabaseCount('shipping_couriers', 3);
    $this->assertDatabaseCount('payment_methods', 1);
    $this->assertDatabaseCount('store_settings', 2);
    $this->assertDatabaseCount('users', 6);
    $this->assertDatabaseCount('orders', 5);
    $this->assertDatabaseCount('order_items', 5);
    $this->assertDatabaseHas('product_images', ['path' => 'products/placeholder.svg']);

    expect(User::query()->where('email', 'admin@mellif.test')->firstOrFail()->is_admin)->toBeTrue()
        ->and(User::query()->where('email', 'like', 'customer%@mellif.test')->where('is_admin', false)->count())->toBe(5)
        ->and(User::query()->where('email', 'customer4@mellif.test')->value('email_verified_at'))->toBeNull()
        ->and(User::query()->where('email', 'customer5@mellif.test')->value('google_id'))->toBe('mellif-demo-google-customer-5')
        ->and(User::query()->where('email', 'customer5@mellif.test')->value('password'))->toBeNull()
        ->and(Product::query()->whereNotNull('discount_percent')->exists())->toBeTrue()
        ->and(Product::query()->whereNull('discount_percent')->exists())->toBeTrue()
        ->and(Product::query()->where('is_featured', true)->exists())->toBeTrue()
        ->and(Product::query()->where('is_active', false)->exists())->toBeTrue()
        ->and(ProductVariant::query()->where('stock', 0)->exists())->toBeTrue()
        ->and(ProductVariant::query()->whereBetween('stock', [1, 5])->exists())->toBeTrue();
});

it('fails clearly when either admin credential is missing', function (string $email, string $password) {
    config(['services.mellif.admin_email' => $email, 'services.mellif.admin_password' => $password]);

    expect(fn () => (new AdminUserSeeder)->run())
        ->toThrow(RuntimeException::class, 'ADMIN_EMAIL and ADMIN_PASSWORD must both be set');
})->with([
    'email missing' => ['', 'admin-secret'],
    'password missing' => ['admin@mellif.test', ''],
]);

it('does not create demo users or orders in production', function () {
    $this->app->instance('env', 'production');
    config(['services.mellif.demo_password' => null]);

    Artisan::call('db:seed', [
        '--class' => DatabaseSeeder::class,
        '--force' => true,
        '--no-interaction' => true,
    ]);

    (new DemoCustomerSeeder)->run();
    (new DemoOrderSeeder)->run();

    $this->assertDatabaseCount('shipping_couriers', 3);
    $this->assertDatabaseCount('payment_methods', 1);
    $this->assertDatabaseCount('store_settings', 2);
    $this->assertDatabaseCount('users', 1);
    $this->assertDatabaseCount('products', 0);
    $this->assertDatabaseCount('orders', 0);
});

it('reserves stock only for active demo order statuses and does so idempotently', function () {
    $this->seed(DatabaseSeeder::class);

    $expectedStocks = [
        'core-hoodie' => 8,
        'zip-hoodie' => 9,
        'utility-jacket' => 9,
        'canvas-overshirt' => 10,
        'relaxed-chino' => 10,
    ];

    foreach ($expectedStocks as $slug => $stock) {
        $variant = ProductVariant::query()->whereHas('product', fn ($query) => $query->where('slug', $slug))
            ->where('size', 'S')->firstOrFail();
        expect($variant->stock)->toBe($stock);
    }

    $this->seed(DemoOrderSeeder::class);
    $this->assertDatabaseCount('orders', 5);

    foreach ($expectedStocks as $slug => $stock) {
        $variant = ProductVariant::query()->whereHas('product', fn ($query) => $query->where('slug', $slug))
            ->where('size', 'S')->firstOrFail();
        expect($variant->stock)->toBe($stock);
    }

    expect(Order::query()->where('order_number', 'like', 'DEMO-%')->orderBy('order_number')->pluck('status')->all())
        ->toBe(['pending_payment', 'paid', 'processing', 'rejected', 'cancelled']);

    foreach (Order::query()->with('items.product')->where('order_number', 'like', 'DEMO-%')->get() as $order) {
        $item = $order->items->sole();
        expect($item->unit_price)->toBe($item->product->discounted_price)
            ->and($order->subtotal)->toBe($item->unit_price * $item->qty)
            ->and($order->total)->toBe($order->subtotal + $order->shipping_cost);
    }
});
