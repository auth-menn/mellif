<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ShippingCourier;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $categories = collect(['T-Shirt', 'Hoodie', 'Outerwear', 'Pants', 'Accessories'])->mapWithKeys(
            fn (string $name, int $index) => [$name => Category::query()->updateOrCreate(['slug' => str($name)->slug()], ['name' => $name, 'sort_order' => $index])],
        );
        $names = ['Everyday Tee', 'Studio Graphic Tee', 'Heavyweight Tee', 'Core Hoodie', 'Zip Hoodie', 'Utility Jacket', 'Canvas Overshirt', 'Relaxed Chino', 'Cargo Pants', 'Daily Cap', 'Canvas Tote', 'Silver Chain'];
        foreach ($names as $index => $name) {
            $category = $categories->values()[$index % $categories->count()];
            $product = Product::query()->updateOrCreate(['slug' => str($name)->slug()], [
                'category_id' => $category->id, 'name' => $name,
                'description' => 'Dirancang untuk pemakaian sehari-hari dengan material pilihan dan potongan yang nyaman.',
                'price' => 149000 + ($index * 18000), 'discount_percent' => $index % 3 === 0 ? 20 : null,
                'is_featured' => $index < 4, 'is_active' => true,
            ]);
            $product->images()->firstOrCreate(['path' => 'products/placeholder.svg'], ['sort_order' => 0]);
            foreach (['S', 'M', 'L', 'XL'] as $sizeIndex => $size) {
                $product->variants()->updateOrCreate(['size' => $size], ['stock' => 8 - (($index + $sizeIndex) % 7)]);
            }
        }

        foreach ([['JNE Reguler', 'jne-reg', 18000], ['SiCepat REG', 'sicepat-reg', 20000], ['J&T Express', 'jnt', 19000]] as [$name, $code, $cost]) {
            ShippingCourier::query()->updateOrCreate(['code' => $code], ['name' => $name, 'flat_cost' => $cost, 'is_active' => true]);
        }
        PaymentMethod::query()->updateOrCreate(['code' => 'qris'], ['name' => 'QRIS', 'is_active' => true]);

        $adminEmail = env('ADMIN_EMAIL');
        $adminPassword = env('ADMIN_PASSWORD');
        if ($adminEmail && $adminPassword) {
            User::query()->updateOrCreate(['email' => $adminEmail], ['name' => 'Mellif Admin', 'password' => $adminPassword, 'is_admin' => true, 'email_verified_at' => now()]);
        }
    }
}
