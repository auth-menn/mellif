<?php

use App\Http\Controllers\QrislyWebhookController;
use Illuminate\Support\Facades\Route;

Route::post('/webhooks/qrisly/{token}', QrislyWebhookController::class)
    ->middleware('throttle:qrisly-webhook')
    ->where('token', '[^/]+')
    ->name('webhooks.qrisly');
