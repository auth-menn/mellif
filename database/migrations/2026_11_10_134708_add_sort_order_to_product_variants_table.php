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
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedSmallInteger('sort_order')->default(0)->after('size');
        });

        DB::table('products')->select('id')->orderBy('id')->chunkById(200, function ($products): void {
            $variants = DB::table('product_variants')
                ->whereIn('product_id', $products->pluck('id'))
                ->get(['id', 'product_id', 'size'])
                ->groupBy('product_id');

            foreach ($variants as $productVariants) {
                $orderedVariants = $productVariants->sort(function (object $left, object $right): int {
                    $priority = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', 'ALL SIZE', 'ONE SIZE', 'FREE SIZE'];
                    $leftSize = mb_strtoupper(trim($left->size));
                    $rightSize = mb_strtoupper(trim($right->size));
                    $leftRank = array_search($leftSize, $priority, true);
                    $rightRank = array_search($rightSize, $priority, true);
                    $leftRank = $leftRank === false ? count($priority) : $leftRank;
                    $rightRank = $rightRank === false ? count($priority) : $rightRank;

                    return [$leftRank, $leftRank === count($priority) ? $leftSize : '', $left->id]
                        <=> [$rightRank, $rightRank === count($priority) ? $rightSize : '', $right->id];
                })->values();

                foreach ($orderedVariants as $position => $variant) {
                    DB::table('product_variants')->where('id', $variant->id)->update(['sort_order' => $position]);
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
