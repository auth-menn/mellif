<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SitemapController
{
    public function __invoke(): StreamedResponse
    {
        $staticUrls = [
            route('home'),
            route('about'),
            route('shop.index'),
        ];

        return response()->stream(function () use ($staticUrls): void {
            echo '<?xml version="1.0" encoding="UTF-8"?>';
            echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

            foreach ($staticUrls as $url) {
                echo '<url><loc>'.htmlspecialchars($url, ENT_XML1 | ENT_QUOTES, 'UTF-8').'</loc></url>';
            }

            Product::query()
                ->where('is_active', true)
                ->select(['id', 'slug', 'updated_at'])
                ->lazyById(500)
                ->each(function (Product $product): void {
                    $url = route('shop.show', ['product' => $product->slug]);
                    $lastModified = $product->updated_at?->toAtomString();

                    echo '<url><loc>'.htmlspecialchars($url, ENT_XML1 | ENT_QUOTES, 'UTF-8').'</loc>';

                    if ($lastModified !== null) {
                        echo '<lastmod>'.$lastModified.'</lastmod>';
                    }

                    echo '</url>';
                });

            echo '</urlset>';
        }, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=600, s-maxage=600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
