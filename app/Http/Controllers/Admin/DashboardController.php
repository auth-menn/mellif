<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('admin/dashboard', [
            'stats' => [
                'orders_today' => Order::query()->whereDate('created_at', today())->count(),
                'pending_orders' => Order::query()->where('status', 'pending_payment')->count(),
                'products' => Product::query()->count(),
                'low_stock' => ProductVariant::query()->where('stock', '<=', 5)->count(),
            ],
            'recentOrders' => Order::query()->with('user:id,name')->latest()->limit(5)->get([
                'id', 'user_id', 'order_number', 'total', 'status', 'created_at',
            ]),
            'manualReviewOrders' => Order::query()
                ->with('user:id,name')
                ->where('qris_payment_status', 'paid')
                ->where(function ($query): void {
                    $query->whereIn('status', ['cancelled', 'rejected'])
                        ->orWhere(function ($query): void {
                            $query->where('status', 'paid')->where('stock_deducted', false);
                        });
                })
                ->latest()
                ->limit(20)
                ->get(['id', 'user_id', 'order_number', 'total', 'status', 'stock_deducted', 'created_at'])
                ->map(fn (Order $order): array => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'total' => $order->total,
                    'created_at' => $order->created_at,
                    'customer' => $order->user?->name,
                    'reason' => in_array($order->status, ['cancelled', 'rejected'], true) ? 'paid_after_cancellation' : 'insufficient_stock',
                ]),
        ]);
    }
}
