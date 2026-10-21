<?php

namespace App\Http\Requests\Admin;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SaveProductRequest extends FormRequest
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
        $product = $this->route('product');

        return [
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:10000'],
            'price' => ['required', 'integer', 'min:0'],
            'weight' => ['required', 'integer', 'min:1', 'max:50000'],
            'discount_percent' => ['nullable', 'integer', 'between:1,99'],
            'is_featured' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.size' => ['required', 'string', 'max:20', 'distinct'],
            'variants.*.stock' => ['required', 'integer', 'min:0'],
            'images' => ['nullable', 'array', 'max:8'],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp'],
            'image_orders' => ['nullable', 'array'],
            'image_orders.*' => ['integer', 'min:0', 'max:100'],
            'existing_image_orders' => ['nullable', 'array'],
            'existing_image_orders.*' => ['integer', 'min:0', 'max:100'],
            'sync_existing_images' => ['sometimes', 'boolean'],
            'existing_images' => ['sometimes', 'array'],
            'existing_images.*' => ['integer', Rule::exists('product_images', 'id')],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('discount_percent') === '') {
            $this->merge(['discount_percent' => null]);
        }

        $variants = $this->input('variants');

        if (is_array($variants)) {
            foreach ($variants as $index => $variant) {
                if (is_array($variant) && array_key_exists('stock', $variant) && ($variant['stock'] === '' || $variant['stock'] === null)) {
                    $variants[$index]['stock'] = 0;
                }
            }

            $this->merge(['variants' => $variants]);
        }
    }

    protected function passedValidation(): void
    {
        $product = $this->route('product');
        if ($product instanceof Product && $this->has('existing_images')) {
            $ownedImages = $product->images()->whereIn('id', $this->input('existing_images', []))->count();
            if ($ownedImages !== count($this->input('existing_images', []))) {
                throw ValidationException::withMessages(['existing_images' => 'Gambar yang dipilih tidak sesuai dengan produk.']);
            }
        }
    }
}
