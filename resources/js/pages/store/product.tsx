import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import ProductCard from '@/components/store/product-card';
import type { Product, StoreVariant } from '@/types/store';
import { money } from '@/types/store';
import { show as shopShow } from '@/routes/shop';
import { saveCartLine } from '@/lib/cart-api';
import { useTranslation } from '@/hooks/use-translation';

export default function ProductPage({ product, recommendations }: { product: Product; recommendations: Product[] }) {
    const { props } = usePage();
    const { t } = useTranslation();
    const user = (props.auth as { user?: { id: number } | null } | undefined)?.user;
    const [variant, setVariant] = useState<StoreVariant | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [notice, setNotice] = useState('');
    const add = async (buyNow: boolean): Promise<void> => {
        if (!variant) return;
        try {
            await saveCartLine(product, variant, quantity, Boolean(user));
            if (buyNow) window.location.href = '/checkout';
            else setNotice(t('cart.added'));
        } catch (error) {
            setNotice(t('cart.addFailed'));
        }
    };

    return <><Head title={`${product.name} — Mellif`} /><main className="mx-auto max-w-[1400px] px-5 pb-20 pt-28 md:px-8"><div className="grid gap-8 md:grid-cols-2 md:gap-14"><div className="grid grid-cols-2 gap-3">{(product.images.length ? product.images : ['/storage/products/placeholder.svg']).map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${product.name} ${index + 1}`} className="aspect-[.82] w-full bg-neutral-100 object-cover" />)}</div><section className="md:sticky md:top-28 md:self-start"><p className="text-xs uppercase tracking-[.2em] text-neutral-500">{product.category}</p><h1 className="mt-3 text-3xl font-medium">{product.name}</h1><p className="mt-4 text-xl">{money(product.discounted_price)}</p>{product.discount_percent !== null && <p className="mt-1 text-sm text-neutral-500 line-through">{money(product.price)} · {t('shop.discount')} {product.discount_percent}%</p>}<p className="mt-7 leading-7 text-neutral-600">{product.description}</p><div className="mt-8"><p className="mb-3 text-sm">{t('product.chooseSize')}</p><div className="flex gap-2">{product.variants.map((size) => <button key={size.id} disabled={!size.stock} onClick={() => { setVariant(size); setQuantity(1); }} className={`min-w-12 border px-3 py-2 ${variant?.id === size.id ? 'bg-black text-white' : ''} disabled:opacity-30`}>{size.size}</button>)}</div></div>{variant && <label className="mt-5 flex items-center gap-3 text-sm">{t('product.quantity')} <input type="number" min={1} max={variant.stock} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(variant.stock, Number(event.target.value))))} className="w-20 border px-2 py-1" /></label>}<button disabled={!variant} onClick={() => add(false)} className="mt-8 w-full border border-black py-4 text-sm disabled:opacity-40">{t('product.addToCart')}</button><button disabled={!variant} onClick={() => add(true)} className="mt-3 w-full bg-black py-4 text-sm text-white disabled:opacity-40">{t('product.buyNow')}</button><p className="mt-3 text-xs text-neutral-500">{product.stock} {t('product.available')}</p></section></div>{recommendations.length > 0 && <section className="mt-24"><h2 className="mb-6 text-2xl font-medium">{t('product.recommendations')}</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{recommendations.map((item) => <ProductCard key={item.id} product={item} onBuy={(selected) => { window.location.href = shopShow.url({ product: selected.slug }); }} />)}</div></section>}</main>{notice && <button onClick={() => setNotice('')} className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-black px-5 py-3 text-sm text-white">{notice}</button>}<Link className="sr-only" href="/shop">{t('product.backToShop')}</Link></>;
}
