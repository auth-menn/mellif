import { Link } from '@inertiajs/react';
import type { Product } from '@/types/store';
import { money } from '@/types/store';
import { show as productRoute } from '@/routes/shop';
import { useTranslation } from '@/hooks/use-translation';

export default function ProductCard({ product, onBuy }: { product: Product; onBuy: (product: Product) => void }) {
    const { t } = useTranslation();
    const detailUrl = productRoute.url({ product: product.slug });
    return <article className="group min-w-0 overflow-hidden rounded-lg bg-white shadow-[0_2px_14px_rgba(0,0,0,.09)]"><Link href={detailUrl} className="relative block aspect-[.91] overflow-hidden bg-[#c7c7c7]"><img src={product.images[0] ?? '/storage/products/placeholder.svg'} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />{product.discount_percent !== null && <span className="absolute right-3 top-3 bg-red-600 px-1.5 py-1 text-xs font-semibold text-white">{product.discount_percent}%</span>}{product.stock <= 5 && <span className="absolute left-3 top-3 bg-neutral-500 px-2 py-1 text-[10px] font-semibold text-white">{product.stock === 0 ? t('product.soldOut') : t('product.lowStock')}</span>}</Link><div className="space-y-1.5 p-3 md:p-4"><Link href={detailUrl} className="block truncate text-sm md:text-base">{product.name}</Link>{product.discount_percent !== null && <p className="text-xs text-neutral-500 line-through">{money(product.price)}</p>}<p className="text-sm font-medium">{money(product.discounted_price)}</p><button onClick={() => onBuy(product)} disabled={product.stock === 0} className="mt-2 w-full border border-black py-2.5 text-sm transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40">{t('product.buy')}</button></div></article>;
}
