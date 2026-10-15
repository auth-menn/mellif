<?php

namespace App\Models;

use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    protected $fillable = ['user_id', 'order_number', 'recipient_name', 'phone', 'address', 'address_detail', 'shipping_courier', 'shipping_courier_code', 'shipping_service', 'shipping_etd', 'destination_id', 'destination_label', 'shipping_cost', 'payment_method', 'payment_method_code', 'subtotal', 'total', 'status', 'stock_deducted', 'notes', 'qrisly_history_id', 'qris_string', 'qris_original_amount', 'qris_final_amount', 'qris_expiry_time', 'qris_payment_status'];

    protected function casts(): array
    {
        return ['qris_expiry_time' => 'datetime', 'stock_deducted' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
