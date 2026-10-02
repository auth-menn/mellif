<?php

use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;

it('accepts login as JSON and establishes the session', function () {
    $user = User::factory()->create(['password' => Hash::make('Correct-Horse-Battery-2026!')]);

    $this->postJson(route('login.store'), [
        'email' => $user->email,
        'password' => 'Correct-Horse-Battery-2026!',
    ])->assertOk()->assertJson(['two_factor' => false]);

    $this->assertAuthenticatedAs($user);
});

it('registers a session through JSON without requiring email verification', function () {
    Event::fake([Registered::class]);

    $this->postJson(route('register.store'), [
        'name' => 'Checkout Buyer',
        'email' => 'checkout@example.test',
        'password' => 'Correct-Horse-Battery-2026!',
        'password_confirmation' => 'Correct-Horse-Battery-2026!',
    ])->assertCreated();

    $user = User::query()->where('email', 'checkout@example.test')->firstOrFail();
    $this->assertAuthenticatedAs($user);
    expect($user->email_verified_at)->toBeNull();
});
