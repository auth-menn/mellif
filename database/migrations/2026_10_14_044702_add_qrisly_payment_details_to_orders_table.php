<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('payment_method_code')->nullable()->after('payment_method');
            $table->unsignedBigInteger('qrisly_history_id')->nullable()->unique();
            $table->longText('qris_string')->nullable();
            $table->unsignedInteger('qris_original_amount')->nullable();
            $table->unsignedInteger('qris_final_amount')->nullable();
            $table->dateTime('qris_expiry_time')->nullable();
            $table->string('qris_payment_status')->nullable()->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropUnique(['qrisly_history_id']);
            $table->dropIndex(['qris_payment_status']);
            $table->dropColumn([
                'payment_method_code', 'qrisly_history_id', 'qris_string', 'qris_original_amount',
                'qris_final_amount', 'qris_expiry_time', 'qris_payment_status',
            ]);
        });
    }
};
