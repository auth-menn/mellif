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
        ]);
    }
}
