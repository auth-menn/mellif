<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveProductRequest;
use App\Models\Category;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): Response
    {
        $products = Product::query()->with(['category', 'images', 'variants'])->when(
            $request->filled('search'),
            fn ($query) => $query->where('name', 'like', '%'.$request->string('search')->toString().'%'),
        )->latest()->paginate(15)->withQueryString()->through(fn (Product $product): array => [
            'id' => $product->id,
            'name' => $product->name,
            'category' => $product->category ? ['name' => $product->category->name] : null,
            'images' => $product->images->map(fn ($image): array => [
                'id' => $image->id,
                'path' => $image->path,
                'sort_order' => $image->sort_order,
            ])->all(),
            'discounted_price' => $product->discounted_price,
            'discount_percent' => $product->discount_percent,
            'is_active' => $product->is_active,
            'is_featured' => $product->is_featured,
            'stock' => $product->variants->sum('stock'),
        ]);

        return Inertia::render('admin/products/index', [
            'products' => $products,
            'filters' => $request->only('search'),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(): Response
    {
        return Inertia::render('admin/products/form', ['product' => null, 'categories' => Category::query()->orderBy('name')->get(['id', 'name'])]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(SaveProductRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request): void {
            $data = $request->validated();
            $product = Product::query()->create($this->productAttributes($data));
            $this->syncImages($product, $request);
            $this->syncVariants($product, $data['variants']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.productCreated']);

        return redirect()->route('admin.products.index');
    }

    /**
     * Display the specified resource.
     */
    public function show(Product $product): Response
    {
        return Inertia::render('admin/products/form', [
            'product' => $product->load(['images', 'variants', 'category']),
            'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Product $product): Response
    {
        return $this->show($product);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(SaveProductRequest $request, Product $product): RedirectResponse
    {
        DB::transaction(function () use ($request, $product): void {
            $data = $request->validated();
            $product->update($this->productAttributes($data, $product));
            $this->syncImages($product, $request);
            $this->syncVariants($product, $data['variants']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.productUpdated']);

        return redirect()->route('admin.products.index');
    }

    public function updateStatus(Request $request, Product $product): RedirectResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $product->update(['is_active' => $data['is_active']]);

        return Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.productStatusUpdated'])->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Product $product): RedirectResponse
    {
        $imagePaths = $product->images()->pluck('path');
        $product->delete();
        Storage::disk('public')->delete($imagePaths->all());

        return Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.productDeleted'])->back();
    }

    /** @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function productAttributes(array $data, ?Product $product = null): array
    {
        $slug = Str::slug($data['name']);
        if (Product::query()->where('slug', $slug)->when($product, fn ($query) => $query->where('id', '!=', $product->id))->exists()) {
            $slug .= '-'.Str::lower(Str::random(5));
        }

        return [
            'category_id' => $data['category_id'], 'name' => $data['name'], 'slug' => $slug,
            'description' => $data['description'], 'price' => $data['price'],
            'weight' => $data['weight'],
            'discount_percent' => $data['discount_percent'] ?? null,
            'is_featured' => $data['is_featured'] ?? false, 'is_active' => $data['is_active'] ?? false,
        ];
    }

    private function syncImages(Product $product, SaveProductRequest $request): void
    {
        if ($request->boolean('sync_existing_images')) {
            $keepIds = $request->input('existing_images', []);
            if (! is_array($keepIds)) {
                $keepIds = [];
            }

            $imagesToDelete = $product->images();

            if ($keepIds !== []) {
                $imagesToDelete->whereNotIn('id', $keepIds);
            }

            $imagesToDelete->get()->each(function ($image): void {
                Storage::disk('public')->delete($image->path);
                $image->delete();
            });

            foreach ($request->input('existing_image_orders', []) as $id => $position) {
                $product->images()->whereKey($id)->update(['sort_order' => $position]);
            }
        }

        foreach ($request->file('images', []) as $index => $file) {
            $product->images()->create([
                'path' => $file->store('products', 'public'),
                'sort_order' => $request->integer("image_orders.$index", 100 + $index),
            ]);
        }
    }

    /** @param array<int, array{size: string, stock: int}> $variants */
    private function syncVariants(Product $product, array $variants): void
    {
        $sizes = collect($variants)->pluck('size');
        $product->variants()->whereNotIn('size', $sizes)->get()->each(function (ProductVariant $variant): void {
            if (OrderItem::query()->where('variant_id', $variant->id)->exists()) {
                $variant->update(['stock' => 0]);

                return;
            }

            $variant->delete();
        });

        foreach ($variants as $variant) {
            $product->variants()->updateOrCreate(['size' => $variant['size']], ['stock' => $variant['stock']]);
        }
    }
}
