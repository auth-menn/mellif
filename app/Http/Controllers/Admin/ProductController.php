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
        )->latest()->paginate(15)->withQueryString();

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
        $product = DB::transaction(function () use ($request): Product {
            $data = $request->validated();
            $product = Product::query()->create($this->productAttributes($data));
            $this->syncImages($product, $request);
            $this->syncVariants($product, $data['variants']);

            return $product;
        });

        return redirect()->route('admin.products.edit', $product)->with('success', 'Produk berhasil dibuat.');
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

        return redirect()->route('admin.products.edit', $product)->with('success', 'Produk berhasil diperbarui.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Product $product): RedirectResponse
    {
        DB::transaction(function () use ($product): void {
            $product->update(['is_active' => false]);
            $product->images()->each(fn ($image) => Storage::disk('public')->delete($image->path));
            $product->images()->delete();
        });

        return redirect()->route('admin.products.index')->with('success', 'Produk dinonaktifkan.');
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
            'discount_percent' => $data['discount_percent'] ?? null,
            'is_featured' => $data['is_featured'] ?? false, 'is_active' => $data['is_active'] ?? false,
        ];
    }

    private function syncImages(Product $product, SaveProductRequest $request): void
    {
        if ($request->exists('existing_images')) {
            $keepIds = $request->input('existing_images', []);
            $product->images()->whereNotIn('id', $keepIds)->get()->each(function ($image): void {
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
            if (! OrderItem::query()->where('variant_id', $variant->id)->exists()) {
                $variant->delete();
            }
        });

        foreach ($variants as $variant) {
            $product->variants()->updateOrCreate(['size' => $variant['size']], ['stock' => $variant['stock']]);
        }
    }
}
