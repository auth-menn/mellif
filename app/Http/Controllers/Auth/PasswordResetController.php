<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Http\Controllers\NewPasswordController as FortifyNewPasswordController;

class PasswordResetController extends Controller
{
    /**
     * Show the password reset form for both signed-in and guest users.
     */
    public function show(Request $request, string $token): Response
    {
        return Inertia::render('auth/reset-password', [
            'email' => $request->query('email', ''),
            'token' => $token,
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
            'resetPasswordUrl' => route('password.reset.custom.update'),
        ]);
    }

    /**
     * Delegate token validation and password updates to Fortify.
     */
    public function update(Request $request, FortifyNewPasswordController $controller): Responsable
    {
        return $controller->store($request);
    }
}
