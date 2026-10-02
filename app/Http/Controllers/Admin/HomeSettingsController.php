<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveHomeSettingsRequest;
use App\Models\StoreSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class HomeSettingsController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('admin/home-settings/edit', [
            'tagline' => StoreSetting::query()->where('key', 'tagline')->value('value') ?? 'Made to move with your own rhythm.',
            'heroImage' => StoreSetting::query()->where('key', 'hero_image')->value('value'),
        ]);
    }

    public function update(SaveHomeSettingsRequest $request): RedirectResponse
    {
        $data = $request->validated();
        StoreSetting::query()->updateOrCreate(['key' => 'tagline'], ['value' => $data['tagline']]);

        if ($request->hasFile('hero_image')) {
            $oldPath = StoreSetting::query()->where('key', 'hero_image')->value('value');
            $path = $request->file('hero_image')->store('storefront', 'public');
            StoreSetting::query()->updateOrCreate(['key' => 'hero_image'], ['value' => $path]);
            if ($oldPath) {
                Storage::disk('public')->delete($oldPath);
            }
        }

        return back()->with('success', 'Pengaturan beranda disimpan.');
    }
}
