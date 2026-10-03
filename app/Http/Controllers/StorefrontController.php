<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\StoreSetting;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StorefrontController extends Controller
{
    public function home(): Response
    {
        $image = StoreSetting::query()->where('key', 'hero_image')->value('value');
        $heroVideos = $this->settingPaths('home_page1_videos');
        $heroVideos = $heroVideos === []
            ? [asset('videos/home-campaign.mp4')]
            : array_map(fn (string $path): string => asset('storage/'.$path), $heroVideos);
        $page2Images = collect($this->settingPaths('home_page2_images'))
            ->map(fn (string $path, int $index): array => [
                'id' => $index + 1,
                'imageUrl' => asset('storage/'.$path),
                'alt' => '',
            ])
            ->values();

        if ($page2Images->isEmpty()) {
            $page2Images = Product::query()
                ->where('is_active', true)
                ->whereHas('images')
                ->with(['images:id,product_id,path,sort_order'])
                ->orderByDesc('is_featured')
                ->latest()
                ->limit(8)
                ->get(['id', 'name', 'is_featured', 'created_at'])
                ->flatMap(fn (Product $product) => $product->images->map(fn (ProductImage $productImage): array => [
                    'id' => $productImage->id,
                    'imageUrl' => asset('storage/'.$productImage->path),
                    'alt' => $product->name,
                ]))
                ->unique('imageUrl')
                ->take(8)
                ->values();
        }

        return Inertia::render('store/home', [
            'heroImage' => $image,
            'heroImageUrl' => $image ? asset('storage/'.$image) : asset('images/home/look-01.webp'),
            'heroVideos' => $heroVideos,
            'productSlides' => $page2Images,
        ]);
    }

    /** @return list<string> */
    private function settingPaths(string $key): array
    {
        $paths = json_decode(StoreSetting::query()->where('key', $key)->value('value') ?? '[]', true);

        return is_array($paths) ? array_values(array_filter($paths, 'is_string')) : [];
    }

    public function about(): Response
    {
        return Inertia::render('store/about');
    }

    public function shop(Request $request): Response
    {
        $query = Product::query()->where('is_active', true)->with(['category', 'images', 'variants']);

        if ($request->filled('q')) {
            $query->where('name', 'like', '%'.$request->string('q')->toString().'%');
        }
        if ($request->filled('categories')) {
            $query->whereIn('category_id', array_filter(explode(',', $request->string('categories')->toString()), 'is_numeric'));
        }
        if ($request->string('type')->toString() === 'featured') {
            $query->where('is_featured', true);
        } elseif ($request->string('type')->toString() === 'discount') {
            $query->whereNotNull('discount_percent');
        }
        if ($request->boolean('in_stock')) {
            $query->whereHas('variants', fn ($variants) => $variants->where('stock', '>', 0));
        }
        if ($request->filled('min')) {
            $query->where('price', '>=', max(0, $request->integer('min')));
        }
        if ($request->filled('max')) {
            $query->where('price', '<=', max(0, $request->integer('max')));
        }

        match ($request->string('sort')->toString()) {
            'newest' => $query->latest(),
            'price_low' => $query->orderBy('price'),
            'price_high' => $query->orderByDesc('price'),
            default => $query->orderByDesc('is_featured')->latest(),
        };

        return Inertia::render('store/shop', [
            'products' => $query->paginate(12)->withQueryString()->through(fn (Product $product) => $this->productData($product)),
            'categories' => Category::query()->orderBy('sort_order')->get(['id', 'name']),
            'filters' => $request->only(['q', 'categories', 'type', 'in_stock', 'min', 'max', 'sort']),
        ]);
    }

    public function product(Product $product): Response
    {
        abort_unless($product->is_active, 404);
        $product->load(['category', 'images', 'variants']);
        $recommendations = Product::query()->where('is_active', true)->where('id', '!=', $product->id)
            ->where('category_id', $product->category_id)->with(['images', 'variants'])->limit(4)->get();

        if ($recommendations->count() < 4) {
            $recommendations = $recommendations->concat(Product::query()->where('is_active', true)->where('is_featured', true)
                ->whereNotIn('id', $recommendations->pluck('id')->push($product->id))->with(['images', 'variants'])
                ->limit(4 - $recommendations->count())->get());
        }

        return Inertia::render('store/product', [
            'product' => $this->productData($product),
            'recommendations' => $recommendations->map(fn (Product $item) => $this->productData($item)),
        ]);
    }

    /** @return array<string, mixed> */
    private function productData(Product $product): array
    {
        return [
            'id' => $product->id, 'name' => $product->name, 'slug' => $product->slug,
            'description' => $product->description, 'price' => $product->price,
            'discount_percent' => $product->discount_percent, 'discounted_price' => $product->discounted_price,
            'is_featured' => $product->is_featured, 'category' => $product->category?->name,
            'images' => $product->images->map(fn ($image) => asset('storage/'.$image->path))->all(),
            'variants' => $product->variants->map(fn ($variant) => ['id' => $variant->id, 'size' => $variant->size, 'stock' => $variant->stock])->all(),
            'stock' => $product->variants->sum('stock'),
        ];
    }
}
