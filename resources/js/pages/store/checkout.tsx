import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { CartLine, Product, StoreVariant } from '@/types/store';
import { money } from '@/types/store';
import { store as placeOrder } from '@/routes/checkout';
import { login } from '@/routes';
import { show as checkoutShow } from '@/routes/checkout';
import { index as shopIndex } from '@/routes/shop';

type CheckoutLine = { variant_id: number; qty: number };
type Courier = { id: number; name: string; flat_cost: number };
type PaymentMethod = { id: number; name: string };

export default function Checkout({ couriers, paymentMethods, orderNumber }: { couriers: Courier[]; paymentMethods: PaymentMethod[]; orderNumber: string | null }) {
    const { props } = usePage();
    const user = (props.auth as { user?: { name: string; phone?: string | null } | null } | undefined)?.user;
    const [cart, setCart] = useState<CartLine[]>([]);
    const [courierId, setCourierId] = useState(couriers[0]?.id ?? 0);
    const [paymentId, setPaymentId] = useState(paymentMethods[0]?.id ?? 0);
    const [form, setForm] = useState({ recipient_name: user?.name ?? '', phone: user?.phone ?? '', address: '', address_detail: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        try {
            const value: unknown = JSON.parse(localStorage.getItem('mellif-cart') ?? '[]');
            setCart(Array.isArray(value) ? value as CartLine[] : []);
        } catch {
            setCart([]);
        }
    }, []);

    const subtotal = cart.reduce((sum, line) => sum + line.product.discounted_price * line.quantity, 0);
    const shipping = couriers.find((courier) => courier.id === courierId)?.flat_cost ?? 0;
    const updateCart = (next: CartLine[]): void => {
        setCart(next);
        localStorage.setItem('mellif-cart', JSON.stringify(next));
        window.dispatchEvent(new Event('mellif-cart-updated'));
    };
    const submit = (): void => {
        setErrors({});
        router.post(placeOrder.url(), {
            ...form,
            shipping_courier_id: courierId,
            payment_method_id: paymentId,
            items: cart.map((line) => ({ variant_id: line.variant.id, qty: line.quantity })),
        }, {
            onError: (responseErrors) => setErrors(responseErrors as Record<string, string>),
            onSuccess: () => {
                localStorage.removeItem('mellif-cart');
                setCart([]);
                window.dispatchEvent(new Event('mellif-cart-updated'));
            },
        });
    };

    if (orderNumber) return <><Head title="Order diterima — Mellif" /><main className="mx-auto min-h-screen max-w-3xl px-6 pb-20 pt-40 text-center"><p className="text-xs uppercase tracking-[.25em] text-neutral-500">Pesanan diterima</p><h1 className="mt-5 text-4xl font-medium">Terima kasih sudah berbelanja.</h1><p className="mt-5 text-neutral-600">Nomor order Anda</p><p className="mt-2 text-xl font-semibold">{orderNumber}</p><p className="mx-auto mt-8 max-w-xl text-sm leading-6 text-neutral-500">Pembayaran QRIS dan unggah bukti pembayaran akan tersedia pada fase berikutnya.</p><Link href={shopIndex.url()} className="mt-8 inline-block bg-black px-8 py-4 text-sm text-white">Lanjut belanja</Link></main></>;

    return <><Head title="Checkout — Mellif" /><main className="mx-auto min-h-screen max-w-6xl px-5 pb-20 pt-28"><h1 className="mb-8 text-3xl font-medium">Checkout</h1>{!user && <div className="mb-7 flex flex-col justify-between gap-3 border border-neutral-200 p-5 sm:flex-row sm:items-center"><p className="text-sm">Login untuk melanjutkan checkout dan menyimpan pesanan Anda.</p><Link href={login.url()} className="border border-black px-5 py-3 text-center text-sm">Login / Daftar</Link></div>}<div className="grid gap-10 md:grid-cols-[1.3fr_.7fr]"><section className="space-y-5"><h2 className="text-lg font-medium">Data penerima</h2>{([['recipient_name', 'Nama penerima'], ['phone', 'Nomor HP'], ['address', 'Alamat'], ['address_detail', 'Detail alamat (opsional)']] as const).map(([key, label]) => <label key={key} className="block text-sm">{label}{key.includes('address') ? <textarea value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-2 min-h-20 w-full border border-neutral-300 p-3" /> : <input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-2 w-full border border-neutral-300 px-3 py-3" />}{errors[key] && <span className="mt-1 block text-xs text-red-600">{errors[key]}</span>}</label>)}<label className="block text-sm">Ekspedisi<select value={courierId} onChange={(event) => setCourierId(Number(event.target.value))} className="mt-2 w-full border border-neutral-300 px-3 py-3">{couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name} · {money(courier.flat_cost)}</option>)}</select></label><label className="block text-sm">Metode pembayaran<select value={paymentId} onChange={(event) => setPaymentId(Number(event.target.value))} className="mt-2 w-full border border-neutral-300 px-3 py-3">{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label></section><aside className="h-fit border border-neutral-200 p-5"><h2 className="mb-5 text-lg font-medium">Ringkasan pesanan</h2>{cart.length === 0 ? <p className="py-4 text-sm text-neutral-500">Keranjang Anda kosong. <Link className="underline" href={shopIndex.url()}>Pilih produk</Link></p> : <div className="space-y-4">{cart.map((line) => <div key={line.variant.id} className="flex items-start justify-between gap-3 text-sm"><div><p>{line.product.name}</p><p className="text-xs text-neutral-500">Size {line.variant.size} · {money(line.product.discounted_price)}</p><div className="mt-1 flex items-center gap-2"><button aria-label="Kurangi jumlah" onClick={() => updateCart(cart.map((item) => item.variant.id === line.variant.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}>−</button><span>{line.quantity}</span><button aria-label="Tambah jumlah" onClick={() => updateCart(cart.map((item) => item.variant.id === line.variant.id ? { ...item, quantity: Math.min(item.variant.stock, item.quantity + 1) } : item))}>+</button><button className="ml-2 text-xs underline" onClick={() => updateCart(cart.filter((item) => item.variant.id !== line.variant.id))}>Hapus</button></div></div><span>{money(line.product.discounted_price * line.quantity)}</span></div>)}</div>}<div className="mt-6 space-y-3 border-t pt-4 text-sm"><p className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></p><p className="flex justify-between"><span>Pengiriman</span><span>{money(shipping)}</span></p><p className="flex justify-between border-t pt-3 font-semibold"><span>Total</span><span>{money(subtotal + shipping)}</span></p></div><button disabled={!cart.length} onClick={submit} className="mt-5 w-full bg-black py-4 text-sm font-medium text-white disabled:opacity-40">Order Sekarang</button>{!user && <p className="mt-3 text-center text-xs text-neutral-500">Anda akan diminta login sebelum pesanan disimpan.</p>}</aside></div></main></>;
}
