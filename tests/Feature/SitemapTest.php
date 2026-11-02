<?php

use App\Models\Category;
use App\Models\Product;

it('publishes public storefront and active product URLs as XML', function () {
    $category = Category::query()->create(['name' => 'Apparel', 'slug' => 'apparel']);
    Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Available Tee',
        'slug' => 'available-tee',
        'description' => 'A public product',
        'price' => 100000,
        'is_active' => true,
    ]);
    Product::query()->create([
        'category_id' => $category->id,
        'name' => 'Inactive Tee',
        'slug' => 'inactive-tee',
        'description' => 'A hidden product',
        'price' => 100000,
        'is_active' => false,
    ]);

    $response = $this->get(route('sitemap'));

    $response->assertOk()
        ->assertHeader('content-type', 'application/xml; charset=UTF-8');

    $xml = $response->streamedContent();
    $document = simplexml_load_string($xml);

    expect($document)->toBeInstanceOf(SimpleXMLElement::class);

    expect($xml)
        ->toContain('<?xml version="1.0" encoding="UTF-8"?>')
        ->toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
        ->toContain(route('home'))
        ->toContain(route('about'))
        ->toContain(route('shop.index'))
        ->toContain(route('shop.show', ['product' => 'available-tee']))
        ->not->toContain(route('shop.show', ['product' => 'inactive-tee']));
});

it('advertises the production sitemap in the public robots file', function () {
    $robotsFile = file_get_contents(public_path('robots.txt'));

    expect($robotsFile)
        ->toContain('User-agent: *')
        ->toContain('Disallow:')
        ->toContain('Sitemap: https://mellifstudio.com/sitemap.xml');
});
