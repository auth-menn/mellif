<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ShippingDestinationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<mixed>|string> */
    public function rules(): array
    {
        return ['q' => ['required', 'string', 'min:4', 'max:100']];
    }
}
