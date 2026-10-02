import { Head, Link, router } from '@inertiajs/react';
import { Filter, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ProductCard from '@/components/store/product-card';
import type { Product, StoreVariant } from '@/types/store';
import { money } from '@/types/store';
import { index as shopIndex } from '@/routes/shop';

type Category = { id: number; name: string };
type Page<T> = { data: T[]; links: { url: string | null; label: string; active: boolean }[]; total: number };
type Filters = { q?: string; categories?: string; type?: string; in_stock?: string; min?: string; max?: string; sort?: string };

export default function Shop({ products, categories, filters }: { products: Page<Product>; categories: Category[]; filters: Filters }) {
    const [query, setQuery] = useState(filters.q ?? '');
    const [selectedCategories, setSelectedCategories] = useState<string[]>(filters.categories?.split(',').filter(Boolean) ?? []);
    const [buyProduct, setBuyProduct] = useState<Product | null>(null);
    const [selectedSize, setSelectedSize] = useState<StoreVariant | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [mobileFilters, setMobileFilters] = useState(false);
    const [notice, setNotice] = useState('');

    const visit = (overrides: Record<string, string | undefined> = {}): void => {
        const params: Record<string, string | undefined> = { q: query || undefined, categories: selectedCategories.length ? selectedCategories.join(',') : undefined, ...filters, ...overrides };
        Object.keys(params).forEach((key) => params[key] === undefined || params[key] === '' ? delete params[key] : undefined);
        router.get(shopIndex.url({ query: params }), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (query !== (filters.q ?? '')) visit({ q: query || undefined });
        }, 350);
        return () => window.clearTimeout(timer);
    }, [query]);

    const totalPages = useMemo(() => products.links.filter((link) => /^\d+$/.test(link.label)).length, [products.links]);

    const addToCart = (): void => {
        if (!buyProduct || !selectedSize) return;
        try {
            const cart: { product: Product; variant: StoreVariant; quantity: number }[] = JSON.parse(localStorage.getItem('mellif-cart') ?? '[]');
            const existing = cart.find((line) => line.variant.id === selectedSize.id);
            if (existing) existing.quantity = Math.min(selectedSize.stock, existing.quantity + quantity);
            else cart.push({ product: buyProduct, variant: selectedSize, quantity });
            localStorage.setItem('mellif-cart', JSON.stringify(cart));
            window.dispatchEvent(new Event('mellif-cart-updated'));
            setNotice('Ditambahkan ke keranjang');
            setBuyProduct(null);
            setSelectedSize(null);
        } catch {
            setNotice('Keranjang tidak dapat diperbarui');
        }
    };

    const filtersPanel = <div className="space-y-7"><label className="flex items-center gap-3 rounded-xl border px-4 py-3"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari produk" className="w-full border-0 p-0 text-sm outline-none focus:ring-0" /></label><section className="space-y-4 border-b pb-6"><h2 className="font-medium">Kategori</h2>{categories.map((category) => <label key={category.id} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={selectedCategories.includes(String(category.id))} onChange={() => { const next = selectedCategories.includes(String(category.id)) ? selectedCategories.filter((id) => id !== String(category.id)) : [...selectedCategories, String(category.id)]; setSelectedCategories(next); window.setTimeout(() => visit({ categories: next.join(',') || undefined }), 0); }} className="h-5 w-5 accent-black" />{category.name}</label>)}</section><section className="space-y-4 border-b pb-6"><h2 className="font-medium">Tipe Produk</h2>{[['', 'Semua Produk'], ['featured', 'Produk Unggulan'], ['discount', 'Diskon']].map(([value, label]) => <label key={value} className="flex items-center gap-3 text-sm"><input type="radio" name="type" checked={(filters.type ?? '') === value} onChange={() => visit({ type: value })} className="h-5 w-5 accent-black" />{label}</label>)}</section><section className="space-y-4 border-b pb-6"><h2 className="font-medium">Ketersediaan</h2><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={filters.in_stock === '1'} onChange={(event) => visit({ in_stock: event.target.checked ? '1' : undefined })} className="h-5 w-5 accent-black" />Ada stok</label></section><section className="space-y-3"><h2 className="font-medium">Harga</h2><div className="flex gap-2"><input aria-label="Harga minimum" defaultValue={filters.min} placeholder="Min" type="number" id="price-min" className="w-1/2 rounded border px-2 py-2 text-sm" /><input aria-label="Harga maksimum" defaultValue={filters.max} placeholder="Maks" type="number" id="price-max" className="w-1/2 rounded border px-2 py-2 text-sm" /></div><button onClick={() => visit({ min: (document.getElementById('price-min') as HTMLInputElement).value, max: (document.getElementById('price-max') as HTMLInputElement).value })} className="text-sm underline">Terapkan</button></section></div>;

    return <><Head title="Shop — Mellif" /><main className="mx-auto min-h-screen max-w-[1600px] px-4 pb-20 pt-24 md:px-8 md:pt-28"><div className="mb-6 flex items-center justify-between"><h1 className="text-2xl font-medium md:text-3xl">Semua Produk</h1><select aria-label="Urutkan produk" value={filters.sort ?? 'popular'} onChange={(event) => visit({ sort: event.target.value })} className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm"><option value="popular">Urutan: Terpopuler</option><option value="newest">Terbaru</option><option value="price_low">Harga terendah</option><option value="price_high">Harga tertinggi</option></select></div><button onClick={() => setMobileFilters(true)} className="mb-4 flex items-center gap-2 border px-4 py-2 text-sm lg:hidden"><Filter size={16} /> Filter</button><div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><aside className="hidden rounded-xl border border-neutral-200 p-4 lg:block">{filtersPanel}</aside><section><div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">{products.data.map((product) => <ProductCard key={product.id} product={product} onBuy={(item) => { setBuyProduct(item); setSelectedSize(null); setQuantity(1); }} />)}</div>{products.data.length === 0 && <p className="py-20 text-center text-neutral-500">Produk tidak ditemukan.</p>}<div className="mt-8 flex flex-wrap justify-center gap-2">{products.links.map((link, index) => <button key={`${link.label}-${index}`} disabled={!link.url} onClick={() => link.url && router.visit(link.url, { preserveState: true, preserveScroll: true })} className={`min-w-9 border px-3 py-2 text-sm ${link.active ? 'bg-black text-white' : ''} disabled:opacity-40`} dangerouslySetInnerHTML={{ __html: link.label }} />)}</div><p className="mt-3 text-center text-xs text-neutral-500">{products.total} produk · {totalPages} halaman</p></section></div></main>{mobileFilters && <div className="fixed inset-0 z-[60] bg-black/40 lg:hidden" onClick={() => setMobileFilters(false)}><section onClick={(event) => event.stopPropagation()} className="absolute inset-y-0 left-0 w-[min(360px,90vw)] overflow-y-auto bg-white p-5"><div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-medium">Filter</h2><button aria-label="Tutup filter" onClick={() => setMobileFilters(false)}><X /></button></div>{filtersPanel}</section></div>}{buyProduct && <div role="presentation" className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" onClick={() => setBuyProduct(null)}><section role="dialog" aria-modal="true" aria-labelledby="buy-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-lg bg-white p-6"><div className="flex items-start justify-between"><div><h2 id="buy-title" className="text-lg font-medium">{buyProduct.name}</h2><p className="mt-1 text-sm">{money(buyProduct.discounted_price)}</p></div><button aria-label="Tutup" onClick={() => setBuyProduct(null)}><X size={20} /></button></div><p className="mb-3 mt-6 text-sm">Pilih ukuran</p><div className="flex flex-wrap gap-2">{buyProduct.variants.map((variant) => <button key={variant.id} disabled={variant.stock === 0} onClick={() => { setSelectedSize(variant); setQuantity(1); }} className={`min-w-12 border px-3 py-2 text-sm ${selectedSize?.id === variant.id ? 'border-black bg-black text-white' : ''} disabled:cursor-not-allowed disabled:opacity-30`}>{variant.size}</button>)}</div>{selectedSize && <label className="mt-5 block text-sm">Jumlah <input type="number" min={1} max={selectedSize.stock} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(selectedSize.stock, Number(event.target.value))))} className="ml-3 w-20 border px-2 py-1" /></label>}<button disabled={!selectedSize} onClick={addToCart} className="mt-7 w-full bg-black py-3 text-sm font-medium text-white disabled:opacity-40">Tambah ke Keranjang</button></section></div>}{notice && <button onClick={() => setNotice('')} className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 bg-black px-5 py-3 text-sm text-white">{notice}</button>}</>;
}
