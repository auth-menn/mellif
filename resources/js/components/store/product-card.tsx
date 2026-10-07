import { Link } from '@inertiajs/react';
import type { Product } from '@/types/store';
import { money } from '@/types/store';
import { show as productRoute } from '@/routes/shop';
import { useTranslation } from '@/hooks/use-translation';
import { recordRecentlyViewed } from '@/lib/recently-viewed';

export default function ProductCard({ product, onBuy, stackDiscountPrice = false }: { product: Product; onBuy: (product: Product) => void; stackDiscountPrice?: boolean }) {
    const { t } = useTranslation();
    const detailUrl = productRoute.url({ product: product.slug });
    return (
        <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-neutral-100 bg-white">
            <Link href={detailUrl} onClick={() => recordRecentlyViewed(product)} className="relative block aspect-square shrink-0 overflow-hidden bg-[#c7c7c7]">
                <img src={product.images[0] ?? '/storage/products/placeholder.svg'} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
                {product.images[1] && <img src={product.images[1]} alt={`${product.name} 2`} className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />}
                {product.discount_percent !== null && <span className="absolute right-2 top-2 bg-red-600 px-1.5 py-1 text-[10px] font-semibold text-white">{product.discount_percent}%</span>}
                {product.stock <= 5 && <span className="absolute left-2 top-2 bg-neutral-500 px-2 py-1 text-[10px] font-semibold text-white">{product.stock === 0 ? t('product.soldOut') : t('product.lowStock')}</span>}
            </Link>
            <div className="flex flex-1 flex-col p-2.5">
                <Link href={detailUrl} onClick={() => recordRecentlyViewed(product)} className="line-clamp-2 min-h-10 text-xs leading-5">{product.name}</Link>
                {stackDiscountPrice ? (
                    <div className="mt-1 space-y-1">
                        {product.discount_percent !== null
                            ? <p className="text-[10px] text-neutral-500 line-through">{money(product.price)}</p>
                            : <p aria-hidden="true" className="text-[10px]">&nbsp;</p>}
                        <p className="text-xs font-medium">{money(product.discounted_price)}</p>
                    </div>
                ) : (
                    <div className="mt-1 flex min-h-5 items-center gap-1.5 whitespace-nowrap">
                        {product.discount_percent !== null && <span className="text-[10px] text-neutral-500 line-through">{money(product.price)}</span>}
                        <span className="text-xs font-medium">{money(product.discounted_price)}</span>
                    </div>
                )}
                <button onClick={() => onBuy(product)} disabled={product.stock === 0} className={`${stackDiscountPrice ? 'mt-2' : 'mt-auto'} w-full rounded-sm border border-black py-1.5 text-xs transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40`}>{t('product.buy')}</button>
            </div>
        </article>
    );
}
