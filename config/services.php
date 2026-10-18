<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

    'rajaongkir' => [
        'key' => env('RAJAONGKIR_KEY'),
        'base_url' => env('RAJAONGKIR_BASE_URL', 'https://rajaongkir.komerce.id/api/v1'),
        'origin_id' => env('RAJAONGKIR_ORIGIN_ID'),
        'daily_limit' => env('RAJAONGKIR_DAILY_LIMIT', 90),
    ],

    'qrisly' => [
        'key' => env('QRISLY_KEY'),
        'qris_id' => env('QRISLY_QRIS_ID'),
        'base_url' => env('QRISLY_BASE_URL', 'https://api-sandbox.collaborator.komerce.id/user'),
        'webhook_token' => env('QRISLY_WEBHOOK_TOKEN'),
    ],

    'mellif' => [
        'admin_email' => env('ADMIN_EMAIL'),
        'admin_password' => env('ADMIN_PASSWORD'),
        'demo_password' => env('DEMO_PASSWORD'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
