<?php

namespace App\Http\Responses;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Laravel\Fortify\Contracts\LoginResponse;

class AuthenticatedLoginResponse implements LoginResponse
{
    /**
     * Keep modal-based authentication on the page where it was submitted.
     */
    public function toResponse($request): JsonResponse|RedirectResponse
    {
        if ($request->wantsJson()) {
            $request->session()->forget('url.intended');

            return response()->json(['two_factor' => false]);
        }

        $intended = $request->session()->pull('url.intended');
        $redirect = $this->safeInternalPath($intended, $request)
            ?? route('home');

        return redirect()->to($redirect);
    }

    private function safeInternalPath(mixed $url, Request $request): ?string
    {
        if (! is_string($url) || str_contains($url, '\\') || preg_match('/[\r\n]/', $url)) {
            return null;
        }

        if (str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
            return $url;
        }

        if (rtrim($url, '/') === rtrim($request->getSchemeAndHttpHost(), '/')) {
            return '/';
        }

        $parts = parse_url($url);
        if ($parts === false || ! isset($parts['host']) || strtolower($parts['host']) !== strtolower($request->getHost())) {
            return null;
        }

        $origin = ($parts['scheme'] ?? $request->getScheme()).'://'.$parts['host'];
        if (isset($parts['port'])) {
            $origin .= ':'.$parts['port'];
        }

        if (rtrim($origin, '/') !== rtrim($request->getSchemeAndHttpHost(), '/')) {
            return null;
        }

        return ($parts['path'] ?? '/').(isset($parts['query']) ? '?'.$parts['query'] : '').(isset($parts['fragment']) ? '#'.$parts['fragment'] : '');
    }
}
