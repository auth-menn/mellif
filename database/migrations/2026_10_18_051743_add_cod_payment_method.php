<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! DB::table('payment_methods')->where('code', 'cod')->exists()) {
            DB::table('payment_methods')->insert([
                'name' => 'COD (Bayar di Tempat)',
                'code' => 'cod',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('payment_methods')->where('code', 'cod')->delete();
    }
};
