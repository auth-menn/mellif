<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveHomeSettingsRequest;
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
        ]);
    }

    public function update(SaveHomeSettingsRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $heroVideos = $this->settingPaths('home_page1_videos');
        $page2Images = $this->settingPaths('home_page2_images');
        $removedPaths = [];
        $heroVideos = $this->removeSelectedPaths($heroVideos, $data['remove_hero_video_indexes'] ?? [], $removedPaths);
        $page2Images = $this->removeSelectedPaths($page2Images, $data['remove_page2_image_indexes'] ?? [], $removedPaths);
        $uploadedPaths = [];
        $oldHeroImage = StoreSetting::query()->where('key', 'hero_image')->value('value');
        $newHeroImage = null;

        try {
            $heroVideos = [...$heroVideos, ...$this->storeUploads($request->file('hero_videos', []), 'storefront/home/videos', $uploadedPaths)];
            $page2Images = [...$page2Images, ...$this->storeUploads($request->file('page2_images', []), 'storefront/home/images', $uploadedPaths)];

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

        return back()->with('success', 'Pengaturan beranda disimpan.');
    }

    /** @return list<array{path: string, url: string}> */
    private function mediaItems(string $key): array
    {
        return array_map(fn (string $path): array => [
            'path' => $path,
            'url' => asset('storage/'.$path),
        ], $this->settingPaths($key));
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
