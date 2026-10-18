<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Js;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;

class GoogleController extends Controller
{
    public function redirect(Request $request): RedirectResponse
    {
        $request->session()->put('auth.google.popup', $request->boolean('popup'));
        $request->session()->forget('auth.google.return_to');

        $returnTo = $this->safeInternalPath($request->query('return'), $request);
        if ($returnTo !== null) {
            $request->session()->put('auth.google.return_to', $returnTo);
        }

        $response = Socialite::driver('google')->with(['prompt' => 'select_account'])->redirect();

        $request->session()->save();

        return $response;
    }

    public function callback(Request $request): Response
    {
        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (InvalidStateException) {
            $request->session()->forget('auth.google.return_to');
            $fallbackUrl = Js::from(route('home', [
                'auth' => 'login',
                'auth_error' => 'google_state',
            ]));
            $origin = Js::from(rtrim((string) config('app.url'), '/'));

            return response('<!doctype html><html><body><script>if(window.opener&&!window.opener.closed){window.opener.postMessage({type:"mellif-auth-google-error"},'.$origin.');window.close();}else{window.location.replace('.$fallbackUrl.');}</script>Sesi login Google kedaluwarsa. Silakan coba lagi.</body></html>');
        }
        $user = User::query()->where('google_id', $googleUser->getId())->first();

        if (! $user) {
            $user = User::query()->where('email', $googleUser->getEmail())->first();
        }

        if ($user) {
            $user->forceFill([
                'google_id' => $googleUser->getId(),
                'avatar' => $googleUser->getAvatar(),
                'email_verified_at' => $user->email_verified_at ?? now(),
            ])->save();
        } else {
            $user = User::query()->create([
                'name' => $googleUser->getName() ?: 'Mellif Member',
                'email' => $googleUser->getEmail(),
                'google_id' => $googleUser->getId(),
                'avatar' => $googleUser->getAvatar(),
                'email_verified_at' => now(),
            ]);
        }

        Auth::login($user, true);
        $request->session()->regenerate();

        $popup = $request->session()->pull('auth.google.popup', false);
        $returnTo = $this->safeInternalPath($request->session()->pull('auth.google.return_to'), $request)
            ?? $this->safeInternalPath($request->session()->pull('url.intended'), $request);

        if (! $popup) {
            return redirect()->to($returnTo ?? route('home'));
        }

        $origin = Js::from(rtrim((string) config('app.url'), '/'));
        $safeReturnTo = Js::from($returnTo);

        return response('<!doctype html><html><body><script>window.opener?.postMessage({type:"mellif-auth-complete",returnTo:'.$safeReturnTo.'},'.$origin.');window.close();</script>Berhasil login. Anda dapat menutup jendela ini.</body></html>');
    }

    private function safeInternalPath(mixed $path, Request $request): ?string
    {
        if (! is_string($path) || str_contains($path, '\\') || preg_match('/[\r\n]/', $path)) {
            return null;
        }

        if (str_starts_with($path, '/') && ! str_starts_with($path, '//')) {
            return $path;
        }

        $parts = parse_url($path);
        if ($parts === false || ! isset($parts['host']) || strtolower($parts['host']) !== strtolower($request->getHost()) || isset($parts['user']) || isset($parts['pass'])) {
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
