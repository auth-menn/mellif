<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('payment_methods')->where('code', 'cod')->update([
            'is_active' => false,
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('payment_methods')->where('code', 'cod')->update([
            'is_active' => true,
            'updated_at' => now(),
        ]);
    }
};
