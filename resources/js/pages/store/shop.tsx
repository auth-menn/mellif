import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronDown, Filter, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ProductCard from '@/components/store/product-card';
import CartAddDialog from '@/components/store/cart-add-dialog';
import ProductSelectionDialog from '@/components/store/product-selection-dialog';
import type { Product, StoreVariant } from '@/types/store';
import { money } from '@/types/store';
import { index as shopIndex } from '@/routes/shop';
import { loadServerCart, readGuestCart, saveCartLine } from '@/lib/cart-api';
import { useTranslation } from '@/hooks/use-translation';

type Category = { id: number; name: string };
type Page<T> = { data: T[]; links: { url: string | null; label: string; active: boolean }[]; total: number };
type Filters = { q?: string; categories?: string; type?: string; in_stock?: string; min?: string; max?: string; size?: string; sort?: string };
type PriceRange = { min: number; max: number };

function FilterSection({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
    return (
        <section className="border-t border-neutral-200">
            <button type="button" aria-expanded={isOpen} onClick={onToggle} className="flex w-full items-center justify-between px-4 py-4 text-left text-sm">
                <span>{title}</span>
                <ChevronDown size={18} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="space-y-4 px-4 pb-5 text-sm">{children}</div>}
        </section>
    );
}

export default function Shop({ products, categories, sizes, filters, priceRange }: { products: Page<Product>; categories: Category[]; sizes: string[]; filters: Filters; priceRange: PriceRange }) {
    const { props } = usePage();
    const { t } = useTranslation();
    const user = (props.auth as { user?: { id: number } | null } | undefined)?.user;
    const [query, setQuery] = useState(filters.q ?? '');
    const [selectedCategories, setSelectedCategories] = useState<string[]>(filters.categories?.split(',').filter(Boolean) ?? []);
    const [selectedType, setSelectedType] = useState(filters.type ?? '');
    const [inStockOnly, setInStockOnly] = useState(filters.in_stock === '1');
    const [minimumPrice, setMinimumPrice] = useState(filters.min ?? String(priceRange.min));
    const [maximumPrice, setMaximumPrice] = useState(filters.max ?? String(priceRange.max));
    const [selectedSizesFilter, setSelectedSizesFilter] = useState<string[]>(filters.size?.split(',').filter(Boolean) ?? []);
    const [openSections, setOpenSections] = useState({ categories: Boolean(filters.categories), type: false, availability: false, price: false, size: false });
    const [buyProduct, setBuyProduct] = useState<Product | null>(null);
    const [selectedSize, setSelectedSize] = useState<StoreVariant | null>(null);
    const [remainingStock, setRemainingStock] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [cartAddOpen, setCartAddOpen] = useState(false);
    const [cartAddProcessing, setCartAddProcessing] = useState(false);
    const [mobileFilters, setMobileFilters] = useState(false);
    const [notice, setNotice] = useState('');
    const hasActiveFilters = Boolean(filters.q || filters.categories || filters.type || filters.in_stock || filters.min || filters.max || filters.size);

    const visit = (overrides: Record<string, string | undefined> = {}): void => {
        const params: Record<string, string | undefined> = { ...filters, ...overrides };
        Object.keys(params).forEach((key) => params[key] === undefined || params[key] === '' ? delete params[key] : undefined);
        router.get(shopIndex.url({ query: params }), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    useEffect(() => {
        setQuery(filters.q ?? '');
        setSelectedCategories(filters.categories?.split(',').filter(Boolean) ?? []);
        setSelectedType(filters.type ?? '');
        setInStockOnly(filters.in_stock === '1');
        setMinimumPrice(filters.min ?? String(priceRange.min));
        setMaximumPrice(filters.max ?? String(priceRange.max));
        setSelectedSizesFilter(filters.size?.split(',').filter(Boolean) ?? []);
    }, [filters.q, filters.categories, filters.type, filters.in_stock, filters.min, filters.max, filters.size, priceRange.min, priceRange.max]);

    const toggleSection = (section: keyof typeof openSections): void => {
        setOpenSections((current) => ({ ...current, [section]: !current[section] }));
    };

    const applyFilters = (): void => {
        visit({
            q: query || undefined,
            categories: selectedCategories.length ? selectedCategories.join(',') : undefined,
            type: selectedType || undefined,
            in_stock: inStockOnly ? '1' : undefined,
            min: Number(minimumPrice) > priceRange.min ? minimumPrice : undefined,
            max: Number(maximumPrice) < priceRange.max ? maximumPrice : undefined,
            size: selectedSizesFilter.length > 0 ? selectedSizesFilter.join(',') : undefined,
            page: undefined,
        });
        setMobileFilters(false);
    };

    const resetFilters = (): void => {
        setQuery('');
        setSelectedCategories([]);
        setSelectedType('');
        setInStockOnly(false);
        setMinimumPrice(String(priceRange.min));
        setMaximumPrice(String(priceRange.max));
        setSelectedSizesFilter([]);
        visit({ q: undefined, categories: undefined, type: undefined, in_stock: undefined, min: undefined, max: undefined, size: undefined, page: undefined });
        setMobileFilters(false);
    };

    const totalPages = useMemo(() => products.links.filter((link) => /^\d+$/.test(link.label)).length, [products.links]);
    const catalogTitle = (filters.categories ?? '').split(',').flatMap((id) => {
        const category = categories.find((item) => String(item.id) === id);

        return category ? [category.name] : [];
    }).join(' / ') || t('shop.title');

    const addToCart = async (): Promise<void> => {
        if (!buyProduct || !selectedSize || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || quantity > remainingStock) return;
        setCartAddProcessing(true);
        try {
            await saveCartLine(buyProduct, selectedSize, quantity, Boolean(user));
            setNotice(t('cart.added'));
            setCartAddOpen(false);
            setBuyProduct(null);
            setSelectedSize(null);
        } catch {
            setCartAddOpen(false);
            setNotice(t('cart.addFailed'));
        } finally {
            setCartAddProcessing(false);
        }
    };

    const chooseBuySize = async (variant: StoreVariant): Promise<void> => {
        try {
            const cartLines = user ? await loadServerCart() : readGuestCart();
            const quantityInCart = cartLines.find((line) => line.variant.id === variant.id)?.quantity ?? 0;
            const availableStock = Math.max(0, variant.stock - quantityInCart);

            setSelectedSize(variant);
            setRemainingStock(availableStock);
            setQuantity(1);
        } catch {
            setNotice(t('cart.loadFailed'));
        }
    };

    const filtersPanel = (instance: 'desktop' | 'mobile') => (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('mellif-search-open', { detail: query }))} aria-label={t('nav.search')} className="mx-3 my-3 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-lg border border-neutral-200 px-4 py-3 text-left transition-colors hover:border-neutral-400">
                <Search size={20} className="shrink-0 text-black" />
                <span className={`w-full truncate text-sm ${query ? 'text-black' : 'text-neutral-500'}`}>{query || t('shop.search')}</span>
            </button>
            <FilterSection title={t('shop.category')} isOpen={openSections.categories} onToggle={() => toggleSection('categories')}>
                {categories.map((category) => <label key={category.id} className="flex items-center gap-3 text-neutral-700"><input type="checkbox" checked={selectedCategories.includes(String(category.id))} onChange={() => { const id = String(category.id); setSelectedCategories((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]); }} className="h-5 w-5 accent-black" />{category.name}</label>)}
            </FilterSection>
            <FilterSection title={t('shop.productType')} isOpen={openSections.type} onToggle={() => toggleSection('type')}>
                {[['', t('shop.allProducts')], ['featured', t('shop.featured')], ['discount', t('shop.discount')]].map(([value, label]) => <label key={value} className="flex items-center gap-3 text-neutral-700"><input type="radio" name={`${instance}-type`} checked={selectedType === value} onChange={() => setSelectedType(value)} className="h-5 w-5 accent-black" />{label}</label>)}
            </FilterSection>
            <FilterSection title={t('shop.availability')} isOpen={openSections.availability} onToggle={() => toggleSection('availability')}>
                <label className="flex items-center gap-3 text-neutral-700"><input type="radio" name={`${instance}-availability`} checked={!inStockOnly} onChange={() => setInStockOnly(false)} className="h-5 w-5 accent-black" />{t('shop.allAvailability')}</label>
                <label className="flex items-center gap-3 text-neutral-700"><input type="radio" name={`${instance}-availability`} checked={inStockOnly} onChange={() => setInStockOnly(true)} className="h-5 w-5 accent-black" />{t('shop.inStock')}</label>
            </FilterSection>
            <FilterSection title={t('shop.price')} isOpen={openSections.price} onToggle={() => toggleSection('price')}>
                <div className="space-y-4">
                    <label className="block space-y-2 text-xs text-neutral-600">
                        <span className="flex items-center justify-between"><span>{t('shop.min')}</span><span className="font-medium text-black">{money(Number(minimumPrice))}</span></span>
                        <input aria-label={t('shop.min')} type="range" min={priceRange.min} max={Number(maximumPrice)} step="10000" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} className="h-2 w-full cursor-pointer accent-black" />
                    </label>
                    <label className="block space-y-2 text-xs text-neutral-600">
                        <span className="flex items-center justify-between"><span>{t('shop.max')}</span><span className="font-medium text-black">{money(Number(maximumPrice))}</span></span>
                        <input aria-label={t('shop.max')} type="range" min={Number(minimumPrice)} max={priceRange.max} step="10000" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} className="h-2 w-full cursor-pointer accent-black" />
                    </label>
                </div>
            </FilterSection>
            <FilterSection title={t('shop.size')} isOpen={openSections.size} onToggle={() => toggleSection('size')}>
                <div className="flex flex-wrap gap-1.5">
                    {sizes.map((size) => {
                        const isSelected = selectedSizesFilter.includes(size);

                        return <button key={size} type="button" aria-pressed={isSelected} onClick={() => setSelectedSizesFilter((current) => isSelected ? current.filter((selectedSize) => selectedSize !== size) : [...current, size])} className={`min-w-9 rounded-sm border px-2 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${isSelected ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-black hover:border-neutral-500'}`}>{size}</button>;
                    })}
                </div>
            </FilterSection>
            <div className="p-4 pt-5">
                <button type="button" onClick={applyFilters} className="w-full rounded-sm bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800">{t('shop.apply')}</button>
                {hasActiveFilters && <button type="button" onClick={resetFilters} className="mt-2 w-full border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-50">{t('shop.resetFilters')}</button>}
            </div>
        </div>
    );
    return <><Head title={`${t('nav.shop')} — Mellif Studio`} /><main className="mx-auto min-h-screen max-w-none px-4 pb-20 pt-24 md:px-8 md:pt-28 xl:px-10"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-medium md:text-3xl">{catalogTitle}</h1><select aria-label={`${t('shop.sort')}: ${t('shop.popular')}`} value={filters.sort ?? 'popular'} onChange={(event) => visit({ sort: event.target.value })} className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black" style={{ colorScheme: 'light' }}><option className="bg-white text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900" value="popular">{t('shop.sort')}: {t('shop.popular')}</option><option className="bg-white text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900" value="newest">{t('shop.newest')}</option><option className="bg-white text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900" value="price_low">{t('shop.priceLow')}</option><option className="bg-white text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900" value="price_high">{t('shop.priceHigh')}</option></select></div><button onClick={() => setMobileFilters(true)} className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium lg:hidden"><Filter size={16} /> {t('shop.filter')}</button><div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]"><aside className="hidden lg:block">{filtersPanel('desktop')}</aside><section><div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">{products.data.map((product) => <ProductCard key={product.id} product={product} stackDiscountPrice onBuy={(item) => { setBuyProduct(item); setSelectedSize(null); setQuantity(1); }} />)}</div>{products.data.length === 0 && <p className="py-20 text-center text-neutral-500">{t('shop.notFound')}</p>}{products.total > 9 && <div className="mt-8 flex flex-wrap justify-center gap-2">{products.links.map((link, index) => { const label = link.label.includes('Previous') ? t('shop.previous') : link.label.includes('Next') ? t('shop.next') : link.label; return <button key={`${link.label}-${index}`} disabled={!link.url} onClick={() => link.url && router.visit(link.url, { preserveState: true, preserveScroll: true })} className={`min-w-9 border px-3 py-2 text-sm ${link.active ? 'bg-black text-white' : ''} disabled:opacity-40`} dangerouslySetInnerHTML={{ __html: label }} />; })}</div>}<p className="mt-3 text-center text-xs text-neutral-500">{products.total} {t('shop.productCount')} · {totalPages} {t('shop.pageCount')}</p></section></div></main>{mobileFilters && <div className="fixed inset-0 z-[60] bg-black/40 lg:hidden" onClick={() => setMobileFilters(false)}><section onClick={(event) => event.stopPropagation()} className="absolute inset-y-0 left-0 w-[min(360px,90vw)] overflow-y-auto bg-white p-5"><div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-medium">{t('shop.filter')}</h2><button aria-label={t('shop.closeFilter')} onClick={() => setMobileFilters(false)}><X /></button></div>{filtersPanel('mobile')}</section></div>}{buyProduct && <ProductSelectionDialog product={buyProduct} selectedVariant={selectedSize} quantity={quantity} remainingStock={remainingStock} onClose={() => setBuyProduct(null)} onChooseSize={(variant) => { void chooseBuySize(variant); }} onQuantityChange={setQuantity} onAddToCart={() => setCartAddOpen(true)} />}<CartAddDialog
            open={cartAddOpen && Boolean(buyProduct && selectedSize)}
            productName={buyProduct?.name ?? ''}
            productImage={buyProduct?.images[0] ?? '/storage/products/placeholder.svg'}
            size={selectedSize?.size ?? ''}
            quantity={quantity}
            title={t('cart.addConfirmTitle')}
            description={t('cart.addConfirmDescription')}
            confirmLabel={t('cart.confirmAdd')}
            cancelLabel={t('common.cancel')}
            processing={cartAddProcessing}
            onOpenChange={(open) => {
                if (!cartAddProcessing) setCartAddOpen(open);
            }}
            onConfirm={() => { void addToCart(); }}
        />
        {notice && <button onClick={() => setNotice('')} className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 bg-black px-5 py-3 text-sm text-white">{notice}</button>}</>;
}
