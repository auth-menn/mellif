import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { CartLine } from '@/types/store';
import { money } from '@/types/store';
import { store as placeOrder } from '@/routes/checkout';
import { login } from '@/routes';
import { index as shopIndex } from '@/routes/shop';
import AuthModal from '@/components/store/auth-modal';
import CartRemoveDialog from '@/components/store/cart-remove-dialog';
import { loadServerCart, mergeGuestCart, readGuestCart, removeServerCartLine, setServerCart } from '@/lib/cart-api';
import { useTranslation } from '@/hooks/use-translation';

type Courier = { id: number; name: string; flat_cost: number };
type PaymentMethod = { id: number; name: string };

export default function Checkout({ couriers, paymentMethods, orderNumber }: { couriers: Courier[]; paymentMethods: PaymentMethod[]; orderNumber: string | null }) {
    const { props } = usePage();
    const { t } = useTranslation();
    const user = (props.auth as { user?: { id: number; name: string; phone?: string | null; address?: string | null; address_detail?: string | null } | null } | undefined)?.user;
    const [cart, setCart] = useState<CartLine[]>([]);
    const [courierId, setCourierId] = useState(couriers[0]?.id ?? 0);
    const [paymentId, setPaymentId] = useState(paymentMethods[0]?.id ?? 0);
    const [form, setForm] = useState({ recipient_name: user?.name ?? '', phone: user?.phone ?? '', address: user?.address ?? '', address_detail: user?.address_detail ?? '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [authOpen, setAuthOpen] = useState(false);
    const [cartMessage, setCartMessage] = useState('');
    const [pendingCartRemoval, setPendingCartRemoval] = useState<CartLine | null>(null);
    const [cartRemovalProcessing, setCartRemovalProcessing] = useState(false);

    useEffect(() => {
        if (!user) return;

        setForm((current) => ({
            recipient_name: current.recipient_name || user.name,
            phone: current.phone || user.phone || '',
            address: current.address || user.address || '',
            address_detail: current.address_detail || user.address_detail || '',
        }));
    }, [user?.id, user?.name, user?.phone, user?.address, user?.address_detail]);

    useEffect(() => {
        let active = true;
        const loadCart = async (): Promise<void> => {
            if (user) {
                await mergeGuestCart();
                const items = await loadServerCart();
                if (active) setCart(items);
                return;
            }
            if (active) setCart(readGuestCart());
        };
        void loadCart().catch(() => setCartMessage(t('cart.loadFailed')));
        return () => { active = false; };
    }, [user?.id]);

    const subtotal = cart.reduce((sum, line) => sum + line.product.discounted_price * line.quantity, 0);
    const shipping = couriers.find((courier) => courier.id === courierId)?.flat_cost ?? 0;
    const updateCart = (next: CartLine[]): void => {
        setCart(next);
        if (user) {
            void setServerCart(next).catch(() => setCartMessage(t('cart.updateFailed')));
        } else {
            localStorage.setItem('mellif-cart', JSON.stringify(next));
            window.dispatchEvent(new Event('mellif-cart-updated'));
        }
    };
    const confirmCartRemoval = async (): Promise<void> => {
        if (!pendingCartRemoval) return;

        setCartRemovalProcessing(true);
        try {
            if (user) {
                await removeServerCartLine(pendingCartRemoval.variant.id);
            } else {
                const nextCart = cart.filter((line) => line.variant.id !== pendingCartRemoval.variant.id);
                localStorage.setItem('mellif-cart', JSON.stringify(nextCart));
                window.dispatchEvent(new Event('mellif-cart-updated'));
            }
            setCart((current) => current.filter((line) => line.variant.id !== pendingCartRemoval.variant.id));
            setPendingCartRemoval(null);
        } catch {
            setCartMessage(t('cart.updateFailed'));
        } finally {
            setCartRemovalProcessing(false);
        }
    };
    const submitOrder = (): void => {
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

    const submit = (): void => {
        if (!user) {
            setAuthOpen(true);
            return;
        }
        submitOrder();
    };

    if (orderNumber) return <><Head title={`${t('checkout.accepted')} — Mellif Studio`} /><main className="mx-auto min-h-screen max-w-3xl px-6 pb-20 pt-40 text-center"><p className="text-xs uppercase tracking-[.25em] text-neutral-500">{t('checkout.accepted')}</p><h1 className="mt-5 text-4xl font-medium">{t('checkout.thanks')}</h1><p className="mt-5 text-neutral-600">{t('checkout.orderNumber')}</p><p className="mt-2 text-xl font-semibold">{orderNumber}</p><p className="mx-auto mt-8 max-w-xl text-sm leading-6 text-neutral-500">{t('checkout.paymentLater')}</p><Link href={shopIndex.url()} className="mt-8 inline-block bg-black px-8 py-4 text-sm text-white">{t('checkout.continueShopping')}</Link></main></>;

    return <><Head title={`Checkout — Mellif Studio`} /><main className="mx-auto min-h-screen max-w-6xl px-5 pb-20 pt-28"><h1 className="mb-8 text-3xl font-medium">{t('checkout.title')}</h1><div className="grid gap-10 md:grid-cols-[1.3fr_.7fr]"><section className="space-y-5"><h2 className="text-lg font-medium">{t('checkout.recipient')}</h2>{([['recipient_name', t('checkout.recipient')], ['phone', t('checkout.phone')], ['address', t('checkout.address')], ['address_detail', t('checkout.addressDetail')]] as const).map(([key, label]) => <label key={key} className="block text-sm">{label}{key.includes('address') ? <textarea value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-2 min-h-20 w-full border border-neutral-300 p-3" /> : <input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-2 w-full border border-neutral-300 px-3 py-3" />}{errors[key] && <span className="mt-1 block text-xs text-red-600">{errors[key]}</span>}</label>)}<label className="block text-sm">{t('checkout.courier')}<select value={courierId} onChange={(event) => setCourierId(Number(event.target.value))} className="mt-2 w-full border border-neutral-300 px-3 py-3">{couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name} · {money(courier.flat_cost)}</option>)}</select></label><label className="block text-sm">{t('checkout.payment')}<select value={paymentId} onChange={(event) => setPaymentId(Number(event.target.value))} className="mt-2 w-full border border-neutral-300 px-3 py-3">{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label></section><aside className="h-fit border border-neutral-200 p-5"><h2 className="mb-5 text-lg font-medium">{t('checkout.summary')}</h2>{cartMessage && <p role="alert" className="mb-4 text-sm text-red-700">{cartMessage}</p>}{cart.length === 0 ? <p className="py-4 text-sm text-neutral-500">{t('checkout.empty')} <Link className="underline" href={shopIndex.url()}>{t('checkout.chooseProduct')}</Link></p> : <div className="space-y-4">{cart.map((line) => <div key={line.variant.id} className="flex items-start justify-between gap-3 text-sm"><div><p>{line.product.name}</p><p className="text-xs text-neutral-500">{t('cart.size')} {line.variant.size} · {money(line.product.discounted_price)}</p><div className="mt-1 flex items-center gap-2"><button aria-label={`${t('cart.quantity')} −`} onClick={() => updateCart(cart.map((item) => item.variant.id === line.variant.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}>−</button><span>{line.quantity}</span><button aria-label={`${t('cart.quantity')} +`} onClick={() => updateCart(cart.map((item) => item.variant.id === line.variant.id ? { ...item, quantity: Math.min(item.variant.stock, item.quantity + 1) } : item))}>+</button><button className="ml-2 text-xs underline" onClick={() => setPendingCartRemoval(line)}>{t('cart.remove')}</button></div></div><span>{money(line.product.discounted_price * line.quantity)}</span></div>)}</div>}<div className="mt-6 space-y-3 border-t pt-4 text-sm"><p className="flex justify-between"><span>{t('checkout.subtotal')}</span><span>{money(subtotal)}</span></p><p className="flex justify-between"><span>{t('checkout.shipping')}</span><span>{money(shipping)}</span></p><p className="flex justify-between border-t pt-3 font-semibold"><span>{t('checkout.total')}</span><span>{money(subtotal + shipping)}</span></p></div><button disabled={!cart.length} onClick={submit} className="mt-5 w-full bg-black py-4 text-sm font-medium text-white disabled:opacity-40">{t('checkout.placeOrder')}</button></aside></div></main><CartRemoveDialog
            open={pendingCartRemoval !== null}
            productName={pendingCartRemoval?.product.name ?? ''}
            title={t('cart.removeConfirmTitle')}
            description={t('cart.removeConfirmDescription')}
            confirmLabel={t('cart.confirmRemove')}
            cancelLabel={t('common.cancel')}
            processing={cartRemovalProcessing}
            onOpenChange={(open) => {
                if (!open && !cartRemovalProcessing) setPendingCartRemoval(null);
            }}
            onConfirm={() => { void confirmCartRemoval(); }}
        />
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} onAuthenticated={submitOrder} /></>;
}
