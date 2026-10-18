<?php

use App\Models\Category;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingCourier;
use App\Models\User;
use App\Services\ShippingRateException;
use App\Services\ShippingRateService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

function makeShippingHardeningProduct(string $slug, ?int $weight = null): Product
{
    $category = Category::query()->create(['name' => $slug, 'slug' => $slug]);

    return Product::query()->create([
        'category_id' => $category->id,
        'name' => $slug,
        'slug' => $slug,
        'description' => 'Test product',
        'price' => 100000,
        'weight' => $weight,
        'is_active' => true,
    ]);
}

it('filters cargo services and normalizes empty delivery estimates', function () {
    Cache::flush();
    config(['services.rajaongkir.key' => 'test-key', 'services.rajaongkir.origin_id' => 1391]);
    Http::preventStrayRequests();
    Http::fake(['*calculate/domestic-cost' => Http::response(['meta' => ['status' => 'success'], 'data' => [
        ['code' => 'jne', 'name' => 'JNE', 'service' => 'REG', 'description' => 'Regular', 'cost' => 18000, 'etd' => ' '],
        ['code' => 'jne', 'name' => 'JNE', 'service' => 'JTR', 'description' => 'Truck', 'cost' => 100000],
        ['code' => 'sicepat', 'name' => 'SiCepat', 'service' => 'GOKIL', 'description' => 'Cargo Per Kg', 'cost' => 80000],
        ['code' => 'jnt', 'name' => 'J&T', 'service' => 'EZ', 'description' => 'Trucking service', 'cost' => 20000],
    ]])]);

    $rates = app(ShippingRateService::class)->rates(123, 500, ['jne', 'sicepat', 'jnt']);

    expect($rates)->toHaveCount(1)
        ->and($rates[0]['service'])->toBe('REG')
        ->and($rates[0]['etd'])->toBeNull();
    expect(app(ShippingRateService::class)->rates(123, 500, ['jne', 'sicepat', 'jnt']))->toBe($rates);
    Http::assertSentCount(1);
});

it('uses cached destination labels from the server search result', function () {
    Cache::flush();
    config(['services.rajaongkir.key' => 'test-key']);
    Http::preventStrayRequests();
    Http::fake(['*destination/domestic-destination*' => Http::response(['meta' => ['status' => 'success'], 'data' => [
        ['id' => 123, 'label' => '<b>Kebomas, Gresik</b>'],
    ]])]);
    $service = app(ShippingRateService::class);

    $service->searchDestinations('  Kebomas   Gresik ');

    expect($service->destinationLabel(123))->toBe('Kebomas, Gresik');
    Http::assertSentCount(1);
});

it('does not cache failed upstream responses', function () {
    Cache::flush();
    config(['services.rajaongkir.key' => 'test-key', 'services.rajaongkir.origin_id' => 1391]);
    Http::preventStrayRequests();
    Http::fake(['*calculate/domestic-cost' => Http::sequence()
        ->push(['meta' => ['status' => 'error', 'message' => 'temporary outage']], 503)
        ->push(['meta' => ['status' => 'success'], 'data' => [
            ['code' => 'jne', 'name' => 'JNE', 'service' => 'REG', 'description' => 'Regular', 'cost' => 18000],
        ]], 200)]);
    $service = app(ShippingRateService::class);

    expect(fn () => $service->rates(123, 500, ['jne']))->toThrow(ShippingRateException::class);
    expect($service->rates(123, 500, ['jne']))->toHaveCount(1);
    Http::assertSentCount(2);
});

it('does not request the API when there are no supported courier codes', function () {
    Http::preventStrayRequests();
    Http::fake();

    expect(app(ShippingRateService::class)->rates(123, 500, ['unknown-code']))->toBe([]);
    Http::assertNothingSent();
});

it('counts outbound requests against the configured daily quota', function () {
    Cache::flush();
    config(['services.rajaongkir.key' => 'test-key', 'services.rajaongkir.daily_limit' => 1]);
    Http::preventStrayRequests();
    Http::fake(['*destination/domestic-destination*' => Http::response(['meta' => ['status' => 'success'], 'data' => []])]);
    $service = app(ShippingRateService::class);

    $service->searchDestinations('Gresik Kota');
    expect(fn () => $service->searchDestinations('Kebomas Gresik'))->toThrow(ShippingRateException::class);
    Http::assertSentCount(1);
});

it('does not call RajaOngkir with an invalid origin ID', function () {
    Cache::flush();
    config(['services.rajaongkir.key' => 'test-key', 'services.rajaongkir.origin_id' => 'replace-me']);
    Http::preventStrayRequests();
    Http::fake();

    expect(fn () => app(ShippingRateService::class)->rates(123, 500, ['jne']))->toThrow(ShippingRateException::class);
    Http::assertNothingSent();
});

it('returns a generic message when the destination API fails', function () {
    Cache::flush();
    config(['services.rajaongkir.key' => 'test-key']);
    Http::preventStrayRequests();
    Http::fake(['*destination/domestic-destination*' => Http::response([
        'meta' => ['status' => 'error', 'message' => 'internal diagnostic text'],
    ], 500)]);

    $this->getJson(route('shipping.destinations', ['q' => 'Gresik Kota']))
        ->assertStatus(502)
        ->assertJsonPath('message', 'Layanan ongkir sedang sibuk. Coba lagi sebentar.')
        ->assertDontSee('internal diagnostic text');
});

it('calculates weight across variants and uses the default for a missing weight', function () {
    $weightedProduct = makeShippingHardeningProduct('weighted-item', 300);
    $defaultProduct = makeShippingHardeningProduct('default-weight-item', 0);
    $weightedVariant = ProductVariant::query()->create(['product_id' => $weightedProduct->id, 'size' => 'M', 'stock' => 5]);
    $defaultVariant = ProductVariant::query()->create(['product_id' => $defaultProduct->id, 'size' => 'L', 'stock' => 5]);
    $variants = ProductVariant::query()->with('product')->whereKey([$weightedVariant->id, $defaultVariant->id])->get()->keyBy('id');

    expect(app(ShippingRateService::class)->weightFor($variants, [$weightedVariant->id => 2, $defaultVariant->id => 3]))->toBe(2100);
});

it('rejects an expected shipping cost that differs from the server quote', function () {
    Cache::flush();
    config(['services.rajaongkir.key' => 'test-key', 'services.rajaongkir.origin_id' => 1391]);
    Http::preventStrayRequests();
    Http::fake(['*calculate/domestic-cost' => Http::response(['meta' => ['status' => 'success'], 'data' => [
        ['code' => 'jne', 'name' => 'JNE', 'service' => 'REG', 'description' => 'Regular', 'cost' => 18000, 'etd' => '2-3'],
    ]])]);
    $user = User::factory()->create();
    $product = makeShippingHardeningProduct('quote-shirt', 500);
    $variant = ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => 3]);
    ShippingCourier::query()->create(['name' => 'JNE', 'code' => 'jne', 'flat_cost' => 0, 'is_active' => true]);
    $payment = PaymentMethod::query()->create(['name' => 'Transfer', 'code' => 'transfer', 'is_active' => true]);

    $this->actingAs($user)->post(route('checkout.store'), [
        'recipient_name' => 'Buyer', 'phone' => '08123456789', 'address' => 'Gresik',
        'destination_id' => 123, 'destination_label' => '<b>Gresik</b>', 'courier_code' => 'jne',
        'courier_service' => 'REG', 'expected_shipping_cost' => 17000,
        'payment_method_id' => $payment->id, 'items' => [['variant_id' => $variant->id, 'qty' => 1]],
    ])->assertSessionHasErrors(['courier_service' => 'Ongkir berubah, silakan periksa total.']);

    $this->assertDatabaseCount('orders', 0);
    expect($variant->fresh()->stock)->toBe(3);
    Http::assertSentCount(1);
});

it('requires authentication for admin routes and forbids non-admin users', function () {
    $this->get(route('admin.shipping.index'))->assertRedirect(route('home', ['auth' => 'login'], absolute: false));
    $this->actingAs(User::factory()->create())->get(route('admin.shipping.index'))->assertForbidden();
});

it('does not call the shipping API when there are no active couriers', function () {
    Cache::flush();
    Http::preventStrayRequests();
    Http::fake();
    $product = makeShippingHardeningProduct('no-courier-shirt', 500);
    $variant = ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => 2]);

    $this->postJson(route('shipping.rates'), [
        'destination_id' => 123,
        'items' => [['variant_id' => $variant->id, 'qty' => 1]],
    ])->assertUnprocessable()->assertJsonPath('message', 'Ekspedisi belum tersedia. Silakan hubungi kami.');

    Http::assertNothingSent();
});

it('returns a friendly rate limit response after fifteen rate requests', function () {
    Cache::flush();
    Http::preventStrayRequests();
    Http::fake();
    $product = makeShippingHardeningProduct('rate-limit-shirt', 500);
    $variant = ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => 2]);
    $payload = ['destination_id' => 123, 'items' => [['variant_id' => $variant->id, 'qty' => 1]]];

    for ($attempt = 0; $attempt < 15; $attempt++) {
        $this->postJson(route('shipping.rates'), $payload);
    }

    $this->postJson(route('shipping.rates'), $payload)
        ->assertTooManyRequests()
        ->assertJsonPath('message', 'Terlalu banyak permintaan ongkir. Coba lagi sebentar.');
    Http::assertNothingSent();
});

it('rejects unsupported courier codes in the admin form', function () {
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();

    $this->actingAs($admin)->post(route('admin.shipping.store'), [
        'name' => 'Unknown Courier', 'code' => 'unknown-code', 'is_active' => true,
    ])->assertSessionHasErrors('code');

    $this->assertDatabaseMissing('shipping_couriers', ['code' => 'unknown-code']);
});

it('invalidates active courier codes after an admin saves a courier', function () {
    Cache::flush();
    $admin = User::factory()->create();
    $admin->forceFill(['is_admin' => true])->save();
    expect(ShippingCourier::activeCodes())->toBe([]);

    $this->actingAs($admin)->post(route('admin.shipping.store'), [
        'name' => 'JNE', 'code' => 'jne', 'is_active' => true,
    ])->assertRedirect(route('admin.shipping.index'));

    expect(ShippingCourier::activeCodes())->toBe(['jne']);
});

it('normalizes legacy courier codes and keeps duplicate records inactive', function () {
    $migration = require base_path('database/migrations/2026_10_14_030712_normalize_shipping_courier_codes_and_add_active_code_index.php');
    $migration->down();

    ShippingCourier::query()->create(['name' => 'JNE Legacy', 'code' => 'jne-reg', 'flat_cost' => 0, 'is_active' => true]);
    ShippingCourier::query()->create(['name' => 'JNE Current', 'code' => 'jne', 'flat_cost' => 0, 'is_active' => true]);
    ShippingCourier::query()->create(['name' => 'SiCepat Legacy', 'code' => ' SICEPAT-REG ', 'flat_cost' => 0, 'is_active' => true]);

    $migration->up();

    expect(ShippingCourier::query()->count())->toBe(3)
        ->and(ShippingCourier::query()->where('code', 'jne')->where('is_active', true)->exists())->toBeTrue()
        ->and(ShippingCourier::query()->where('code', 'sicepat')->where('is_active', true)->exists())->toBeTrue()
        ->and(ShippingCourier::query()->where('code', 'like', 'legacy-%')->where('is_active', false)->exists())->toBeTrue();
});
