<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveShippingCourierRequest;
use App\Models\ShippingCourier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ShippingCourierController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('admin/shipping/index', [
            'couriers' => ShippingCourier::query()->orderBy('name')->paginate(20)->withQueryString(),
            'editing' => $request->integer('edit') ? ShippingCourier::query()->find($request->integer('edit')) : null,
            'courierCodes' => config('shipping.courier_codes', []),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(): Response
    {
        return $this->index(request());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(SaveShippingCourierRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['flat_cost'] = 0;

        ShippingCourier::query()->create($data);
        ShippingCourier::clearActiveCodesCache();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.courierCreated']);

        return redirect()->route('admin.shipping.index');
    }

    /**
     * Display the specified resource.
     */
    public function show(ShippingCourier $shipping): RedirectResponse
    {
        return redirect()->route('admin.shipping.index', ['edit' => $shipping->id]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(ShippingCourier $shipping): RedirectResponse
    {
        return redirect()->route('admin.shipping.index', ['edit' => $shipping->id]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(SaveShippingCourierRequest $request, ShippingCourier $shipping): RedirectResponse
    {
        $data = $request->validated();
        $shipping->update($data);
        ShippingCourier::clearActiveCodesCache();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.courierUpdated']);

        return redirect()->route('admin.shipping.index');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ShippingCourier $shipping): RedirectResponse
    {
        $shipping->delete();
        ShippingCourier::clearActiveCodesCache();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.courierDeleted']);

        return redirect()->route('admin.shipping.index');
    }
}
