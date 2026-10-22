<?php

use App\Models\Order;
use App\Models\User;

it('shows customer contact and order activity to admins', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $customer = User::factory()->create([
        'name' => 'Customer One',
        'email' => 'customer-one@example.com',
        'phone' => '081234567890',
    ]);
    User::factory()->unverified()->create(['name' => 'Customer Two']);
    Order::query()->create([
        'user_id' => $customer->id,
        'order_number' => 'MLF-TEST-USER-001',
        'recipient_name' => $customer->name,
        'phone' => $customer->phone,
        'address' => 'Gresik',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 18000,
        'payment_method' => 'QRIS',
        'subtotal' => 100000,
        'total' => 118000,
        'status' => 'processing',
    ]);

    $this->actingAs($admin)->get(route('admin.users.index', ['search' => 'customer-one']))
        ->assertInertia(fn ($page) => $page
            ->component('admin/users/index')
            ->where('users.data.0.name', 'Customer One')
            ->where('users.data.0.email', 'customer-one@example.com')
            ->where('users.data.0.phone', '081234567890')
            ->where('users.data.0.orders_count', 1)
            ->where('stats.total', 2)
            ->where('stats.verified', 1)
            ->where('stats.withOrders', 1));
});

it('forbids customers from viewing the admin user monitor', function () {
    $customer = User::factory()->create();

    $this->actingAs($customer)->get(route('admin.users.index'))->assertForbidden();
});
