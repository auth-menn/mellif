<?php

namespace App\Models;

use Database\Factories\ShippingCourierFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShippingCourier extends Model
{
    /** @use HasFactory<ShippingCourierFactory> */
    use HasFactory;

    protected $fillable = ['name', 'code', 'flat_cost', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
