<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class DemoCustomerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            return;
        }

        $password = config('services.mellif.demo_password');

        if (! is_string($password) || $password === '') {
            throw new RuntimeException('DEMO_PASSWORD must be set before running DemoCustomerSeeder in local or testing.');
        }

        foreach (range(1, 5) as $number) {
            $isGoogleAccount = $number === 5;
            $customer = User::query()->updateOrCreate(
                ['email' => "customer{$number}@mellif.test"],
                [
                    'name' => "Mellif Customer {$number}",
                    'password' => $isGoogleAccount ? null : $password,
                    'phone' => '08123000000',
                    'google_id' => $isGoogleAccount ? 'mellif-demo-google-customer-5' : null,
                ],
            );

            $customer->forceFill([
                'is_admin' => false,
                'email_verified_at' => $number === 4 ? null : now(),
            ])->save();
        }
    }
}
