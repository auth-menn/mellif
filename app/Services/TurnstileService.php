<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

class TurnstileService
{
    public function verify(string $token, ?string $ipAddress): bool
    {
        $secretKey = config('services.turnstile.secret_key');
        $expectedHostname = parse_url((string) config('app.url'), PHP_URL_HOST);

        if (! is_string($secretKey) || $secretKey === '' || ! is_string($expectedHostname) || $expectedHostname === '') {
            return false;
        }

        try {
            $response = Http::asForm()
                ->connectTimeout(3)
                ->timeout(5)
                ->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                    'secret' => $secretKey,
                    'response' => $token,
                    'remoteip' => $ipAddress,
                ]);
        } catch (Throwable) {
            return false;
        }

        $result = $response->json();

        return $response->successful()
            && is_array($result)
            && ($result['success'] ?? false) === true
            && ($result['action'] ?? null) === 'checkout'
            && ($result['hostname'] ?? null) === $expectedHostname;
    }
}
