<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $email = config('services.mellif.admin_email');
        $password = config('services.mellif.admin_password');

        if (! is_string($email) || trim($email) === '' || ! is_string($password) || $password === '') {
            throw new RuntimeException('ADMIN_EMAIL and ADMIN_PASSWORD must both be set before running AdminUserSeeder.');
        }

        $admin = User::query()->updateOrCreate(
            ['email' => $email],
            ['name' => 'Mellif Admin', 'password' => $password],
        );

        $admin->forceFill([
            'is_admin' => true,
            'email_verified_at' => now(),
        ])->save();
    }
}
