<?php

use App\Models\User;

test('guests can visit the storefront homepage', function () {
    $response = $this->get(route('home'));
    $response->assertOk();
});

test('authenticated users can visit the storefront homepage', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('home'));
    $response->assertOk();
});
