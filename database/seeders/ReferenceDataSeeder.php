<?php

namespace Database\Seeders;

use App\Models\PaymentMethod;
use App\Models\ShippingCourier;
use App\Models\StoreSetting;
use Illuminate\Database\Seeder;

class ReferenceDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach ([
            ['name' => 'JNE Reguler', 'code' => 'jne-reg', 'flat_cost' => 18000],
            ['name' => 'J&T Express', 'code' => 'jnt', 'flat_cost' => 19000],
            ['name' => 'SiCepat REG', 'code' => 'sicepat-reg', 'flat_cost' => 20000],
        ] as $courier) {
            ShippingCourier::query()->firstOrCreate(
                ['code' => $courier['code']],
                [...$courier, 'is_active' => true],
            );
        }

        PaymentMethod::query()->firstOrCreate(
            ['code' => 'qris'],
            ['name' => 'QRIS', 'is_active' => true],
        );

        StoreSetting::query()->firstOrCreate(
            ['key' => 'tagline'],
            ['value' => 'Made to move with your own rhythm.'],
        );

        StoreSetting::query()->firstOrCreate(
            ['key' => 'hero_image'],
            ['value' => null],
        );
    }
}
