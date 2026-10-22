<x-mail::message>
# Informasi Produk Baru

Yth. Pelanggan,

Kami informasikan bahwa produk baru kini tersedia di {{ config('app.name') }}. Informasi produk dapat dilihat berikut ini.

@if ($productImageUrl)
<div style="text-align: center; margin: 24px 0;">
    <img src="{{ $productImageUrl }}" alt="{{ $product->name }}" style="max-width: 100%; max-height: 360px; object-fit: contain;">
</div>
@endif

## {{ $product->name }}

<x-mail::button :url="$productUrl">
Lihat Detail Produk
</x-mail::button>

Hormat kami,<br>
{{ config('app.name') }}
</x-mail::message>
