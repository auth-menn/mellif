<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SaveHomeSettingsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->is_admin ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<mixed>>
     */
    public function rules(): array
    {
        return [
            'hero_videos' => ['nullable', 'array'],
            'hero_videos.*' => ['file', 'mimes:mp4,webm'],
            'remove_hero_video_indexes' => ['nullable', 'array'],
            'remove_hero_video_indexes.*' => ['integer', 'min:0'],
            'page2_images' => ['nullable', 'array'],
            'page2_images.*' => ['image', 'mimes:jpg,jpeg,png,webp'],
            'page2_product_ids' => ['nullable', 'array'],
            'page2_product_ids.*' => ['nullable', 'integer'],
            'page2_upload_product_ids' => ['nullable', 'array'],
            'page2_upload_product_ids.*' => ['nullable', 'integer', 'exists:products,id'],
            'page2_image_order' => ['nullable', 'array'],
            'page2_image_order.*' => ['string', 'regex:/^(existing|upload)-\d+$/', 'max:32'],
            'remove_page2_image_indexes' => ['nullable', 'array'],
            'remove_page2_image_indexes.*' => ['integer', 'min:0'],
            'hero_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp'],
        ];
    }
}
