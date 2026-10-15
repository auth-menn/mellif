<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $couriers = DB::table('shipping_couriers')->orderBy('id')->get(['id', 'code', 'is_active']);
        $normalized = [];
        foreach ($couriers as $courier) {
            $code = strtolower(trim((string) $courier->code));
            $code = match ($code) {
                'jne-reg' => 'jne',
                'sicepat-reg' => 'sicepat',
                default => $code,
            };
            $normalized[$code][] = $courier;
        }

        $preferredRows = [];
        foreach ($normalized as $code => $rows) {
            usort($rows, fn (object $left, object $right): int => ((int) $right->is_active <=> (int) $left->is_active) ?: ($left->id <=> $right->id));
            $preferredRows[$code] = $rows;
        }

        foreach ($couriers as $courier) {
            DB::table('shipping_couriers')->where('id', $courier->id)->update(['code' => '__shipping_stage_'.$courier->id]);
        }

        $usedCodes = array_fill_keys(array_keys($preferredRows), true);
        foreach ($preferredRows as $code => $rows) {
            $preferred = array_shift($rows);
            DB::table('shipping_couriers')->where('id', $preferred->id)->update(['code' => $code]);
            foreach ($rows as $courier) {
                $legacyCode = 'legacy-'.$courier->id;
                $suffix = 1;
                while (isset($usedCodes[$legacyCode])) {
                    $legacyCode = 'legacy-'.$courier->id.'-'.$suffix++;
                }
                $usedCodes[$legacyCode] = true;
                DB::table('shipping_couriers')->where('id', $courier->id)->update([
                    'code' => $legacyCode,
                    'is_active' => false,
                ]);
            }
        }

        Schema::table('shipping_couriers', function (Blueprint $table): void {
            $table->index(['is_active', 'code'], 'shipping_couriers_active_code_index');
        });
        Cache::forget('shipping:active-courier-codes');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipping_couriers', function (Blueprint $table): void {
            $table->dropIndex('shipping_couriers_active_code_index');
        });
    }
};
