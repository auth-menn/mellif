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
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('weight')->default(500);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('shipping_courier_code')->nullable();
            $table->string('shipping_service')->nullable();
            $table->string('shipping_etd')->nullable();
            $table->unsignedInteger('destination_id')->nullable();
            $table->string('destination_label')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['shipping_courier_code', 'shipping_service', 'shipping_etd', 'destination_id', 'destination_label']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('weight');
        });
    }
};
