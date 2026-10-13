import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import type { CartLine } from '@/types/store';
import { money } from '@/types/store';
import { store as placeOrder } from '@/routes/checkout';
import {
    destinations as destinationRoute,
    rates as ratesRoute,
} from '@/routes/shipping';
import { index as shopIndex } from '@/routes/shop';
import AuthModal from '@/components/store/auth-modal';
import CartRemoveDialog from '@/components/store/cart-remove-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    loadServerCart,
    mergeGuestCart,
    readGuestCart,
    removeServerCartLine,
} from '@/lib/cart-api';
import { useTranslation } from '@/hooks/use-translation';

type Destination = { id: number; label: string };
type Rate = {
    code: string;
    name: string;
    service: string;
    description: string;
    cost: number;
    etd: string | null;
};
type PaymentMethod = { id: number; name: string };

function xsrfToken(): string {
    const token = document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
        ?.split('=')
        .slice(1)
        .join('=');
    return token ? decodeURIComponent(token) : '';
}

export default function Checkout({
    paymentMethods,
    orderNumber,
}: {
    paymentMethods: PaymentMethod[];
    orderNumber: string | null;
}) {
    const { props } = usePage();
    const { t } = useTranslation();
    const user = (
        props.auth as
            | {
                  user?: {
                      id: number;
                      name: string;
                      phone?: string | null;
                      address?: string | null;
                      address_detail?: string | null;
                  } | null;
              }
            | undefined
    )?.user;
    const [cart, setCart] = useState<CartLine[]>([]);
    const [paymentId, setPaymentId] = useState(paymentMethods[0]?.id ?? 0);
    const [form, setForm] = useState({
        recipient_name: user?.name ?? '',
        phone: user?.phone ?? '',
        address: user?.address ?? '',
        address_detail: user?.address_detail ?? '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [authOpen, setAuthOpen] = useState(false);
    const [cartMessage, setCartMessage] = useState('');
    const [pendingCartRemoval, setPendingCartRemoval] =
        useState<CartLine | null>(null);
    const [cartRemovalProcessing, setCartRemovalProcessing] = useState(false);
    const [orderConfirmOpen, setOrderConfirmOpen] = useState(false);
    const [orderSubmitting, setOrderSubmitting] = useState(false);
    const [destinationQuery, setDestinationQuery] = useState('');
    const [destination, setDestination] = useState<Destination | null>(null);
    const [destinationOptions, setDestinationOptions] = useState<Destination[]>(
        [],
    );
    const [destinationLoading, setDestinationLoading] = useState(false);
    const [destinationError, setDestinationError] = useState('');
    const [rates, setRates] = useState<Rate[]>([]);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [ratesError, setRatesError] = useState('');
    const [selectedRateKey, setSelectedRateKey] = useState('');

    useEffect(() => {
        if (!user) return;
        setForm((current) => ({
            recipient_name: current.recipient_name || user.name,
            phone: current.phone || user.phone || '',
            address: current.address || user.address || '',
            address_detail: current.address_detail || user.address_detail || '',
        }));
    }, [
        user?.id,
        user?.name,
        user?.phone,
        user?.address,
        user?.address_detail,
    ]);

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
        return () => {
            active = false;
        };
    }, [user?.id]);

    useEffect(() => {
        const query = destinationQuery.trim();
        if (query.length < 3 || destination?.label === query) {
            setDestinationOptions([]);
            setDestinationLoading(false);
            return;
        }
        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            setDestinationLoading(true);
            setDestinationError('');
            try {
                const response = await fetch(
                    destinationRoute.url({ query: { q: query } }),
                    {
                        headers: { Accept: 'application/json' },
                        signal: controller.signal,
                    },
                );
                const payload = (await response.json()) as {
                    destinations?: Destination[];
                    message?: string;
                };
                if (!response.ok)
                    throw new Error(
                        payload.message ?? t('checkout.destinationFailed'),
                    );
                setDestinationOptions(payload.destinations ?? []);
            } catch (error) {
                if (!controller.signal.aborted)
                    setDestinationError(
                        error instanceof Error
                            ? error.message
                            : t('checkout.destinationFailed'),
                    );
            } finally {
                if (!controller.signal.aborted) setDestinationLoading(false);
            }
        }, 400);
        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [destinationQuery, destination?.label]);

    const cartSignature = useMemo(
        () =>
            cart
                .map((line) => `${line.variant.id}:${line.quantity}`)
                .sort()
                .join(','),
        [cart],
    );
    useEffect(() => {
        if (!destination || !cart.length) {
            setRates([]);
            setSelectedRateKey('');
            setRatesLoading(false);
            return;
        }
        const controller = new AbortController();
        const loadRates = async (): Promise<void> => {
            setRatesLoading(true);
            setRatesError('');
            setRates([]);
            setSelectedRateKey('');
            try {
                const response = await fetch(ratesRoute.url(), {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': xsrfToken(),
                    },
                    body: JSON.stringify({
                        destination_id: destination.id,
                        items: cart.map((line) => ({
                            variant_id: line.variant.id,
                            qty: line.quantity,
                        })),
                    }),
                    signal: controller.signal,
                });
                const payload = (await response.json()) as {
                    rates?: Rate[];
                    message?: string;
                };
                if (!response.ok)
                    throw new Error(
                        payload.message ?? t('checkout.ratesFailed'),
                    );
                setRates(payload.rates ?? []);
            } catch (error) {
                if (!controller.signal.aborted)
                    setRatesError(
                        error instanceof Error
                            ? error.message
                            : t('checkout.ratesFailed'),
                    );
            } finally {
                if (!controller.signal.aborted) setRatesLoading(false);
            }
        };
        void loadRates();
        return () => controller.abort();
    }, [destination?.id, cartSignature]);

    const subtotal = cart.reduce(
        (sum, line) => sum + line.product.discounted_price * line.quantity,
        0,
    );
    const selectedRate =
        rates.find(
            (rate) => `${rate.code}:${rate.service}` === selectedRateKey,
        ) ?? null;
    const shipping = selectedRate?.cost ?? 0;

    const confirmCartRemoval = async (): Promise<void> => {
        if (!pendingCartRemoval) return;
        setCartRemovalProcessing(true);
        try {
            if (user) {
                await removeServerCartLine(pendingCartRemoval.variant.id);
            } else {
                const nextCart = cart.filter(
                    (line) => line.variant.id !== pendingCartRemoval.variant.id,
                );
                localStorage.setItem('mellif-cart', JSON.stringify(nextCart));
                window.dispatchEvent(new Event('mellif-cart-updated'));
            }
            setCart((current) =>
                current.filter(
                    (line) => line.variant.id !== pendingCartRemoval.variant.id,
                ),
            );
            setPendingCartRemoval(null);
        } catch {
            setCartMessage(t('cart.updateFailed'));
        } finally {
            setCartRemovalProcessing(false);
        }
    };

    const submitOrder = (): void => {
        if (!destination || !selectedRate) return;
        setErrors({});
        router.post(
            placeOrder.url(),
            {
                ...form,
                destination_id: destination.id,
                destination_label: destination.label,
                courier_code: selectedRate.code,
                courier_service: selectedRate.service,
                payment_method_id: paymentId,
                items: cart.map((line) => ({
                    variant_id: line.variant.id,
                    qty: line.quantity,
                })),
            },
            {
                onStart: () => setOrderSubmitting(true),
                onError: (responseErrors) =>
                    setErrors(responseErrors as Record<string, string>),
                onSuccess: () => {
                    localStorage.removeItem('mellif-cart');
                    setCart([]);
                    window.dispatchEvent(new Event('mellif-cart-updated'));
                },
                onFinish: () => setOrderSubmitting(false),
            },
        );
    };

    const submit = (): void => {
        if (!user) {
            setAuthOpen(true);
            return;
        }
        submitOrder();
    };

    const confirmCheckout = (): void => {
        setOrderConfirmOpen(false);
        submit();
    };

    if (orderNumber)
        return (
            <>
                <Head title={`${t('checkout.accepted')} · Mellif Studio`} />
                <main className="mx-auto min-h-screen max-w-3xl px-6 pt-40 pb-20 text-center">
                    <p className="text-xs tracking-[.25em] text-neutral-500 uppercase">
                        {t('checkout.accepted')}
                    </p>
                    <h1 className="mt-5 text-4xl font-medium">
                        {t('checkout.thanks')}
                    </h1>
                    <p className="mt-5 text-neutral-600">
                        {t('checkout.orderNumber')}
                    </p>
                    <p className="mt-2 text-xl font-semibold">{orderNumber}</p>
                    <p className="mx-auto mt-8 max-w-xl text-sm leading-6 text-neutral-500">
                        {t('checkout.paymentLater')}
                    </p>
                    <Link
                        href={shopIndex.url()}
                        className="mt-8 inline-block bg-black px-8 py-4 text-sm text-white"
                    >
                        {t('checkout.continueShopping')}
                    </Link>
                </main>
            </>
        );

    return (
        <>
            <Head title="Checkout · Mellif Studio" />
            <main className="mx-auto min-h-screen max-w-6xl px-5 pt-28 pb-20">
                <h1 className="mb-8 text-center text-3xl font-medium">
                    {t('checkout.title')}
                </h1>
                <div className="grid gap-10 md:grid-cols-[1.3fr_.7fr]">
                    <section className="space-y-5">
                        <div>
                            <p className="mt-2 text-xs text-neutral-500">
                                <span className="text-red-600">*</span>{' '}
                                {t('checkout.requiredNote')}
                            </p>
                        </div>
                        {(
                            [
                                ['recipient_name', t('checkout.recipient')],
                                ['phone', t('checkout.phone')],
                                ['address', t('checkout.address')],
                                ['address_detail', t('checkout.addressDetail')],
                            ] as const
                        ).map(([key, label]) => (
                            <label key={key} className="block text-sm">
                                <span>
                                    {label}
                                    {key !== 'address_detail' && (
                                        <span
                                            className="ml-1 text-red-600"
                                            aria-hidden="true"
                                        >
                                            *
                                        </span>
                                    )}
                                </span>
                                {key.includes('address') ? (
                                    <textarea
                                        required={key !== 'address_detail'}
                                        value={form[key]}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                [key]: event.target.value,
                                            })
                                        }
                                        className="mt-2 min-h-20 w-full border border-neutral-300 p-3"
                                    />
                                ) : (
                                    <input
                                        required
                                        value={form[key]}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                [key]: event.target.value,
                                            })
                                        }
                                        className="mt-2 w-full border border-neutral-300 px-3 py-3"
                                    />
                                )}
                                {errors[key] && (
                                    <span className="mt-1 block text-xs text-red-600">
                                        {errors[key]}
                                    </span>
                                )}
                            </label>
                        ))}
                        <div className="relative">
                            <label className="block text-sm">
                                {t('checkout.destination')}
                                <input
                                    value={destinationQuery}
                                    onChange={(event) => {
                                        setDestinationQuery(event.target.value);
                                        setDestination(null);
                                        setRates([]);
                                        setSelectedRateKey('');
                                    }}
                                    placeholder={t(
                                        'checkout.destinationPlaceholder',
                                    )}
                                    autoComplete="off"
                                    className="mt-2 w-full border border-neutral-300 px-3 py-3"
                                />
                            </label>
                            {destinationLoading && (
                                <p className="mt-1 text-xs text-neutral-500">
                                    {t('checkout.searchingDestination')}
                                </p>
                            )}
                            {destinationError && (
                                <p
                                    role="alert"
                                    className="mt-1 text-xs text-red-700"
                                >
                                    {destinationError}
                                </p>
                            )}
                            {destination && (
                                <p className="mt-1 text-xs text-neutral-600">
                                    {destination.label}
                                </p>
                            )}
                            {destinationOptions.length > 0 && (
                                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto border border-neutral-200 bg-white shadow-lg">
                                    {destinationOptions.map((option) => (
                                        <li key={option.id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDestination(option);
                                                    setDestinationQuery(
                                                        option.label,
                                                    );
                                                    setDestinationOptions([]);
                                                    setDestinationError('');
                                                }}
                                                className="w-full px-3 py-3 text-left text-sm hover:bg-neutral-100"
                                            >
                                                {option.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {errors.destination_id && (
                                <p className="mt-1 text-xs text-red-700">
                                    {errors.destination_id}
                                </p>
                            )}
                        </div>
                        <fieldset className="space-y-2">
                            <legend className="mb-2 text-sm">
                                {t('checkout.courier')}
                            </legend>
                            {ratesLoading && (
                                <p className="text-sm text-neutral-500">
                                    {t('checkout.loadingRates')}
                                </p>
                            )}
                            {ratesError && (
                                <p
                                    role="alert"
                                    className="text-sm text-red-700"
                                >
                                    {ratesError}
                                </p>
                            )}
                            {destination &&
                                !ratesLoading &&
                                !ratesError &&
                                rates.length === 0 && (
                                    <p className="text-sm text-neutral-500">
                                        {t('checkout.noRates')}
                                    </p>
                                )}
                            {rates.map((rate) => {
                                const key = `${rate.code}:${rate.service}`;
                                return (
                                    <label
                                        key={key}
                                        className="flex cursor-pointer items-start gap-3 border border-neutral-200 p-3 text-sm"
                                    >
                                        <input
                                            type="radio"
                                            name="shipping_rate"
                                            value={key}
                                            checked={selectedRateKey === key}
                                            onChange={() =>
                                                setSelectedRateKey(key)
                                            }
                                            className="mt-1"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex justify-between gap-3">
                                                <strong>
                                                    {rate.name} · {rate.service}
                                                </strong>
                                                <strong>
                                                    {money(rate.cost)}
                                                </strong>
                                            </span>
                                            {rate.description && (
                                                <span className="mt-1 block text-xs text-neutral-500">
                                                    {rate.description}
                                                </span>
                                            )}
                                            {rate.etd && (
                                                <span className="mt-1 block text-xs text-neutral-500">
                                                    {t(
                                                        'checkout.estimatedDelivery',
                                                    )}
                                                    : {rate.etd}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}
                            {errors.courier_service && (
                                <p className="text-xs text-red-700">
                                    {errors.courier_service}
                                </p>
                            )}
                        </fieldset>
                        <label className="block text-sm">
                            <span>
                                {t('checkout.payment')}
                                <span
                                    className="ml-1 text-red-600"
                                    aria-hidden="true"
                                >
                                    *
                                </span>
                            </span>
                            <select
                                required
                                value={paymentId}
                                onChange={(event) =>
                                    setPaymentId(Number(event.target.value))
                                }
                                className="mt-2 w-full border border-neutral-300 px-3 py-3"
                            >
                                {paymentMethods.map((method) => (
                                    <option key={method.id} value={method.id}>
                                        {method.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </section>
                    <aside className="h-fit border border-neutral-200 p-5 md:sticky md:top-20 md:z-30 md:self-start">
                        <h2 className="mb-5 text-lg font-medium">
                            {t('checkout.summary')}
                        </h2>
                        {cartMessage && (
                            <p
                                role="alert"
                                className="mb-4 text-sm text-red-700"
                            >
                                {cartMessage}
                            </p>
                        )}
                        {cart.length === 0 ? (
                            <p className="py-4 text-sm text-neutral-500">
                                {t('checkout.empty')}{' '}
                                <Link
                                    className="underline"
                                    href={shopIndex.url()}
                                >
                                    {t('checkout.chooseProduct')}
                                </Link>
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {cart.map((line) => (
                                    <div
                                        key={line.variant.id}
                                        className="flex items-start justify-between gap-3 text-sm"
                                    >
                                        <div className="flex min-w-0 gap-3">
                                            <img
                                                src={
                                                    line.product.images[0] ??
                                                    '/storage/products/placeholder.svg'
                                                }
                                                alt=""
                                                className="h-16 w-14 shrink-0 bg-neutral-100 object-cover"
                                            />
                                            <div className="min-w-0">
                                                <p className="line-clamp-2">
                                                    {line.product.name}
                                                </p>
                                                <p className="text-xs text-neutral-500">
                                                    {t('cart.size')}{' '}
                                                    {line.variant.size} ·{' '}
                                                    {money(
                                                        line.product
                                                            .discounted_price,
                                                    )}
                                                </p>
                                                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                                                    <span>
                                                        {t('cart.quantity')}:{' '}
                                                        {line.quantity}
                                                    </span>
                                                    <button
                                                        className="ml-1 text-red-600 underline transition-colors hover:text-red-800"
                                                        onClick={() =>
                                                            setPendingCartRemoval(
                                                                line,
                                                            )
                                                        }
                                                    >
                                                        {t('cart.remove')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="shrink-0">
                                            {money(
                                                line.product.discounted_price *
                                                    line.quantity,
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-6 space-y-3 border-t pt-4 text-sm">
                            <p className="flex justify-between">
                                <span>{t('checkout.subtotal')}</span>
                                <span>{money(subtotal)}</span>
                            </p>
                            <p className="flex justify-between">
                                <span>{t('checkout.shipping')}</span>
                                <span>
                                    {selectedRate ? money(shipping) : '—'}
                                </span>
                            </p>
                            <p className="flex justify-between border-t pt-3 font-semibold">
                                <span>{t('checkout.total')}</span>
                                <span>{money(subtotal + shipping)}</span>
                            </p>
                        </div>
                        <button
                            disabled={
                                !cart.length || !destination || !selectedRate
                            }
                            onClick={() => setOrderConfirmOpen(true)}
                            className="mt-5 w-full bg-black py-4 text-sm font-medium text-white disabled:opacity-40"
                        >
                            {t('checkout.placeOrder')}
                        </button>
                    </aside>
                </div>
            </main>
            <Dialog
                open={orderConfirmOpen}
                onOpenChange={(open) => {
                    if (!orderSubmitting) setOrderConfirmOpen(open);
                }}
            >
                <DialogContent
                    className="z-[90] bg-white text-neutral-900 sm:max-w-xl"
                    overlayClassName="z-[80]"
                >
                    <DialogHeader>
                        <DialogTitle>{t('checkout.confirmTitle')}</DialogTitle>
                        <DialogDescription className="text-neutral-600">
                            {t('checkout.confirmDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-64 space-y-4 overflow-y-auto">
                        {cart.map((line) => (
                            <div
                                key={line.variant.id}
                                className="flex items-center justify-between gap-4 text-sm"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <img
                                        src={
                                            line.product.images[0] ??
                                            '/storage/products/placeholder.svg'
                                        }
                                        alt=""
                                        className="h-16 w-14 shrink-0 bg-neutral-100 object-cover"
                                    />
                                    <div className="min-w-0">
                                        <p className="line-clamp-2 font-medium">
                                            {line.product.name}
                                        </p>
                                        <p className="text-xs text-neutral-600">
                                            {t('cart.size')} {line.variant.size}{' '}
                                            {t('cart.quantity')} {line.quantity}
                                        </p>
                                    </div>
                                </div>
                                <span className="shrink-0">
                                    {money(
                                        line.product.discounted_price *
                                            line.quantity,
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-2 border-t pt-4 text-sm">
                        <p className="flex justify-between">
                            <span>
                                {t('checkout.shipping')} · {selectedRate?.name}{' '}
                                {selectedRate?.service}
                            </span>
                            <span>{money(shipping)}</span>
                        </p>
                        <p className="flex justify-between font-semibold">
                            <span>{t('checkout.total')}</span>
                            <span>{money(subtotal + shipping)}</span>
                        </p>
                    </div>
                    <DialogFooter>
                        <button
                            type="button"
                            disabled={orderSubmitting}
                            onClick={() => setOrderConfirmOpen(false)}
                            className="border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            disabled={orderSubmitting}
                            onClick={confirmCheckout}
                            className="bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                            {orderSubmitting
                                ? t('checkout.processing')
                                : t('checkout.placeOrder')}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CartRemoveDialog
                open={pendingCartRemoval !== null}
                productName={pendingCartRemoval?.product.name ?? ''}
                productImage={
                    pendingCartRemoval?.product.images[0] ??
                    '/storage/products/placeholder.svg'
                }
                size={pendingCartRemoval?.variant.size ?? ''}
                quantity={pendingCartRemoval?.quantity ?? 0}
                title={t('cart.removeConfirmTitle')}
                description={t('cart.removeConfirmDescription')}
                confirmLabel={t('cart.confirmRemove')}
                cancelLabel={t('common.cancel')}
                processing={cartRemovalProcessing}
                onOpenChange={(open) => {
                    if (!open && !cartRemovalProcessing)
                        setPendingCartRemoval(null);
                }}
                onConfirm={() => {
                    void confirmCartRemoval();
                }}
            />
            <AuthModal
                open={authOpen}
                onOpenChange={setAuthOpen}
                onAuthenticated={submitOrder}
            />
        </>
    );
}
