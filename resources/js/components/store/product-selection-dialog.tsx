import { X } from 'lucide-react';
import type { Product, StoreVariant } from '@/types/store';
import { money } from '@/types/store';
import { useTranslation } from '@/hooks/use-translation';

type ProductSelectionDialogProps = {
    product: Product | null;
    selectedVariant: StoreVariant | null;
    quantity: number;
    remainingStock: number;
    onClose: () => void;
    onChooseSize: (variant: StoreVariant) => void;
    onQuantityChange: (quantity: number) => void;
    onAddToCart: () => void;
};

export default function ProductSelectionDialog({
    product,
    selectedVariant,
    quantity,
    remainingStock,
    onClose,
    onChooseSize,
    onQuantityChange,
    onAddToCart,
}: ProductSelectionDialogProps) {
    const { t } = useTranslation();

    if (!product) return null;

    const productImage = product.images[0] ?? '/storage/products/placeholder.svg';

    return (
        <div
            role="presentation"
            className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4"
            onClick={onClose}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="buy-title"
                onClick={(event) => event.stopPropagation()}
                className="relative w-full max-w-3xl bg-white p-5 pt-14 sm:p-7"
            >
                <button
                    type="button"
                    aria-label={t('product.close')}
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 grid size-9 place-items-center bg-white text-black transition-colors hover:bg-neutral-100 sm:right-5 sm:top-5"
                >
                    <X size={20} />
                </button>
                <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,1fr)_280px] sm:gap-7">
                    <div>
                        <p className="text-xs uppercase tracking-[.18em] text-neutral-500">{product.category}</p>
                        <h2 id="buy-title" className="mt-2 text-xl font-medium">{product.name}</h2>
                        <p className="mt-2 text-sm">{money(product.discounted_price)}</p>

                        <p className="mb-3 mt-6 text-sm">{t('product.chooseSize')}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {product.variants.map((variant) => (
                                <button
                                    key={variant.id}
                                    type="button"
                                    disabled={variant.stock === 0}
                                    onClick={() => onChooseSize(variant)}
                                    className={`min-w-12 border px-3 py-2 text-sm ${selectedVariant?.id === variant.id ? 'border-black bg-black text-white' : 'border-neutral-300'} disabled:cursor-not-allowed disabled:opacity-30`}
                                >
                                    {variant.size}
                                </button>
                            ))}
                        </div>

                        <div className="mt-5">
                            <p className="text-sm">{t('product.quantity')}</p>
                            <div className="mt-2 flex h-11 w-32 items-stretch border border-neutral-300">
                                <button
                                    type="button"
                                    aria-label="Kurangi jumlah"
                                    disabled={!selectedVariant || quantity <= 1}
                                    onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                                    className="grid w-10 place-items-center text-lg disabled:cursor-not-allowed disabled:text-neutral-300"
                                >
                                    −
                                </button>
                                <span aria-live="polite" className="grid flex-1 place-items-center border-x border-neutral-300 text-sm">{quantity}</span>
                                <button
                                    type="button"
                                    aria-label="Tambah jumlah"
                                    disabled={!selectedVariant || quantity >= Math.min(remainingStock, 99)}
                                    onClick={() => onQuantityChange(Math.min(remainingStock, 99, quantity + 1))}
                                    className="grid w-10 place-items-center text-lg disabled:cursor-not-allowed disabled:text-neutral-300"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        {selectedVariant && <p className="mt-2 text-xs text-neutral-500">{t('cart.remainingAdd')}: {remainingStock}</p>}
                    </div>

                    <div className="order-first h-40 overflow-hidden bg-neutral-100 sm:order-last sm:aspect-square sm:h-auto">
                        <img src={productImage} alt={product.name} className="h-full w-full object-cover" />
                    </div>
                </div>

                <button
                    type="button"
                    disabled={!selectedVariant || remainingStock === 0}
                    onClick={onAddToCart}
                    className="mt-4 w-full bg-black py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {t('product.addToCart')}
                </button>
            </section>
        </div>
    );
}
