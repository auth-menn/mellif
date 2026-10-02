<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            return;
        }

        $categoryNames = ['T-Shirt', 'Hoodie', 'Outerwear', 'Pants', 'Accessories'];
        $categories = collect($categoryNames)->values()->mapWithKeys(
            fn (string $name, int $index): array => [str($name)->slug()->toString() => Category::query()->updateOrCreate(
                ['slug' => str($name)->slug()->toString()],
                ['name' => $name, 'sort_order' => $index],
            )],
        );

        $products = [
            ['Everyday Tee', 149000, 20],
            ['Studio Graphic Tee', 189000, null],
            ['Heavyweight Tee', 229000, 10],
            ['Core Hoodie', 329000, 15],
            ['Zip Hoodie', 359000, null],
            ['Utility Jacket', 459000, 20],
            ['Canvas Overshirt', 389000, null],
            ['Relaxed Chino', 279000, 10],
            ['Cargo Pants', 319000, null],
            ['Daily Cap', 99000, 5],
            ['Canvas Tote', 129000, null],
            ['Silver Chain', 179000, 15],
        ];
        $sizes = ['S', 'M', 'L', 'XL'];

        foreach ($products as $index => [$name, $price, $discount]) {
            $slug = str($name)->slug()->toString();
            $product = Product::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'category_id' => $categories->values()[$index % count($categoryNames)]->id,
                    'name' => $name,
                    'description' => 'Dirancang untuk pemakaian sehari-hari dengan material pilihan dan potongan yang nyaman.',
                    'price' => $price,
                    'discount_percent' => $discount,
                    'is_featured' => in_array($index, [0, 3, 5, 9], true),
                    'is_active' => $index !== 11,
                ],
            );

            $product->images()->updateOrCreate(
                ['path' => 'products/placeholder.svg'],
                ['sort_order' => 0],
            );

            $stockBySize = match ($index) {
                1 => [2, 1, 1, 1],
                2 => [0, 0, 0, 0],
                default => [10, 8, 6, 4],
            };

            foreach ($sizes as $sizeIndex => $size) {
                $product->variants()->firstOrCreate(
                    ['size' => $size],
                    ['stock' => $stockBySize[$sizeIndex]],
                );
            }
        }
    }
}
