<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PlaceOrderRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'recipient_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'address' => ['required', 'string', 'max:1000'],
            'address_detail' => ['nullable', 'string', 'max:1000'],
            'destination_id' => ['required', 'integer', 'min:1'],
            'destination_label' => ['required', 'string', 'max:255'],
            'courier_code' => ['required', 'string', 'max:40'],
            'courier_service' => ['required', 'string', 'max:100'],
            'payment_method_id' => ['required', 'exists:payment_methods,id'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.variant_id' => ['required', 'integer', 'min:1'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
        ];
    }
}
