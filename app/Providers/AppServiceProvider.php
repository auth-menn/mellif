<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        RateLimiter::for('shipping-destinations', fn (Request $request): Limit => Limit::perMinute(20)->by($request->ip())->response(
            fn (Request $request, array $headers) => response()->json(['message' => 'Terlalu banyak pencarian tujuan. Coba lagi sebentar.'], 429, $headers),
        ));
        RateLimiter::for('shipping-rates', fn (Request $request): Limit => Limit::perMinute(15)->by($request->ip())->response(
            fn (Request $request, array $headers) => response()->json(['message' => 'Terlalu banyak permintaan ongkir. Coba lagi sebentar.'], 429, $headers),
        ));
        RateLimiter::for('checkout', fn (Request $request): Limit => Limit::perMinute(6)->by((string) ($request->user()?->id ?? $request->ip()))->response(
            fn (Request $request, array $headers) => $request->expectsJson()
                ? response()->json(['message' => 'Terlalu banyak percobaan checkout. Coba lagi sebentar.'], 429, $headers)
                : back()->withErrors(['items' => 'Terlalu banyak percobaan checkout. Coba lagi sebentar.']),
        ));
        RateLimiter::for('qrisly-webhook', fn (Request $request): Limit => Limit::perMinute(60)->by((string) $request->ip()));
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
