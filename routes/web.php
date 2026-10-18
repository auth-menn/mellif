<?php

use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\HomeSettingsController;
use App\Http\Controllers\Admin\OrderController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ShippingCourierController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\GoogleController;
use App\Http\Controllers\ShippingController;
use App\Http\Controllers\StorefrontController;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Http\Controllers\ConfirmablePasswordController;
use Laravel\Fortify\Http\Controllers\EmailVerificationPromptController;
use Laravel\Fortify\Http\Controllers\NewPasswordController;
use Laravel\Fortify\Http\Controllers\PasswordResetLinkController;

Route::get('/', [StorefrontController::class, 'home'])->name('home');
Route::get('/about', [StorefrontController::class, 'about'])->name('about');
Route::get('/shop', [StorefrontController::class, 'shop'])->name('shop.index');
Route::get('/shop/{product:slug}', [StorefrontController::class, 'product'])->name('shop.show');
Route::get('/login', fn () => abort(404));
Route::get('/register', fn () => abort(404));
Route::get('/forgot-password', [PasswordResetLinkController::class, 'create'])
    ->middleware('guest')
    ->name('password.request');
Route::get('/reset-password/{token}', [NewPasswordController::class, 'create'])
    ->middleware('guest')
    ->name('password.reset');
Route::get('/email/verify', EmailVerificationPromptController::class)
    ->middleware('auth')
    ->name('verification.notice');
Route::get('/user/confirm-password', [ConfirmablePasswordController::class, 'show'])
    ->middleware('auth')
    ->name('password.confirm');
Route::get('/checkout', [CheckoutController::class, 'show'])->name('checkout.show');
Route::post('/checkout', [CheckoutController::class, 'store'])->middleware(['auth', 'throttle:checkout'])->name('checkout.store');
Route::middleware(['auth', 'throttle:10,1'])->prefix('checkout/orders/{order}')->name('checkout.orders.')->group(function () {
    Route::get('/qris-status', [CheckoutController::class, 'paymentStatus'])->name('qris-status');
    Route::post('/qris', [CheckoutController::class, 'regenerateQris'])->name('qris.regenerate');
    Route::post('/cancel-payment', [CheckoutController::class, 'cancelQrisPayment'])->name('qris.cancel');
});
Route::get('/shipping/destinations', [ShippingController::class, 'destinations'])->middleware('throttle:shipping-destinations')->name('shipping.destinations');
Route::post('/shipping/rates', [ShippingController::class, 'rates'])->middleware('throttle:shipping-rates')->name('shipping.rates');
Route::get('/akun/reset-password/{token}', [PasswordResetController::class, 'show'])->name('password.reset.custom');
Route::post('/akun/reset-password', [PasswordResetController::class, 'update'])
    ->middleware('throttle:6,1')
    ->name('password.reset.custom.update');
Route::middleware('auth')->prefix('cart')->name('cart.')->group(function () {
    Route::get('/', [CartController::class, 'index'])->name('index');
    Route::post('/sync', [CartController::class, 'sync'])->name('sync');
    Route::post('/items', [CartController::class, 'store'])->name('items.store');
    Route::put('/items/{variant}', [CartController::class, 'update'])->name('items.update');
    Route::delete('/items/{variant}', [CartController::class, 'destroy'])->name('items.destroy');
});
Route::middleware('guest')->prefix('auth/google')->name('google.')->group(function () {
    Route::get('/', [GoogleController::class, 'redirect'])->name('redirect');
    Route::get('/callback', [GoogleController::class, 'callback'])->name('callback');
});

Route::middleware(['auth', 'admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', DashboardController::class)->name('dashboard');
    Route::patch('products/{product}/status', [ProductController::class, 'updateStatus'])->name('products.status');
    Route::resource('products', ProductController::class);
    Route::resource('categories', CategoryController::class);
    Route::resource('shipping', ShippingCourierController::class);
    Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
    Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
    Route::patch('orders/{order}', [OrderController::class, 'update'])->name('orders.update');
    Route::get('home-settings', [HomeSettingsController::class, 'edit'])->name('home-settings.edit');
    Route::put('home-settings', [HomeSettingsController::class, 'update'])->name('home-settings.update');
});

require __DIR__.'/settings.php';
