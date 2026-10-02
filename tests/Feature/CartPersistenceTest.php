<?php

use App\Models\CartItem;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;

function createCartVariant(int $stock = 5): ProductVariant
{
    $category = Category::query()->create(['name' => 'T-Shirt', 'slug' => 't-shirt']);
    $product = Product::query()->create([
        'category_id' => $category->id, 'name' => 'Everyday Tee', 'slug' => 'everyday-tee',
        'description' => 'Cotton', 'price' => 100000, 'is_active' => true,
    ]);

    return ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => $stock]);
}

it('stores and updates authenticated cart items while validating current stock', function () {
    $user = User::factory()->create();
    $variant = createCartVariant(4);

    $this->actingAs($user)->postJson(route('cart.items.store'), [
        'variant_id' => $variant->id,
        'quantity' => 2,
    ])->assertCreated()->assertJsonPath('item.quantity', 2);

    $this->putJson(route('cart.items.update', $variant->id), ['quantity' => 5])->assertUnprocessable();
    $this->getJson(route('cart.index'))->assertOk()->assertJsonPath('items.0.quantity', 2);
});

it('merges guest items into the account cart and caps quantities to available stock', function () {
    $user = User::factory()->create();
    $variant = createCartVariant(4);
    CartItem::query()->create(['user_id' => $user->id, 'product_variant_id' => $variant->id, 'quantity' => 2]);

    $this->actingAs($user)->postJson(route('cart.sync'), [
        'items' => [['variant_id' => $variant->id, 'quantity' => 5]],
    ])->assertOk()->assertJsonPath('items.0.quantity', 4);

    expect($user->cartItems()->count())->toBe(1);
    expect($user->cartItems()->firstOrFail()->quantity)->toBe(4);
});

it('requires authentication for server cart access', function () {
    $this->getJson(route('cart.index'))->assertUnauthorized();
});
