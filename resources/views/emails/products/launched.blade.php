<x-mail::message>
<span style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent; mso-hide: all;">
    Produk baru kini tersedia di {{ config('app.name') }}.
</span>

# Produk Baru di Mellif Studio

Yth. Pelanggan,

Kami dengan senang hati menginformasikan bahwa produk baru telah tersedia. Silakan lihat detailnya melalui tautan berikut.

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin: 24px 0; border: 1px solid #e5e5e5; background-color: #fafafa;">
    @if ($productImageUrl)
    <tr>
        <td align="center" style="padding: 20px 20px 0;">
            <a href="{{ $productUrl }}" style="display: inline-block; text-decoration: none;">
                <img src="{{ $productImageUrl }}" alt="{{ $product->name }}" width="480" style="display: block; width: 100%; max-width: 480px; height: auto; border: 0; object-fit: contain;">
            </a>
        </td>
    </tr>
    @endif
    <tr>
        <td style="padding: 24px;">
            <p style="margin: 0 0 8px; color: #737373; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;">Produk terbaru</p>
            <h2 style="margin: 0; color: #171717; font-size: 22px; font-weight: 600; line-height: 1.35;">{{ $product->name }}</h2>
        </td>
    </tr>
</table>

<x-mail::button :url="$productUrl" color="primary">
Lihat Produk
</x-mail::button>

Terima kasih telah menjadi bagian dari Mellif Studio.

Hormat kami,<br>
{{ config('app.name') }}
</x-mail::message>
