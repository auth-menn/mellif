<x-mail::message>
# {{ $forAdmin ? 'Pembayaran pesanan diterima' : 'Pembayaran berhasil' }}

{{ $forAdmin ? 'Pembayaran QRIS untuk pesanan berikut telah terkonfirmasi.' : 'Pembayaran Anda telah kami terima. Pesanan sedang diproses.' }}

## Pesanan {{ $order->order_number }}

@if ($forAdmin)
**Pelanggan:** {{ $order->recipient_name }}  
**Email:** {{ $order->user?->email }}  
**Nomor telepon:** {{ $order->phone }}  
@endif

**Status pembayaran:** Dibayar  
**Status pesanan:** {{ $order->status === 'processing' ? 'Sedang diproses' : ($order->status === 'paid' ? 'Perlu pemeriksaan stok manual' : 'Perlu pemeriksaan manual') }}  
**Nominal dibayar:** Rp {{ number_format($order->qris_final_amount ?? $order->total, 0, ',', '.') }}

<x-mail::table>
| Produk | Ukuran | Jumlah | Harga |
|:--|:--:|--:|--:|
@foreach ($order->items as $item)
| {{ $item->product_name }} | {{ $item->size }} | {{ $item->qty }} | Rp {{ number_format($item->unit_price * $item->qty, 0, ',', '.') }} |
@endforeach
</x-mail::table>

Subtotal: **Rp {{ number_format($order->subtotal, 0, ',', '.') }}**  
Pengiriman: **Rp {{ number_format($order->shipping_cost, 0, ',', '.') }}**  
Total pesanan: **Rp {{ number_format($order->total, 0, ',', '.') }}**

@unless ($forAdmin)
<x-mail::button :url="route('checkout.show', ['order' => $order->order_number])">
Lihat pesanan
</x-mail::button>
@endunless

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
