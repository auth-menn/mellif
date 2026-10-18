<x-mail::message>
# {{ $forAdmin ? 'Pesanan baru masuk' : 'Pesanan Anda diterima' }}

{{ $forAdmin ? 'Pesanan baru telah dibuat di Mellif Studio.' : 'Terima kasih telah berbelanja di Mellif Studio. Pesanan Anda sudah kami terima.' }}

## Pesanan {{ $order->order_number }}

@if ($forAdmin)
**Pelanggan:** {{ $order->recipient_name }}  
**Email:** {{ $order->user?->email }}  
**Nomor telepon:** {{ $order->phone }}  
**Alamat:** {{ $order->address }}{{ $order->address_detail ? ', '.$order->address_detail : '' }}  
@endif

**Metode pembayaran:** {{ $order->payment_method }}  
**Status pembayaran:** {{ $order->payment_method_code === 'qris' ? ($order->qris_payment_status === 'paid' ? 'Dibayar' : 'Menunggu pembayaran') : 'Bayar di tempat' }}  
**Ekspedisi:** {{ $order->shipping_courier }}

<x-mail::table>
| Produk | Ukuran | Jumlah | Harga |
|:--|:--:|--:|--:|
@foreach ($order->items as $item)
| {{ $item->product_name }} | {{ $item->size }} | {{ $item->qty }} | Rp {{ number_format($item->unit_price * $item->qty, 0, ',', '.') }} |
@endforeach
</x-mail::table>

Subtotal: **Rp {{ number_format($order->subtotal, 0, ',', '.') }}**  
Pengiriman: **Rp {{ number_format($order->shipping_cost, 0, ',', '.') }}**  
Total: **Rp {{ number_format($order->total, 0, ',', '.') }}**

@unless ($forAdmin)
@if ($order->payment_method_code === 'qris' && $order->qris_payment_status !== 'paid')
Silakan lanjutkan pembayaran QRIS melalui halaman checkout.

<x-mail::button :url="route('checkout.show', ['order' => $order->order_number])">
Lihat pesanan
</x-mail::button>
@endif
@endunless

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
