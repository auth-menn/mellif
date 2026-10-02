<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ChangeOrderStatusRequest;
use App\Models\Order;
use App\Models\ProductVariant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->string('status')->toString();
        $orders = Order::query()->with('user:id,name')->when(
            in_array($status, ['pending_payment', 'paid', 'processing', 'rejected', 'cancelled'], true),
            fn ($query) => $query->where('status', $status),
        )->latest()->paginate(20)->withQueryString();

        return Inertia::render('admin/orders/index', ['orders' => $orders, 'status' => $status]);
    }

    public function show(Order $order): Response
    {
        return Inertia::render('admin/orders/show', ['order' => $order->load(['user:id,name,email', 'items'])]);
    }

    public function update(ChangeOrderStatusRequest $request, Order $order): RedirectResponse
    {
        DB::transaction(function () use ($request, $order): void {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            $newStatus = $request->validated('status');
            $terminalStatuses = ['rejected', 'cancelled'];

            if (in_array($lockedOrder->status, $terminalStatuses, true)) {
                abort(422, 'Status pesanan yang sudah ditutup tidak dapat diubah.');
            }

            if (in_array($newStatus, $terminalStatuses, true)) {
                $lockedOrder->load('items');
                foreach ($lockedOrder->items as $item) {
                    $variant = ProductVariant::query()->lockForUpdate()->find($item->variant_id);
                    $variant?->increment('stock', $item->qty);
                }
            }

            $lockedOrder->update([
                'status' => $newStatus,
                'notes' => $request->validated('notes') ?? $lockedOrder->notes,
            ]);
        });

        return back()->with('success', 'Status pesanan diperbarui.');
    }
}
