<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveShippingCourierRequest;
use App\Models\ShippingCourier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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
        $data = $request->validated();
        $data['code'] = $this->uniqueCode($data['name']);
        $data['flat_cost'] = 0;

        ShippingCourier::query()->create($data);

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
        $data['code'] = $this->uniqueCode($data['name'], $shipping);
        $shipping->update($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.courierUpdated']);

        return redirect()->route('admin.shipping.index');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ShippingCourier $shipping): RedirectResponse
    {
        $shipping->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'admin.courierDeleted']);

        return redirect()->route('admin.shipping.index');
    }

    private function uniqueCode(string $name, ?ShippingCourier $shipping = null): string
    {
        $baseCode = Str::slug($name) ?: 'courier';
        $code = mb_substr($baseCode, 0, 40);
        $suffix = 2;

        while (ShippingCourier::query()->where('code', $code)->when(
            $shipping,
            fn ($query) => $query->where('id', '!=', $shipping->id),
        )->exists()) {
            $ending = '-'.$suffix;
            $code = mb_substr($baseCode, 0, 40 - mb_strlen($ending)).$ending;
            $suffix++;
        }

        return $code;
    }
}
