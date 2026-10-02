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
        ShippingCourier::query()->create($request->validated());

        return redirect()->route('admin.shipping.index')->with('success', 'Ekspedisi dibuat.');
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
        $shipping->update($request->validated());

        return redirect()->route('admin.shipping.index')->with('success', 'Ekspedisi diperbarui.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ShippingCourier $shipping): RedirectResponse
    {
        $shipping->delete();

        return redirect()->route('admin.shipping.index')->with('success', 'Ekspedisi dihapus.');
    }
}
