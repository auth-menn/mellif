<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCartItemRequest;
use App\Http\Requests\SyncCartRequest;
use App\Http\Requests\UpdateCartItemRequest;
use App\Models\CartItem;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CartController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['items' => $this->cartItems($request->user())]);
    }

    public function store(StoreCartItemRequest $request): JsonResponse
    {
        $data = $request->validated();
        $item = DB::transaction(function () use ($data, $request): CartItem {
            $variant = $this->availableVariant($data['variant_id'], $data['quantity']);
            $item = CartItem::query()->whereBelongsTo($request->user())->where('product_variant_id', $variant->id)->lockForUpdate()->first();
            $quantity = min($variant->stock, ($item?->quantity ?? 0) + $data['quantity']);

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
        DB::transaction(function () use ($request): void {
            foreach ($request->validated('items') as $item) {
                $variant = ProductVariant::query()->with('product')->lockForUpdate()->findOrFail($item['variant_id']);
                if (! $variant->product->is_active || $variant->stock < 1) {
                    continue;
                }

                $cartItem = CartItem::query()->whereBelongsTo($request->user())
                    ->where('product_variant_id', $variant->id)->lockForUpdate()->first();
                $quantity = min($variant->stock, ($cartItem?->quantity ?? 0) + $item['quantity']);
                $request->user()->cartItems()->updateOrCreate(
                    ['product_variant_id' => $variant->id],
                    ['quantity' => $quantity],
                );
            }
        });

        return response()->json(['items' => $this->cartItems($request->user())]);
    }

    /** @return array<int, array<string, mixed>> */
    private function cartItems(User $user): array
    {
        return $user->cartItems()->with('variant.product.images', 'variant.product.category')->get()
            ->map(fn (CartItem $item): array => $this->cartItemData($item))->all();
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
                'description' => $product->description, 'price' => $product->price,
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
