<?php

use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: static function (): void {
            Route::middleware('api')->group(base_path('routes/webhooks.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['admin' => EnsureUserIsAdmin::class]);
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state', 'locale']);
        $middleware->redirectGuestsTo(fn (): string => route('home', ['auth' => 'login'], absolute: false));

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson() || $request->header('X-Inertia') === 'true',
        );

        $exceptions->respond(function (Response $response, Throwable $exception, Request $request): Response {
            if (! in_array($response->getStatusCode(), [403, 404], true) || $request->expectsJson()) {
                return $response;
            }

            $status = $response->getStatusCode();

            return Inertia::render('errors/unavailable', ['status' => $status])
                ->toResponse($request)
                ->setStatusCode($status);
        });
    })->create();
