<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class TurnstileService
{
    public function verify(string $token, ?string $ipAddress): bool
    {
        $secretKey = config('services.turnstile.secret_key');
        $expectedHostname = parse_url((string) config('app.url'), PHP_URL_HOST);

        if (! is_string($secretKey) || $secretKey === '' || ! is_string($expectedHostname) || $expectedHostname === '') {
            Log::warning('Cloudflare Turnstile verification is not configured correctly.', [
                'failure_reason' => 'missing_configuration',
            ]);

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
        } catch (Throwable $exception) {
            Log::warning('Cloudflare Turnstile verification could not reach the provider.', [
                'failure_reason' => 'provider_connection_error',
                'exception' => $exception::class,
            ]);

            return false;
        }

        $result = $response->json();
        if (! $response->successful() || ! is_array($result)) {
            Log::warning('Cloudflare Turnstile returned an invalid verification response.', [
                'failure_reason' => 'provider_http_error',
                'http_status' => $response->status(),
            ]);

            return false;
        }

        if (($result['success'] ?? false) !== true) {
            Log::warning('Cloudflare Turnstile rejected the verification token.', [
                'failure_reason' => 'provider_rejected_token',
                'error_codes' => $result['error-codes'] ?? [],
            ]);

            return false;
        }

        if (($result['action'] ?? null) !== 'checkout') {
            Log::warning('Cloudflare Turnstile returned an unexpected action.', [
                'failure_reason' => 'action_mismatch',
                'action' => $result['action'] ?? null,
            ]);

            return false;
        }

        if (strtolower((string) ($result['hostname'] ?? '')) !== strtolower($expectedHostname)) {
            Log::warning('Cloudflare Turnstile returned an unexpected hostname.', [
                'failure_reason' => 'hostname_mismatch',
                'expected_hostname' => $expectedHostname,
                'hostname' => $result['hostname'] ?? null,
            ]);

            return false;
        }

        return true;
    }
}
