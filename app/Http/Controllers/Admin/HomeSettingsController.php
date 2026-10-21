<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveHomeSettingsRequest;
use App\Models\Product;
use App\Models\StoreSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Throwable;

class HomeSettingsController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('admin/home-settings/edit', [
            'heroVideos' => $this->mediaItems('home_page1_videos'),
            'page2Images' => $this->mediaItems('home_page2_images'),
            'products' => Product::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'slug']),
        ]);
    }

    public function update(SaveHomeSettingsRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $heroVideos = $this->settingPaths('home_page1_videos');
        $page2Images = $this->settingImages();
        $removedPaths = [];
        $heroVideos = $this->removeSelectedPaths($heroVideos, $data['remove_hero_video_indexes'] ?? [], $removedPaths);
        $removedIndexes = array_fill_keys(array_map('intval', $data['remove_page2_image_indexes'] ?? []), true);
        foreach ($page2Images as $index => $image) {
            if (isset($removedIndexes[$index])) {
                $removedPaths[] = $image['path'];
            }
        }
        $page2Images = array_values(array_filter($page2Images, fn (array $image, int $index): bool => ! isset($removedIndexes[$index]), ARRAY_FILTER_USE_BOTH));
        $productIds = array_values(array_filter($data['page2_product_ids'] ?? [], fn (mixed $id, int $index): bool => ! isset($removedIndexes[$index]), ARRAY_FILTER_USE_BOTH));
        $validProductIds = Product::query()
            ->whereKey(array_filter($productIds))
            ->pluck('id')
            ->mapWithKeys(fn (int $id): array => [(string) $id => true])
            ->all();
        $uploadedPaths = [];
        $oldHeroImage = StoreSetting::query()->where('key', 'hero_image')->value('value');
        $newHeroImage = null;

        try {
            $heroVideos = [...$heroVideos, ...$this->storeUploads($request->file('hero_videos', []), 'storefront/home/videos', $uploadedPaths)];
            $uploadedImages = $this->storeUploads($request->file('page2_images', []), 'storefront/home/images', $uploadedPaths);
            $page2Images = [...$page2Images, ...array_map(fn (string $path, int $index): array => [
                'path' => $path,
                'product_id' => ($data['page2_upload_product_ids'][$index] ?? null) ?: null,
            ], $uploadedImages, array_keys($uploadedImages))];
            foreach ($page2Images as $index => &$image) {
                if ($index < count($productIds)) {
                    $productId = $productIds[$index];
                    $image['product_id'] = $productId !== null && isset($validProductIds[(string) $productId])
                        ? (int) $productId
                        : null;
                }
            }
            unset($image);

            if ($request->hasFile('hero_image')) {
                $newHeroImage = $request->file('hero_image')->store('storefront', 'public');

                if (! is_string($newHeroImage)) {
                    throw new RuntimeException('Hero image upload failed.');
                }

                $uploadedPaths[] = $newHeroImage;
            }

            DB::transaction(function () use ($heroVideos, $page2Images, $newHeroImage): void {
                StoreSetting::query()->updateOrCreate(['key' => 'home_page1_videos'], ['value' => json_encode($heroVideos, JSON_THROW_ON_ERROR)]);
                StoreSetting::query()->updateOrCreate(['key' => 'home_page2_images'], ['value' => json_encode($page2Images, JSON_THROW_ON_ERROR)]);

                if ($newHeroImage !== null) {
                    StoreSetting::query()->updateOrCreate(['key' => 'hero_image'], ['value' => $newHeroImage]);
                }
            });
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($uploadedPaths);

            throw $exception;
        }

        if ($newHeroImage !== null && $oldHeroImage) {
            $removedPaths[] = $oldHeroImage;
        }

        Storage::disk('public')->delete(array_values(array_unique($removedPaths)));

        return Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.homeSettingsUpdated'])->back();
    }

    /** @return list<array{path: string, url: string, productId: int|null}> */
    private function mediaItems(string $key): array
    {
        if ($key === 'home_page2_images') {
            return array_map(fn (array $image): array => [
                'path' => $image['path'],
                'url' => asset('storage/'.$image['path']),
                'productId' => $image['product_id'],
            ], $this->settingImages());
        }

        return array_map(fn (string $path): array => [
            'path' => $path,
            'url' => asset('storage/'.$path),
            'productId' => null,
        ], $this->settingPaths($key));
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

    /** @return list<string> */
    private function settingPaths(string $key): array
    {
        $paths = json_decode(StoreSetting::query()->where('key', $key)->value('value') ?? '[]', true);

        return is_array($paths) ? array_values(array_filter($paths, 'is_string')) : [];
    }

    /** @param list<string> $paths
     * @param  list<int>  $indexes
     * @param  list<string>  $removedPaths
     * @return list<string>
     */
    private function removeSelectedPaths(array $paths, array $indexes, array &$removedPaths): array
    {
        $indexesToRemove = array_fill_keys(array_map('intval', $indexes), true);

        foreach ($paths as $index => $path) {
            if (isset($indexesToRemove[$index])) {
                $removedPaths[] = $path;
            }
        }

        return array_values(array_filter($paths, fn (string $path, int $index): bool => ! isset($indexesToRemove[$index]), ARRAY_FILTER_USE_BOTH));
    }

    /** @param list<UploadedFile> $files
     * @param  list<string>  $uploadedPaths
     * @return list<string>
     */
    private function storeUploads(array $files, string $directory, array &$uploadedPaths): array
    {
        $paths = [];

        foreach ($files as $file) {
            $path = $file->store($directory, 'public');

            if (! is_string($path)) {
                throw new RuntimeException('Home media upload failed.');
            }

            $paths[] = $path;
            $uploadedPaths[] = $path;
        }

        return $paths;
    }
}
