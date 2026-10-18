use App\Models\User;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as GoogleUser;
use Laravel\Socialite\Two\InvalidStateException;
use Symfony\Component\HttpFoundation\RedirectResponse;

test('google redirect stores only a same origin fallback path', function () {
    $provider = Mockery::mock();
    $provider->shouldReceive('with')->once()->with(['prompt' => 'select_account'])->andReturnSelf();
    $provider->shouldReceive('redirect')->once()->andReturn(new RedirectResponse('https://accounts.google.com/'));
    Socialite::shouldReceive('driver')->with('google')->once()->andReturn($provider);

    $response = $this->get(route('google.redirect', ['popup' => '1', 'return' => '/checkout?step=payment']));

    $response->assertRedirect('https://accounts.google.com/');
    $response->assertSessionHas('auth.google.popup', true);
    $response->assertSessionHas('auth.google.return_to', '/checkout?step=payment');
});

test('google popup callback posts a validated internal return path', function () {
    $provider = Mockery::mock();
    $provider->shouldReceive('user')->once()->andReturn(GoogleUser::fake([
        'id' => 'google-user-1',
        'email' => 'google@example.com',
        'name' => 'Google User',
    ]));
    Socialite::shouldReceive('driver')->with('google')->once()->andReturn($provider);

    $response = $this->withSession([
        'auth.google.popup' => true,
        'auth.google.return_to' => '/shop?category=shirts',
    ])->get(route('google.callback'));

    $response->assertOk()->assertSee('mellif-auth-complete')->assertSee('shop', false);
    $this->assertAuthenticated();
});

test('google popup callback rejects an external return url', function () {
    $provider = Mockery::mock();
    $provider->shouldReceive('user')->once()->andReturn(GoogleUser::fake([
        'id' => 'google-user-2',
        'email' => 'another-google@example.com',
        'name' => 'Another Google User',
    ]));
    Socialite::shouldReceive('driver')->with('google')->once()->andReturn($provider);

    $response = $this->withSession([
        'auth.google.popup' => true,
        'auth.google.return_to' => 'https://evil.example/',
    ])->get(route('google.callback'));

    $response->assertOk()->assertDontSee('evil.example');
    $this->assertAuthenticated();
});

test('google callback handles invalid state and sends the browser back to the login modal', function () {
    $provider = Mockery::mock();
    $provider->shouldReceive('user')->once()->andThrow(new InvalidStateException);
    Socialite::shouldReceive('driver')->with('google')->once()->andReturn($provider);

    $response = $this->withSession(['auth.google.popup' => false])->get(route('google.callback'));

    $response->assertOk()->assertSee('window.location.replace')->assertSee(route('home', [
        'auth' => 'login',
        'auth_error' => 'google_state',
    ]), false);
});

test('google popup callback posts a friendly invalid state result to opener', function () {
    $provider = Mockery::mock();
    $provider->shouldReceive('user')->once()->andThrow(new InvalidStateException);
    Socialite::shouldReceive('driver')->with('google')->once()->andReturn($provider);

    $response = $this->withSession(['auth.google.popup' => true])->get(route('google.callback'));

    $response->assertOk()->assertSee('mellif-auth-google-error')->assertSee('Sesi login Google kedaluwarsa');
});
