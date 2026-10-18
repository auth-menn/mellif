<?php

use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Fortify\Features;

test('login page route is not available', function () {
    $this->get('/login')->assertNotFound();
});

test('guest routes keep a safe intended path and open the login modal', function () {
    $response = $this->get(route('cart.index', absolute: false));

    $response->assertRedirect(route('home', ['auth' => 'login'], absolute: false));
    $response->assertSessionHas('url.intended', url('/cart'));
});

test('inertia guest requests receive unauthorized status for the login modal', function () {
    $response = $this->withHeaders(['X-Inertia' => 'true'])->get(route('cart.index', absolute: false));

    $response->assertUnauthorized();
});

test('users can authenticate using the login screen', function () {
    $user = User::factory()->create();

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('home', absolute: false));
});

test('non-json login resumes a same origin intended path', function () {
    $user = User::factory()->create();

    $response = $this->withSession(['url.intended' => url('/cart')])->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertRedirect('/cart');
    $this->assertAuthenticatedAs($user);
});

test('non-json login rejects an external intended url', function () {
    $user = User::factory()->create();

    $response = $this->withSession(['url.intended' => 'https://example.com/'])->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertRedirect(route('home', absolute: false));
    $this->assertAuthenticatedAs($user);
});

test('json login rejects an external intended url', function () {
    $user = User::factory()->create();

    $response = $this->withSession(['url.intended' => 'https://example.com/'])->postJson(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertOk()->assertJsonMissingPath('redirect');
    $this->assertAuthenticatedAs($user);
});

test('json login stays in the frontend instead of resuming an intended path', function () {
    $user = User::factory()->create();

    $response = $this->withSession(['url.intended' => url('/cart')])->postJson(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertOk()->assertJsonMissingPath('redirect');
    $this->assertAuthenticatedAs($user);
});

test('admin json login also stays in the frontend', function () {
    $user = User::factory()->create();
    $user->forceFill(['is_admin' => true])->save();

    $response = $this->postJson(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertOk()->assertJsonMissingPath('redirect');
    $this->assertAuthenticatedAs($user);
});

test('users with two factor enabled are redirected to two factor challenge', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $user = User::factory()->withTwoFactor()->create();

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertRedirect(route('two-factor.login'));
    $response->assertSessionHas('login.id', $user->id);
    $this->assertGuest();
});

test('users can not authenticate with invalid password', function () {
    $user = User::factory()->create();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});

test('users can logout', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('logout'));

    $response->assertRedirect(route('home'));

    $this->assertGuest();
});

test('users are rate limited', function () {
    $user = User::factory()->create();

    RateLimiter::increment(md5('login'.implode('|', [$user->email, '127.0.0.1'])), amount: 5);

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertTooManyRequests();
});
