<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'courier_code' => ['required', 'string', 'max:40', Rule::in(config('shipping.courier_codes', [])), Rule::exists('shipping_couriers', 'code')->where('is_active', true)],
            'courier_service' => ['required', 'string', 'max:50', 'regex:/^[A-Za-z0-9 <>\-\/]+$/'],
            'expected_shipping_cost' => ['required', 'integer', 'min:0'],
            'payment_method_id' => ['required', Rule::exists('payment_methods', 'id')->where('is_active', true)],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.variant_id' => ['required', 'integer', 'min:1'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $label = $this->input('destination_label');
        $this->merge(['destination_label' => is_string($label) ? mb_substr(trim(strip_tags($label)), 0, 255) : '']);
    }
}
