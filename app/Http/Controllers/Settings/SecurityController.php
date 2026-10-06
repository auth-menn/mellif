<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Http\Requests\Settings\TwoFactorAuthenticationRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password as PasswordFacade;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class SecurityController extends Controller
{
    /**
     * Show the user's security settings page.
     */
    public function edit(TwoFactorAuthenticationRequest $request): Response
    {
        $props = [
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ];

        return Inertia::render('settings/security', $props);
    }

    /**
     * Update the user's password.
     */
    public function update(PasswordUpdateRequest $request): RedirectResponse
    {
        $request->user()->update([
            'password' => $request->password,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Password updated.')]);

        return back();
    }

    /**
     * Send a password reset link to the authenticated user's own email address.
     */
    public function sendResetLink(Request $request): RedirectResponse
    {
        $status = PasswordFacade::broker(config('fortify.passwords'))->sendResetLink([
            'email' => $request->user()->getEmailForPasswordReset(),
        ]);

        if ($status === PasswordFacade::RESET_LINK_SENT) {
            return back()->with('status', 'password-reset-link-sent');
        }

        return back()->withErrors([
            'password_reset' => __($status),
        ]);
    }
}
