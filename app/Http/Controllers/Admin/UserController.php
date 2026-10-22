<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $customers = User::query()->where('is_admin', false);

        $stats = [
            'total' => (clone $customers)->count(),
            'verified' => (clone $customers)->whereNotNull('email_verified_at')->count(),
            'withOrders' => (clone $customers)->has('orders')->count(),
        ];

        $users = (clone $customers)
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query->where('name', 'like', '%'.$search.'%')
                        ->orWhere('email', 'like', '%'.$search.'%')
                        ->orWhere('phone', 'like', '%'.$search.'%');
                });
            })
            ->select(['id', 'name', 'email', 'phone', 'email_verified_at', 'created_at'])
            ->withCount('orders')
            ->withMax('orders', 'created_at')
            ->latest()
            ->paginate(20)
            ->withQueryString()
            ->through(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'email_verified_at' => $user->email_verified_at?->toIso8601String(),
                'created_at' => $user->created_at?->toIso8601String(),
                'orders_count' => $user->orders_count,
                'last_order_at' => $user->orders_max_created_at,
            ]);

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'filters' => ['search' => $search],
            'stats' => $stats,
        ]);
    }
}
