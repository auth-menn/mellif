<?php

use App\Mail\OrderPlaced;
use App\Models\Category;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

it('queues order notification emails for the store and the customer', function () {
    Mail::fake();
    config(['mail.order_notification_email' => 'studiomellif@gmail.com']);

    $user = User::factory()->create(['email' => 'buyer@example.com']);
    $category = Category::query()->create(['name' => 'Test category', 'slug' => 'test-category']);
    $product = Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Test shirt',
        'slug' => 'test-shirt',
        'description' => 'Test product',
        'price' => 25000,
        'is_active' => true,
    ]);
    $variant = ProductVariant::query()->create(['product_id' => $product->id, 'size' => 'M', 'stock' => 2]);
    $paymentMethod = PaymentMethod::query()->create(['name' => 'Transfer', 'code' => 'transfer', 'is_active' => true]);

    $response = $this->actingAs($user)->post(route('checkout.store'), [
        'recipient_name' => 'Test Buyer',
        'phone' => '08123456789',
        'address' => 'Gresik',
        'delivery_method' => 'direct_cod',
        'payment_method_id' => $paymentMethod->id,
        'items' => [['variant_id' => $variant->id, 'qty' => 1]],
    ]);

    $response->assertRedirect(route('checkout.show'));
    $this->assertDatabaseHas('orders', [
        'user_id' => $user->id,
        'payment_method_code' => 'transfer',
        'status' => 'pending_payment',
    ]);
    Mail::assertQueued(OrderPlaced::class, 2);
    Mail::assertQueued(OrderPlaced::class, fn (OrderPlaced $mail): bool => $mail->forAdmin
        && $mail->hasTo('studiomellif@gmail.com')
        && str_contains($mail->render(), 'Test shirt'));
    Mail::assertQueued(OrderPlaced::class, fn (OrderPlaced $mail): bool => ! $mail->forAdmin
        && $mail->hasTo('buyer@example.com'));
});
