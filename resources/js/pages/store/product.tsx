import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import ProductCard from '@/components/store/product-card';
import CartAddDialog from '@/components/store/cart-add-dialog';
import type { Product, StoreVariant } from '@/types/store';
import { money } from '@/types/store';
import { show as shopShow } from '@/routes/shop';
import { index as shopIndex } from '@/routes/shop';
import { show as checkoutShow } from '@/routes/checkout';
import { loadServerCart, readGuestCart, saveCartLine } from '@/lib/cart-api';
import { useTranslation } from '@/hooks/use-translation';

export default function ProductPage({ product, recommendations }: { product: Product; recommendations: Product[] }) {
    const { props } = usePage();
    const { t } = useTranslation();
    const user = (props.auth as { user?: { id: number } | null } | undefined)?.user;
    const [variant, setVariant] = useState<StoreVariant | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [activeImage, setActiveImage] = useState(0);
    const [notice, setNotice] = useState('');
    const [cartAddOpen, setCartAddOpen] = useState(false);
    const [buyNowConfirmOpen, setBuyNowConfirmOpen] = useState(false);
    const [cartAddProcessing, setCartAddProcessing] = useState(false);
    const [buyNowProcessing, setBuyNowProcessing] = useState(false);
    const [remainingStock, setRemainingStock] = useState(0);
    const images = product.images.length ? product.images : ['/storage/products/placeholder.svg'];
    const showPreviousImage = (): void => {
        setActiveImage((current) => (current - 1 + images.length) % images.length);
    };
    const showNextImage = (): void => {
        setActiveImage((current) => (current + 1) % images.length);
    };

    const requestAdd = (): void => {
        if (!variant || remainingStock === 0 || quantity > remainingStock) return;

        setCartAddOpen(true);
    };

    const chooseSize = async (selectedVariant: StoreVariant): Promise<void> => {
        try {
            const cartLines = user ? await loadServerCart() : readGuestCart();
            const quantityInCart = cartLines.find((line) => line.variant.id === selectedVariant.id)?.quantity ?? 0;
            const availableStock = Math.max(0, selectedVariant.stock - quantityInCart);

            setVariant(selectedVariant);
            setRemainingStock(availableStock);
            setQuantity(1);
        } catch {
            setNotice(t('cart.loadFailed'));
        }
    };

    const confirmAdd = async (): Promise<void> => {
        if (!variant || quantity > remainingStock) return;

        setCartAddProcessing(true);
        try {
            await saveCartLine(product, variant, quantity, Boolean(user));
            setCartAddOpen(false);
            setNotice(t('cart.added'));
        } catch {
            setCartAddOpen(false);
            setNotice(t('cart.addFailed'));
        } finally {
            setCartAddProcessing(false);
        }
    };

    const requestBuyNow = (): void => {
        if (!variant || remainingStock === 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > remainingStock) return;

        setBuyNowConfirmOpen(true);
    };

    const confirmBuyNow = async (): Promise<void> => {
        if (!variant || !Number.isInteger(quantity) || quantity < 1 || quantity > remainingStock) return;

        setBuyNowProcessing(true);
        try {
            await saveCartLine(product, variant, quantity, Boolean(user));
            setBuyNowConfirmOpen(false);
            router.visit(checkoutShow.url(), {
                onFinish: () => setBuyNowProcessing(false),
            });
        } catch {
            setNotice(t('cart.addFailed'));
            setBuyNowProcessing(false);
        }
    };

    return <>
        <Head title={`${product.name} | Mellif Studio`} />
        <main className="mx-auto max-w-[1400px] px-5 pb-20 pt-28 md:px-8">
            <Link href={shopIndex.url()} className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-600 transition-colors hover:text-black">
                <ArrowLeft size={17} strokeWidth={1.8} />
                {t('product.backToShop')}
            </Link>
            <div className="grid min-w-0 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14">
                <div className="w-full min-w-0">
                    <div className="relative aspect-[.95] w-full min-w-0 overflow-hidden bg-neutral-100">
                        <div
                            className="absolute inset-y-0 left-0 flex h-full transition-transform duration-500 ease-in-out motion-reduce:transition-none"
                            style={{
                                width: `${images.length * 100}%`,
                                transform: `translateX(-${(activeImage * 100) / images.length}%)`,
                            }}
                        >
                            {images.map((image, index) => (
                                <div
                                    key={`${image}-${index}`}
                                    aria-hidden={index !== activeImage}
                                    className="h-full shrink-0"
                                    style={{ width: `${100 / images.length}%` }}
                                >
                                    <img
                                        src={image}
                                        alt={product.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            ))}
                        </div>
                        {images.length > 1 && <>
                            <button
                                type="button"
                                onClick={showPreviousImage}
                                aria-label={`${product.name} gambar sebelumnya`}
                                className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow transition-colors hover:bg-white"
                            >
                                <ChevronLeft size={22} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                onClick={showNextImage}
                                aria-label={`${product.name} gambar berikutnya`}
                                className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow transition-colors hover:bg-white"
                            >
                                <ChevronRight size={22} aria-hidden="true" />
                            </button>
                        </>}
                    </div>
                    {images.length > 1 && <div className="mt-3 flex w-full min-w-0 gap-2 overflow-x-auto">
                        {images.map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-label={`${product.name} ${index + 1}`} aria-pressed={activeImage === index} className={`h-20 w-20 shrink-0 overflow-hidden border ${activeImage === index ? 'border-black' : 'border-transparent'}`}>
                            <img src={image} alt="" className="h-full w-full object-cover" />
                        </button>)}
                    </div>}
                </div>
                <section className="md:sticky md:top-28 md:self-start">
                    <p className="text-xs uppercase tracking-[.2em] text-neutral-500">{product.category}</p>
                    <h1 className="mt-3 text-2xl font-semibold">{product.name}</h1>
                    <div className="mt-3 flex items-center gap-3">
                        {product.discount_percent !== null && <span className="text-sm text-neutral-500 line-through">{money(product.price)}</span>}
                        <p className="text-lg font-medium">{money(product.discounted_price)}</p>
                    </div>
                    {product.discount_percent !== null && <p className="mt-1 text-xs text-red-600">{t('shop.discount')} {product.discount_percent}%</p>}
                    <div className="mt-7">
                        <p className="mb-3 text-sm font-medium">{t('product.chooseSize')}</p>
                        <div className="flex flex-wrap gap-2">
                            {product.variants.map((size) => <button key={size.id} type="button" disabled={!size.stock} onClick={() => { void chooseSize(size); }} className={`min-w-12 border px-4 py-2 text-sm ${variant?.id === size.id ? 'border-black bg-black text-white' : 'border-neutral-300'} disabled:cursor-not-allowed disabled:text-neutral-300`}>{size.size}</button>)}
                        </div>
                    </div>
                    <div className="mt-6 flex h-11 w-32 items-stretch border border-neutral-300">
                        <button type="button" aria-label="Kurangi jumlah" disabled={!variant || quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="grid w-10 place-items-center text-lg disabled:cursor-not-allowed disabled:text-neutral-300">-</button>
                        <span aria-live="polite" className="grid flex-1 place-items-center border-x border-neutral-300 text-sm">{quantity}</span>
                        <button type="button" aria-label="Tambah jumlah" disabled={!variant || quantity >= remainingStock} onClick={() => setQuantity((current) => Math.min(remainingStock, current + 1))} className="grid w-10 place-items-center text-lg disabled:cursor-not-allowed disabled:text-neutral-300">+</button>
                    </div>
                    <p className="mt-3 text-xs text-neutral-600">{variant ? `${remainingStock} ${t('product.available')} (${variant.size})` : `${product.stock} ${t('product.available')}`}</p>
                    <button disabled={!variant || remainingStock === 0 || buyNowProcessing} onClick={requestAdd} className="mt-7 w-full border border-black py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40">{t('product.addToCart')}</button>
                    <button disabled={!variant || remainingStock === 0 || buyNowProcessing} onClick={requestBuyNow} className="mt-2 w-full bg-black py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">{buyNowProcessing ? 'Memproses...' : t('product.buyNow')}</button>
                    <div className="mt-6 border-t border-neutral-200 pt-5">
                        <h2 className="mb-2 text-sm font-medium">{t('admin.description')}</h2>
                        <p className="whitespace-pre-line text-sm leading-6 text-neutral-600">{product.description}</p>
                    </div>
                </section>
            </div>
            {recommendations.length > 0 && <section className="mt-24">
                <h2 className="mb-6 text-2xl font-medium">{t('product.recommendations')}</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
                    {recommendations.map((item) => <ProductCard key={item.id} product={item} onBuy={(selected) => { window.location.href = shopShow.url({ product: selected.slug }); }} />)}
                </div>
            </section>}
        </main>
        <CartAddDialog
            open={cartAddOpen}
            productName={product.name}
            productImage={images[0]}
            size={variant?.size ?? ''}
            quantity={quantity}
            title={t('cart.addConfirmTitle')}
            description={t('cart.addConfirmDescription')}
            confirmLabel={t('cart.confirmAdd')}
            cancelLabel={t('common.cancel')}
            processing={cartAddProcessing}
            onOpenChange={(open) => {
                if (!cartAddProcessing) setCartAddOpen(open);
            }}
            onConfirm={() => { void confirmAdd(); }}
        />
        <CartAddDialog
            open={buyNowConfirmOpen}
            productName={product.name}
            productImage={images[0]}
            size={variant?.size ?? ''}
            quantity={quantity}
            title={t('cart.buyNowConfirmTitle')}
            description={t('cart.buyNowConfirmDescription')}
            confirmLabel={t('cart.checkout')}
            cancelLabel={t('common.cancel')}
            processing={buyNowProcessing}
            onOpenChange={(open) => {
                if (!buyNowProcessing) setBuyNowConfirmOpen(open);
            }}
            onConfirm={() => { void confirmBuyNow(); }}
        />
        {notice && <button onClick={() => setNotice('')} className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-black px-5 py-3 text-sm text-white">{notice}</button>}
    </>;
}
