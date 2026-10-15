<?php

namespace App\Http\Controllers;

use App\Http\Requests\ShippingDestinationRequest;
use App\Http\Requests\ShippingRatesRequest;
use App\Models\ShippingCourier;
use App\Services\CheckoutItemsService;
use App\Services\ShippingRateException;
use App\Services\ShippingRateService;
use Illuminate\Http\JsonResponse;

class ShippingController extends Controller
{
    public function destinations(ShippingDestinationRequest $request, ShippingRateService $shippingRates): JsonResponse
    {
        try {
            return response()->json(['destinations' => $shippingRates->searchDestinations($request->validated('q'))]);
        } catch (ShippingRateException $exception) {
            return response()->json(['message' => 'Layanan ongkir sedang sibuk. Coba lagi sebentar.'], 502);
        }
    }

    public function rates(ShippingRatesRequest $request, ShippingRateService $shippingRates, CheckoutItemsService $checkoutItems): JsonResponse
    {
        $data = $request->validated();
        ['variants' => $variants, 'quantities' => $quantities] = $checkoutItems->resolve($data['items']);

        $courierCodes = ShippingCourier::activeCodes();
        if ($courierCodes === []) {
            return response()->json(['message' => 'Ekspedisi belum tersedia. Silakan hubungi kami.'], 422);
        }

        try {
            return response()->json([
                'rates' => $shippingRates->rates((int) $data['destination_id'], $shippingRates->weightFor($variants, $quantities), $courierCodes),
            ]);
        } catch (ShippingRateException $exception) {
            return response()->json(['message' => 'Layanan ongkir sedang sibuk. Coba lagi sebentar.'], 502);
        }
    }
}
