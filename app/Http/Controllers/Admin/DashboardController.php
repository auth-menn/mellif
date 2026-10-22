<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $today = today();
        $period = $request->query('period', 'monthly');
        if (! in_array($period, ['daily', 'monthly', 'yearly'], true)) {
            $period = 'monthly';
        }

        $periodStart = match ($period) {
            'daily' => $today->copy()->startOfDay(),
            'yearly' => $today->copy()->startOfYear(),
            default => $today->copy()->startOfMonth(),
        };
        $periodEnd = match ($period) {
            'daily' => $today->copy()->endOfDay(),
            'yearly' => $today->copy()->endOfYear(),
            default => $today->copy()->endOfMonth(),
        };
        $bucketExpression = match (Order::query()->getConnection()->getDriverName()) {
            'sqlite' => match ($period) {
                'daily' => "CAST(strftime('%H', created_at) AS INTEGER)",
                'yearly' => "CAST(strftime('%m', created_at) AS INTEGER)",
                default => 'DATE(created_at)',
            },
            'pgsql' => match ($period) {
                'daily' => 'EXTRACT(HOUR FROM created_at)::integer',
                'yearly' => 'EXTRACT(MONTH FROM created_at)::integer',
                default => 'DATE(created_at)',
            },
            'sqlsrv' => match ($period) {
                'daily' => 'DATEPART(HOUR, created_at)',
                'yearly' => 'DATEPART(MONTH, created_at)',
                default => 'CAST(created_at AS date)',
            },
            default => match ($period) {
                'daily' => 'HOUR(created_at)',
                'yearly' => 'MONTH(created_at)',
                default => 'DATE(created_at)',
            },
        };
        $revenueBuckets = Order::query()
            ->where('qris_payment_status', 'paid')
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->selectRaw("{$bucketExpression} as bucket, SUM(subtotal) as revenue, COUNT(*) as orders")
            ->groupByRaw($bucketExpression)
            ->get()
            ->keyBy(fn ($record): string => (string) $record->bucket);
        $periodCount = match ($period) {
            'daily' => 24,
            'yearly' => 12,
            default => $today->daysInMonth,
        };

        return Inertia::render('admin/dashboard', [
            'period' => $period,
            'stats' => [
                'orders_today' => Order::query()->whereDate('created_at', today())->count(),
                'pending_orders' => Order::query()->where('status', 'pending_payment')->count(),
                'products' => Product::query()->count(),
                'low_stock' => ProductVariant::query()->where('stock', '<=', 5)->count(),
                'customers' => User::query()->where('is_admin', false)->count(),
                'revenue_today' => Order::query()
                    ->where('qris_payment_status', 'paid')
                    ->whereDate('created_at', today())
                    ->sum('subtotal'),
                'revenue_month' => Order::query()
                    ->where('qris_payment_status', 'paid')
                    ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
                    ->sum('subtotal'),
            ],
            'revenueTrend' => collect(range(0, $periodCount - 1))->map(function (int $index) use ($period, $today, $revenueBuckets): array {
                $date = match ($period) {
                    'daily' => $today->copy()->startOfDay()->addHours($index),
                    'yearly' => $today->copy()->startOfYear()->addMonths($index),
                    default => $today->copy()->startOfMonth()->addDays($index),
                };
                $bucket = match ($period) {
                    'daily', 'yearly' => (string) ($index + ($period === 'yearly' ? 1 : 0)),
                    default => $date->toDateString(),
                };
                $record = $revenueBuckets->get($bucket);

                return [
                    'date' => $date->toIso8601String(),
                    'label' => match ($period) {
                        'daily' => $date->format('H'),
                        'yearly' => $date->format('n'),
                        default => $date->format('j'),
                    },
                    'revenue' => (int) ($record?->revenue ?? 0),
                    'orders' => (int) ($record?->orders ?? 0),
                ];
            })->values(),
            'ordersByStatus' => Order::query()
                ->selectRaw('status, COUNT(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status'),
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
