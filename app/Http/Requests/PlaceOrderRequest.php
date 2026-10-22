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
        $isDirectCod = $this->input('delivery_method') === 'direct_cod';

        return [
            'recipient_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'address' => ['required', 'string', 'max:1000'],
            'address_detail' => ['nullable', 'string', 'max:1000'],
            'delivery_method' => ['required', Rule::in(['courier', 'direct_cod'])],
            'destination_id' => [$isDirectCod ? 'nullable' : 'required', 'integer', 'min:1'],
            'destination_label' => [$isDirectCod ? 'nullable' : 'required', 'string', 'max:255'],
            'courier_code' => $isDirectCod
                ? ['nullable', 'string', 'max:40']
                : ['required', 'string', 'max:40', Rule::in(config('shipping.courier_codes', [])), Rule::exists('shipping_couriers', 'code')->where('is_active', true)],
            'courier_service' => $isDirectCod
                ? ['nullable', 'string', 'max:50']
                : ['required', 'string', 'max:50', 'regex:/^[A-Za-z0-9 <>\-\/]+$/'],
            'expected_shipping_cost' => [$isDirectCod ? 'nullable' : 'required', 'integer', 'min:0'],
            'payment_method_id' => ['required', Rule::exists('payment_methods', 'id')->where('code', 'qris')->where('is_active', true)],
            'turnstile_token' => $this->turnstileEnabled()
                ? ['required', 'string', 'max:2048']
                : ['nullable', 'string', 'max:2048'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.variant_id' => ['required', 'integer', 'min:1'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $label = $this->input('destination_label');
        $this->merge([
            'delivery_method' => $this->input('delivery_method', 'courier'),
            'destination_label' => is_string($label) ? mb_substr(trim(strip_tags($label)), 0, 255) : '',
        ]);
    }

    private function turnstileEnabled(): bool
    {
        return filled(config('services.turnstile.site_key'))
            && filled(config('services.turnstile.secret_key'));
    }
}
