<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StoreSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StorefrontController extends Controller
{
    public function home(): Response
    {
        $image = StoreSetting::query()->where('key', 'hero_image')->value('value');
        $heroVideos = array_map(fn (string $path): string => asset('storage/'.$path), $this->settingPaths('home_page1_videos'));
        $storedImages = $this->settingImages();
        $linkedProductSlugs = Product::query()->whereIn('id', array_filter(array_column($storedImages, 'product_id')))
            ->where('is_active', true)->pluck('slug', 'id');
        $page2Images = collect($storedImages)
            ->map(fn (array $image, int $index): array => [
                'id' => $index + 1,
                'imageUrl' => asset('storage/'.$image['path']),
                'alt' => '',
                'productUrl' => $image['product_id'] ? $linkedProductSlugs->get($image['product_id']) : null,
            ])
            ->values();

        return Inertia::render('store/home', [
            'heroImageUrl' => $image ? asset('storage/'.$image) : null,
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

    /** @return list<array{path: string, product_id: int|null}> */
    private function settingImages(): array
    {
        $stored = json_decode(StoreSetting::query()->where('key', 'home_page2_images')->value('value') ?? '[]', true);

        if (! is_array($stored)) {
            return [];
        }

        return array_values(array_filter(array_map(fn (mixed $image): ?array => is_string($image)
            ? ['path' => $image, 'product_id' => null]
            : (is_array($image) && is_string($image['path'] ?? null)
                ? ['path' => $image['path'], 'product_id' => isset($image['product_id']) ? (int) $image['product_id'] : null]
                : null), $stored)));
    }

    public function about(): Response
    {
        return Inertia::render('store/about');
    }

    public function shop(Request $request): Response|RedirectResponse
    {
        $popularCategory = $request->string('popular_category')->trim()->toString();

        if ($popularCategory !== '') {
            $category = Category::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($popularCategory)])
                ->first();

            if ($category) {
                return to_route('shop.index', array_filter([
                    'categories' => $category->id,
                    'q' => $request->string('q')->trim()->toString(),
                ], fn (string|int $value): bool => (string) $value !== ''));
            }

            return to_route('shop.index', ['q' => $request->string('q')->trim()->toString() ?: $popularCategory]);
        }

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
        if ($request->filled('size')) {
            $selectedSizes = array_values(array_filter(
                explode(',', $request->string('size')->toString()),
                fn (string $size): bool => $size !== '',
            ));

            if ($selectedSizes !== []) {
                $query->whereHas('variants', fn ($variants) => $variants->whereIn('size', $selectedSizes));
            }
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
            'products' => $query->paginate(9)->withQueryString()->through(fn (Product $product) => $this->productData($product)),
            'priceRange' => [
                'min' => (int) (Product::query()->where('is_active', true)->min('price') ?? 0),
                'max' => (int) (Product::query()->where('is_active', true)->max('price') ?? 100000),
            ],
            'categories' => Category::query()->orderBy('sort_order')->get(['id', 'name']),
            'sizes' => ProductVariant::query()
                ->whereHas('product', fn ($products) => $products->where('is_active', true))
                ->distinct()
                ->orderBy('size')
                ->pluck('size'),
            'filters' => $request->only(['q', 'categories', 'type', 'in_stock', 'min', 'max', 'size', 'sort']),
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
