<?php

namespace Database\Seeders;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DemoOrderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            return;
        }

        DB::transaction(function (): void {
            $previouslyReserved = Order::query()
                ->with('items')
                ->where('order_number', 'like', 'DEMO-%')
                ->whereIn('status', ['pending_payment', 'paid', 'processing'])
                ->get()
                ->flatMap(fn (Order $order) => $order->items)
                ->groupBy('variant_id')
                ->map(fn ($items): int => $items->sum('qty'));

            $demoOrders = [
                ['number' => 'DEMO-2026-0001', 'customer' => 1, 'slug' => 'core-hoodie', 'status' => 'pending_payment', 'quantity' => 2],
                ['number' => 'DEMO-2026-0002', 'customer' => 2, 'slug' => 'zip-hoodie', 'status' => 'paid', 'quantity' => 1],
                ['number' => 'DEMO-2026-0003', 'customer' => 3, 'slug' => 'utility-jacket', 'status' => 'processing', 'quantity' => 1],
                ['number' => 'DEMO-2026-0004', 'customer' => 4, 'slug' => 'canvas-overshirt', 'status' => 'rejected', 'quantity' => 1],
                ['number' => 'DEMO-2026-0005', 'customer' => 5, 'slug' => 'relaxed-chino', 'status' => 'cancelled', 'quantity' => 1],
            ];
            $reservedAfterSeeding = collect();

            foreach ($demoOrders as $data) {
                $user = User::query()->where('email', "customer{$data['customer']}@mellif.test")->first();
                $product = Product::query()->where('slug', $data['slug'])->first();

                if (! $user || ! $product) {
                    throw new RuntimeException('Run DemoCustomerSeeder and CatalogSeeder before DemoOrderSeeder.');
                }

                $variant = $product->variants()->where('size', 'S')->first();

                if (! $variant instanceof ProductVariant) {
                    throw new RuntimeException("Demo product [{$data['slug']}] is missing its S variant.");
                }

                $unitPrice = $product->discounted_price;
                $subtotal = $unitPrice * $data['quantity'];
                $order = Order::query()->updateOrCreate(
                    ['order_number' => $data['number']],
                    [
                        'user_id' => $user->id,
                        'recipient_name' => $user->name,
                        'phone' => $user->phone ?? '08123000000',
                        'address' => 'Jl. Pengembangan No. 1, Jakarta',
                        'address_detail' => 'Contoh data untuk pengembangan',
                        'shipping_courier' => 'JNE Reguler',
                        'shipping_cost' => 18000,
                        'payment_method' => 'QRIS',
                        'subtotal' => $subtotal,
                        'total' => $subtotal + 18000,
                        'status' => $data['status'],
                        'notes' => 'Contoh order untuk pengembangan.',
                    ],
                );

                $order->items()->updateOrCreate(
                    ['variant_id' => $variant->id],
                    [
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'size' => $variant->size,
                        'qty' => $data['quantity'],
                        'unit_price' => $unitPrice,
                    ],
                );

                if (in_array($data['status'], ['pending_payment', 'paid', 'processing'], true)) {
                    $reservedAfterSeeding->put(
                        $variant->id,
                        ($reservedAfterSeeding->get($variant->id, 0)) + $data['quantity'],
                    );
                }
            }

            foreach ($previouslyReserved->keys()->merge($reservedAfterSeeding->keys())->unique() as $variantId) {
                ProductVariant::query()->whereKey($variantId)->increment(
                    'stock',
                    $previouslyReserved->get($variantId, 0) - $reservedAfterSeeding->get($variantId, 0),
                );
            }
        });
    }
}
