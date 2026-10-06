<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            $table->dropForeign(['product_id']);
            $table->dropForeign(['variant_id']);
            $table->unsignedBigInteger('product_id')->nullable()->change();
            $table->unsignedBigInteger('variant_id')->nullable()->change();
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
            $table->foreign('variant_id')->references('id')->on('product_variants')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::table('order_items')->whereNull('product_id')->orWhereNull('variant_id')->exists()) {
            throw new RuntimeException('Cannot restore required product references while order items contain deleted products or variants.');
        }

        Schema::table('order_items', function (Blueprint $table): void {
            $table->dropForeign(['product_id']);
            $table->dropForeign(['variant_id']);
            $table->unsignedBigInteger('product_id')->nullable(false)->change();
            $table->unsignedBigInteger('variant_id')->nullable(false)->change();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->foreign('variant_id')->references('id')->on('product_variants')->restrictOnDelete();
        });
    }
};
