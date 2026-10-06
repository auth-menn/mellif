import { Link, router } from '@inertiajs/react';
import { Search, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { index as shopIndex, show as shopShow } from '@/routes/shop';
import { money, type Product } from '@/types/store';
import { readRecentlyViewed } from '@/lib/recently-viewed';
import { useTranslation } from '@/hooks/use-translation';

const popularSearches = [
    { label: 'T-Shirt', category: 'T-Shirt' },
    { label: 'Hoodie', category: 'Hoodie' },
    { label: 'Wallet', category: 'Accessories', query: 'Wallet' },
];

export default function SearchOverlay({ open, initialQuery, onClose }: { open: boolean; initialQuery: string; onClose: () => void }) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [recentProducts, setRecentProducts] = useState<Product[]>([]);

    useEffect(() => {
        if (!open) {
            return;
        }

        setRecentProducts(readRecentlyViewed());
        const refreshRecentlyViewed = (): void => setRecentProducts(readRecentlyViewed());
        window.addEventListener('mellif-recently-viewed-updated', refreshRecentlyViewed);

        return () => window.removeEventListener('mellif-recently-viewed-updated', refreshRecentlyViewed);
    }, [open]);

    useEffect(() => {
        if (open) {
            setQuery(initialQuery);
        }
    }, [initialQuery, open]);

    if (!open) {
        return null;
    }

    const navigateToSearch = (searchTerm: string): void => {
        const normalizedQuery = searchTerm.trim();

        if (!normalizedQuery) {
            return;
        }

        onClose();
        router.get(shopIndex.url({ query: { q: normalizedQuery } }), { q: normalizedQuery });
    };

    const navigateToPopularCategory = (category: string, searchTerm?: string): void => {
        onClose();
        const params = { popular_category: category, q: searchTerm };
        router.get(shopIndex.url({ query: params }), params);
    };

    const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        navigateToSearch(query);
    };

    return <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/75 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="w-full bg-white px-4 py-3 text-black sm:px-6">
            <form onSubmit={(event) => submitSearch(event)} className="mx-auto flex max-w-4xl items-center gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-black px-4 py-3">
                    <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-neutral-500 focus:ring-0 sm:text-base" />
                    <button type="submit" aria-label={t('nav.search')} className="grid size-8 shrink-0 place-items-center"><Search size={22} strokeWidth={1.7} /></button>
                </label>
                <button type="button" onClick={onClose} aria-label={t('common.close')} className="grid size-9 shrink-0 place-items-center"><X size={24} strokeWidth={1.7} /></button>
            </form>
        </div>
        <section role="dialog" aria-modal="true" aria-label={t('nav.search')} className="mx-auto mb-8 max-h-[75vh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-b-xl bg-white p-5 text-black shadow-xl sm:p-6">
            <h2 className="text-sm font-medium">{t('search.popular')}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
                {popularSearches.map((search) => <button key={search.label} type="button" onClick={() => navigateToPopularCategory(search.category, search.query)} className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-700">{search.label}</button>)}
            </div>
            <h2 className="mt-7 text-sm font-medium">{t('search.recentlyViewed')}</h2>
            {recentProducts.length === 0 ? <p className="mt-3 text-sm text-neutral-500">{t('search.emptyRecentlyViewed')}</p> : <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {recentProducts.map((product) => <Link key={product.id} href={shopShow.url({ product: product.slug })} onClick={onClose} className="flex h-full min-w-0 flex-col">
                    <img src={product.images[0] ?? '/storage/products/placeholder.svg'} alt={product.name} className="aspect-square w-full shrink-0 rounded-md bg-neutral-200 object-cover" />
                    <span className="mt-2 line-clamp-2 min-h-10 text-sm leading-5">{product.name}</span>
                    <span className="mt-1 flex min-h-5 items-center gap-1.5 whitespace-nowrap">
                        {product.discount_percent !== null && <span className="text-[10px] text-neutral-500 line-through sm:text-xs">{money(product.price)}</span>}
                        <span className="text-xs font-medium sm:text-sm">{money(product.discounted_price)}</span>
                    </span>
                </Link>)}
            </div>}
        </section>
    </div>;
}
