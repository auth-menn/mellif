<?php

use App\Models\Order;
use App\Models\User;

it('shows confirmed revenue trends and order status totals to admins', function () {
    $this->travelTo('2026-10-22 12:00:00');

    $admin = User::factory()->create(['is_admin' => true]);
    $customer = User::factory()->create();
    $secondCustomer = User::factory()->create();

    Order::query()->create([
        'user_id' => $customer->id,
        'order_number' => 'MLF-DASHBOARD-PAID-TODAY',
        'recipient_name' => $customer->name,
        'phone' => '081234567890',
        'address' => 'Gresik',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 0,
        'payment_method' => 'QRIS',
        'subtotal' => 50000,
        'total' => 55000,
        'status' => 'processing',
        'qris_payment_status' => 'paid',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $paidOrderFromSixDaysAgo = Order::query()->create([
        'user_id' => $secondCustomer->id,
        'order_number' => 'MLF-DASHBOARD-PAID-WEEK',
        'recipient_name' => $secondCustomer->name,
        'phone' => '081234567891',
        'address' => 'Surabaya',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 0,
        'payment_method' => 'QRIS',
        'subtotal' => 25000,
        'total' => 30000,
        'status' => 'paid',
        'qris_payment_status' => 'paid',
    ]);
    $paidOrderFromSixDaysAgo->forceFill([
        'created_at' => now()->subDays(6),
        'updated_at' => now()->subDays(6),
    ])->save();

    Order::query()->create([
        'user_id' => $customer->id,
        'order_number' => 'MLF-DASHBOARD-UNPAID',
        'recipient_name' => $customer->name,
        'phone' => '081234567890',
        'address' => 'Gresik',
        'shipping_courier' => 'JNE',
        'shipping_cost' => 0,
        'payment_method' => 'QRIS',
        'subtotal' => 90000,
        'total' => 90000,
        'status' => 'pending_payment',
        'qris_payment_status' => 'unpaid',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($admin)
        ->get(route('admin.dashboard'))
        ->assertInertia(fn ($page) => $page
            ->component('admin/dashboard')
            ->where('stats.revenue_today', 50000)
            ->where('stats.revenue_month', 75000)
            ->where('stats.pending_orders', 1)
            ->where('stats.customers', 2)
            ->where('period', 'monthly')
            ->has('revenueTrend', 31)
            ->where('revenueTrend.0.label', '1')
            ->where('revenueTrend.15.revenue', 25000)
            ->where('revenueTrend.21.revenue', 50000)
            ->where('ordersByStatus.processing', 1)
            ->where('ordersByStatus.pending_payment', 1));
});

it('returns seven date buckets for the selected weekly revenue period', function () {
    $this->travelTo('2026-10-22 12:00:00');
    $admin = User::factory()->create(['is_admin' => true]);

    $this->actingAs($admin)
        ->get(route('admin.dashboard', ['period' => 'weekly']))
        ->assertInertia(fn ($page) => $page
            ->where('period', 'weekly')
            ->has('revenueTrend', 7)
            ->where('revenueTrend.0.label', '2026-10-19')
            ->where('revenueTrend.6.label', '2026-10-25'));
});

it('returns monthly buckets for the selected yearly revenue period', function () {
    $this->travelTo('2026-10-22 12:00:00');
    $admin = User::factory()->create(['is_admin' => true]);

    $this->actingAs($admin)
        ->get(route('admin.dashboard', ['period' => 'yearly']))
        ->assertInertia(fn ($page) => $page
            ->where('period', 'yearly')
            ->has('revenueTrend', 12)
            ->where('revenueTrend.0.label', '1')
            ->where('revenueTrend.9.label', '10'));
});

it('forbids customers from viewing the admin dashboard', function () {
    $customer = User::factory()->create();

    $this->actingAs($customer)->get(route('admin.dashboard'))->assertForbidden();
});
