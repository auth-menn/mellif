<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveCategoryRequest;
use App\Models\Category;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('admin/categories/index', [
            'categories' => Category::query()->withCount('products')->orderBy('sort_order')->paginate(20)->withQueryString(),
            'editing' => $request->integer('edit') ? Category::query()->find($request->integer('edit')) : null,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(): Response
    {
        return Inertia::render('admin/categories/index', [
            'categories' => Category::query()->withCount('products')->orderBy('sort_order')->paginate(20),
            'editing' => null,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(SaveCategoryRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['slug'] = $this->uniqueSlug($data['name']);
        Category::query()->create($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.categoryCreated']);

        return redirect()->route('admin.categories.index');
    }

    /**
     * Display the specified resource.
     */
    public function show(Category $category): RedirectResponse
    {
        return redirect()->route('admin.categories.index', ['edit' => $category->id]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Category $category): RedirectResponse
    {
        return redirect()->route('admin.categories.index', ['edit' => $category->id]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(SaveCategoryRequest $request, Category $category): RedirectResponse
    {
        $data = $request->validated();
        $data['slug'] = $this->uniqueSlug($data['name'], $category);
        $category->update($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.categoryUpdated']);

        return redirect()->route('admin.categories.index');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Category $category): RedirectResponse
    {
        abort_if($category->products()->exists(), 422, 'Kategori masih digunakan produk.');
        $category->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.categoryDeleted']);

        return redirect()->route('admin.categories.index');
    }

    private function uniqueSlug(string $name, ?Category $category = null): string
    {
        $baseSlug = Str::slug($name) ?: 'category';
        $slug = $baseSlug;
        $suffix = 2;

        while (Category::query()->where('slug', $slug)->when(
            $category,
            fn ($query) => $query->where('id', '!=', $category->id),
        )->exists()) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }
}
