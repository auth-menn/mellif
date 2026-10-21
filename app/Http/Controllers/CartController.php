<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCartItemRequest;
use App\Http\Requests\SyncCartRequest;
use App\Http\Requests\UpdateCartItemRequest;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CartController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $orderItems = 'items:id,order_id,product_name,size,qty,unit_price';

        return response()->json([
            'items' => $this->cartItems($user),
            'orders' => [
                'awaitingPayment' => $this->cartOrderSummaries(
                    Order::query()->whereBelongsTo($user)
                        ->where('payment_method_code', 'qris')
                        ->where('status', 'pending_payment')
                        ->where('qris_payment_status', 'unpaid')
                        ->where(function ($query) {
                            $query->whereNull('qris_expiry_time')
                                ->orWhere('qris_expiry_time', '>', now());
                        })
                        ->with($orderItems)
                        ->latest('created_at')
                        ->limit(10)
                        ->get(),
                ),
                'paid' => $this->cartOrderSummaries(
                    Order::query()->whereBelongsTo($user)
                        ->where('qris_payment_status', 'paid')
                        ->with($orderItems)
                        ->latest('created_at')
                        ->limit(10)
                        ->get(),
                ),
            ],
        ]);
    }

    public function store(StoreCartItemRequest $request): JsonResponse
    {
        $data = $request->validated();
        $item = DB::transaction(function () use ($data, $request): CartItem {
            $variant = $this->availableVariant($data['variant_id'], $data['quantity']);
            $item = CartItem::query()->whereBelongsTo($request->user())->where('product_variant_id', $variant->id)->lockForUpdate()->first();
            $quantity = ($item?->quantity ?? 0) + $data['quantity'];
            abort_unless($quantity <= $variant->stock, 422, 'Stok produk tidak mencukupi.');

            return $request->user()->cartItems()->updateOrCreate(
                ['product_variant_id' => $variant->id],
                ['quantity' => $quantity],
            );
        });

        return response()->json(['item' => $this->cartItemData($item->load('variant.product.images', 'variant.product.category'))], 201);
    }

    public function update(UpdateCartItemRequest $request, int $variant): JsonResponse
    {
        $data = $request->validated();
        $item = DB::transaction(function () use ($data, $request, $variant): CartItem {
            $availableVariant = $this->availableVariant($variant, $data['quantity']);
            $cartItem = CartItem::query()->whereBelongsTo($request->user())->where('product_variant_id', $variant)->lockForUpdate()->firstOrFail();
            $cartItem->update(['quantity' => $data['quantity']]);

            return $cartItem->load('variant.product.images', 'variant.product.category');
        });

        return response()->json(['item' => $this->cartItemData($item)]);
    }

    public function destroy(Request $request, int $variant): JsonResponse
    {
        $request->user()->cartItems()->where('product_variant_id', $variant)->delete();

        return response()->json(['items' => $this->cartItems($request->user())]);
    }

    public function sync(SyncCartRequest $request): JsonResponse
    {
        $itemsByVariant = collect($request->validated('items'))
            ->groupBy('variant_id')
            ->map(fn ($items): int => $items->sum('quantity'));

        if ($itemsByVariant->isNotEmpty()) {
            DB::transaction(function () use ($request, $itemsByVariant): void {
                $variants = ProductVariant::query()
                    ->with('product')
                    ->whereIn('id', $itemsByVariant->keys())
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                if ($variants->count() !== $itemsByVariant->count()) {
                    abort(422, 'Produk berubah. Perbarui keranjang Anda.');
                }

                $existingCartItems = CartItem::query()
                    ->whereBelongsTo($request->user())
                    ->whereIn('product_variant_id', $itemsByVariant->keys())
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('product_variant_id');
                $timestamp = now();
                $rows = [];

                foreach ($itemsByVariant as $variantId => $requestedQuantity) {
                    $variant = $variants->get((int) $variantId);

                    if (! $variant->product->is_active || $variant->stock < 1) {
                        continue;
                    }

                    $existingQuantity = $existingCartItems->get($variant->id)?->quantity ?? 0;
                    $rows[] = [
                        'user_id' => $request->user()->id,
                        'product_variant_id' => $variant->id,
                        'quantity' => min($variant->stock, $existingQuantity + $requestedQuantity),
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ];
                }

                if ($rows !== []) {
                    CartItem::query()->upsert($rows, ['user_id', 'product_variant_id'], ['quantity', 'updated_at']);
                }
            });
        }

        return response()->json(['items' => $this->cartItems($request->user())]);
    }

    /** @return array<int, array<string, mixed>> */
    private function cartItems(User $user): array
    {
        return $user->cartItems()->with('variant.product.images', 'variant.product.category')->get()
            ->map(fn (CartItem $item): array => $this->cartItemData($item))->all();
    }

    /** @param Collection<int, Order> $orders
     * @return array<int, array<string, mixed>>
     */
    private function cartOrderSummaries(Collection $orders): array
    {
        return $orders->map(fn (Order $order): array => [
            'id' => $order->id,
            'orderNumber' => $order->order_number,
            'total' => $order->total,
            'status' => $order->status,
            'paymentStatus' => $order->qris_payment_status,
            'createdAt' => $order->created_at?->toIso8601String(),
            'items' => $order->items->map(fn ($item): array => [
                'productName' => $item->product_name,
                'size' => $item->size,
                'quantity' => $item->qty,
                'unitPrice' => $item->unit_price,
            ])->all(),
        ])->all();
    }

    /** @return array<string, mixed> */
    private function cartItemData(CartItem $item): array
    {
        $product = $item->variant->product;

        return [
            'quantity' => $item->quantity,
            'variant' => ['id' => $item->variant->id, 'size' => $item->variant->size, 'stock' => $item->variant->stock],
            'product' => [
                'id' => $product->id, 'name' => $product->name, 'slug' => $product->slug,
                'description' => $product->description, 'price' => $product->price, 'weight' => $product->weight,
                'discount_percent' => $product->discount_percent, 'discounted_price' => $product->discounted_price,
                'is_featured' => $product->is_featured, 'category' => $product->category?->name,
                'images' => $product->images->map(fn ($image): string => asset('storage/'.$image->path))->all(),
                'variants' => [], 'stock' => $item->variant->stock,
            ],
        ];
    }

    private function availableVariant(int $variantId, int $quantity): ProductVariant
    {
        $variant = ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($variantId);
        abort_unless($variant->product->is_active && $variant->stock >= $quantity, 422, 'Stok produk tidak mencukupi.');

        return $variant;
    }
}
