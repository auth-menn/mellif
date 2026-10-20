import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import type { CartLine } from '@/types/store';
import { money } from '@/types/store';
import { store as placeOrder } from '@/routes/checkout';
import { qrisStatus } from '@/routes/checkout/orders';
import { regenerate } from '@/routes/checkout/orders/qris';
import {
    destinations as destinationRoute,
    rates as ratesRoute,
} from '@/routes/shipping';
import { index as shopIndex } from '@/routes/shop';
import AuthModal from '@/components/store/auth-modal';
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
type PaymentMethod = { id: number; name: string; code: string };
type QrisPaymentStatus = 'unpaid' | 'paid' | 'expired' | 'cancelled' | 'failed';

function qrisPaymentStatus(
    status: string | null | undefined,
): QrisPaymentStatus | null {
    return status &&
        ['unpaid', 'paid', 'expired', 'cancelled', 'failed'].includes(status)
        ? (status as QrisPaymentStatus)
        : null;
}

type CheckoutOrder = {
    id: number;
    orderNumber: string;
    status: string;
    total: number;
    subtotal: number;
    shippingCost: number;
    shippingCourier: string;
    shippingService: string | null;
    items: {
        name: string;
        size: string;
        quantity: number;
        unitPrice: number;
        imageUrl: string | null;
    }[];
    paymentMethodCode: string | null;
    hasQris: boolean;
    qrisImage: string | null;
    qrisFinalAmount: number | null;
    qrisPaymentStatus: string | null;
    qrisExpiryTime: string | null;
};

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
    order,
}: {
    paymentMethods: PaymentMethod[];
    order: CheckoutOrder | null;
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
    const [deliveryMethod, setDeliveryMethod] = useState<'courier' | 'direct_cod'>(
        'courier',
    );
    const selectedPaymentMethod = paymentMethods.find(
        (method) => method.id === paymentId,
    );
    const isDirectCod = deliveryMethod === 'direct_cod';
    const requiresShipping = !isDirectCod;
    const [form, setForm] = useState({
        recipient_name: user?.name ?? '',
        phone: user?.phone ?? '',
        address: user?.address ?? '',
        address_detail: user?.address_detail ?? '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [authOpen, setAuthOpen] = useState(false);
    const [cartMessage, setCartMessage] = useState('');
    const [orderConfirmOpen, setOrderConfirmOpen] = useState(false);
    const [orderSubmitting, setOrderSubmitting] = useState(false);
    const [keepCheckoutVisible, setKeepCheckoutVisible] = useState(false);
    const [qrisModalOpen, setQrisModalOpen] = useState(Boolean(order));
    const [paymentStatus, setPaymentStatus] =
        useState<QrisPaymentStatus | null>(
            qrisPaymentStatus(order?.qrisPaymentStatus),
        );
    const [qrisSecondsRemaining, setQrisSecondsRemaining] = useState<
        number | null
    >(null);
    const [qrisRegenerating, setQrisRegenerating] = useState(false);
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
        setPaymentStatus(qrisPaymentStatus(order?.qrisPaymentStatus));
    }, [order?.id, order?.qrisPaymentStatus]);

    useEffect(() => {
        if (order?.id) setQrisModalOpen(true);
    }, [order?.id]);

    useEffect(() => {
        if (paymentStatus === 'paid') {
            setKeepCheckoutVisible(false);
        }
    }, [paymentStatus]);

    useEffect(() => {
        if (!order?.qrisExpiryTime || paymentStatus !== 'unpaid') {
            setQrisSecondsRemaining(null);
            return;
        }

        const expiryTimestamp = new Date(order.qrisExpiryTime).getTime();
        if (!Number.isFinite(expiryTimestamp)) {
            setQrisSecondsRemaining(null);
            return;
        }

        const updateCountdown = (): void => {
            setQrisSecondsRemaining(
                Math.max(0, Math.ceil((expiryTimestamp - Date.now()) / 1000)),
            );
        };

        updateCountdown();
        const interval = window.setInterval(updateCountdown, 1000);
        return () => window.clearInterval(interval);
    }, [order?.id, order?.qrisExpiryTime, paymentStatus]);

    useEffect(() => {
        if (!order?.id || !order.hasQris || paymentStatus !== 'unpaid')
            return;

        let active = true;
        const refreshPaymentStatus = async (): Promise<void> => {
            try {
                const response = await fetch(qrisStatus.url(order.id), {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                });
                if (!response.ok) return;
                const result = (await response.json()) as {
                    payment_status?: string;
                };
                if (
                    active &&
                    result.payment_status &&
                    ['unpaid', 'paid', 'expired', 'cancelled'].includes(
                        result.payment_status,
                    )
                ) {
                    setPaymentStatus(
                        result.payment_status as QrisPaymentStatus,
                    );
                    if (result.payment_status === 'paid') {
                        window.dispatchEvent(new Event('mellif-cart-updated'));
                    }
                }
            } catch {
                // Keep the last known payment status when the network is unavailable.
            }
        };

        void refreshPaymentStatus();
        const interval = window.setInterval(
            () => void refreshPaymentStatus(),
            10000,
        );
        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [order?.id, order?.hasQris, paymentStatus]);

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
        if (!isDirectCod) return;

        setDestination(null);
        setDestinationQuery('');
        setDestinationOptions([]);
        setDestinationError('');
        setRates([]);
        setRatesError('');
        setSelectedRateKey('');
    }, [isDirectCod]);

    useEffect(() => {
        const query = destinationQuery.trim();
        if (
            !requiresShipping ||
            query.length < 4 ||
            destination?.label === query
        ) {
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
        }, 700);
        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [destinationQuery, destination?.label, requiresShipping]);

    const cartSignature = useMemo(
        () =>
            cart
                .map((line) => `${line.variant.id}:${line.quantity}`)
                .sort()
                .join(','),
        [cart],
    );
    useEffect(() => {
        if (!requiresShipping || !destination || !cart.length) {
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
    }, [destination?.id, cartSignature, requiresShipping]);

    const subtotal = cart.reduce(
        (sum, line) => sum + line.product.discounted_price * line.quantity,
        0,
    );
    const selectedRate =
        rates.find(
            (rate) => `${rate.code}:${rate.service}` === selectedRateKey,
        ) ?? null;
    const shipping = requiresShipping ? (selectedRate?.cost ?? 0) : 0;

    const submitOrder = (): void => {
        if (requiresShipping && (!destination || !selectedRate)) return;
        setErrors({});
        router.post(
            placeOrder.url(),
            {
                ...form,
                delivery_method: deliveryMethod,
                ...(requiresShipping && destination && selectedRate
                    ? {
                          destination_id: destination.id,
                          destination_label: destination.label,
                          courier_code: selectedRate.code,
                          courier_service: selectedRate.service,
                          expected_shipping_cost: selectedRate.cost,
                      }
                    : {}),
                payment_method_id: paymentId,
                items: cart.map((line) => ({
                    variant_id: line.variant.id,
                    qty: line.quantity,
                })),
            },
            {
                preserveState: true,
                preserveScroll: true,
                onStart: () => setOrderSubmitting(true),
                onError: (responseErrors) =>
                    setErrors(responseErrors as Record<string, string>),
                onSuccess: () => {
                    if (selectedPaymentMethod?.code === 'qris') {
                        setKeepCheckoutVisible(true);
                        setQrisModalOpen(true);
                    } else {
                        localStorage.removeItem('mellif-cart');
                        setCart([]);
                        window.dispatchEvent(new Event('mellif-cart-updated'));
                    }
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

    const isQrisExpired =
        paymentStatus === 'expired' ||
        (paymentStatus === 'unpaid' && qrisSecondsRemaining === 0);
    const canGenerateQris = ['failed', 'expired', 'cancelled'].includes(
        paymentStatus ?? '',
    );

    if (order && !keepCheckoutVisible) {
        const isQrisOrder = order.paymentMethodCode === 'qris';
        const isCodOrder = order.paymentMethodCode === 'cod';
        const isOrderCancelled =
            isQrisOrder && ['cancelled', 'rejected'].includes(order.status);
        const isPaymentComplete =
            !isQrisOrder || (paymentStatus === 'paid' && !isOrderCancelled);

        return (
            <>
                <Head
                    title={`${isPaymentComplete ? t('checkout.accepted') : t('checkout.qrisPayment')} · Mellif Studio`}
                />
                {isPaymentComplete ? (
                    <main className="mx-auto min-h-screen max-w-5xl px-5 pt-24 pb-16 sm:px-8 sm:pt-32 lg:px-10 lg:pt-36">
                        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_24px_80px_-40px_rgba(0,0,0,0.28)]">
                            <div className="bg-neutral-950 px-6 py-8 text-center text-white sm:px-10 sm:py-10">
                                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-7 text-emerald-300">
                                        <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                                    </svg>
                                </div>
                                <p className="mt-5 text-xs font-medium tracking-[.22em] text-white/60 uppercase">
                                    {t('checkout.accepted')}
                                </p>
                                <h1 className="mt-2 text-2xl font-medium sm:text-3xl">
                                    {t('checkout.paymentSuccessTitle')}
                                </h1>
                                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/70">
                                    {t('checkout.paymentSuccessDescription')}
                                </p>
                            </div>
                            <div className="grid gap-x-10 gap-y-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:p-10">
                                <div className="space-y-6">
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
                                    <div>
                                        <p className="text-xs text-neutral-500">{t('checkout.orderNumber')}</p>
                                        <p className="mt-1 font-semibold tracking-wide text-neutral-900">{order.orderNumber}</p>
                                    </div>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                                        <span className="size-1.5 rounded-full bg-emerald-500" />
                                        {t('checkout.qrisStatus.paid')}
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-neutral-900">{t('checkout.orderDetails')}</h2>
                                    <div className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200 px-4">
                                        {order.items.map((item, index) => (
                                            <div key={`${item.name}-${item.size}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                                                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                                                    <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:size-20">
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl} alt={item.name} className="size-full object-cover" loading="lazy" />
                                                        ) : (
                                                            <div className="flex size-full items-center justify-center text-[10px] text-neutral-400">Mellif</div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="line-clamp-2 font-medium text-neutral-900">{item.name}</p>
                                                        <p className="mt-1 text-xs text-neutral-500">{t('cart.size')} {item.size} · {t('cart.quantity')}: {item.quantity}</p>
                                                    </div>
                                                </div>
                                                <p className="shrink-0 text-neutral-700">{money(item.unitPrice * item.quantity)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                        <div className="rounded-xl border border-neutral-200 p-4">
                                            <p className="text-xs text-neutral-500">{t('checkout.amountPaid')}</p>
                                            <p className="mt-1 text-lg font-semibold text-neutral-900">{money(order.qrisFinalAmount ?? order.total)}</p>
                                            <p className="mt-1 text-xs text-neutral-500">QRIS</p>
                                        </div>
                                        <div className="rounded-xl border border-neutral-200 p-4">
                                            <p className="text-xs text-neutral-500">{t('checkout.orderProgress')}</p>
                                            <p className="mt-1 font-semibold text-neutral-900">{t('checkout.packingStatus')}</p>
                                            <p className="mt-1 text-xs leading-5 text-neutral-500">{t('checkout.packing')}</p>
                                        </div>
                                    </div>
                                    <dl className="space-y-2 rounded-xl border border-neutral-200 p-4 text-sm">
                                        <div className="flex justify-between gap-4 text-neutral-600"><dt>{t('checkout.subtotal')}</dt><dd>{money(order.subtotal)}</dd></div>
                                        <div className="flex justify-between gap-4 text-neutral-600"><dt>{t('checkout.shipping')}</dt><dd>{money(order.shippingCost)}</dd></div>
                                        <div className="flex justify-between gap-4 border-t border-neutral-200 pt-3 font-semibold text-neutral-900"><dt>{t('checkout.total')}</dt><dd>{money(order.total)}</dd></div>
                                    </dl>
                                    <div className="rounded-xl border border-neutral-200 px-4 py-3 text-sm">
                                    <p className="text-xs text-neutral-500">{t('checkout.deliveryMethod')}</p>
                                    <p className="mt-1 font-medium text-neutral-900">{order.shippingCourier}{order.shippingService ? ` · ${order.shippingService}` : ''}</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                        {isCodOrder && (
                            <div className="mx-auto mt-8 max-w-xl rounded border border-neutral-200 bg-neutral-50 p-6 text-left">
                                <p className="font-semibold text-neutral-900">
                                    COD
                                </p>
                                <p className="mt-2 text-sm text-neutral-700">
                                    {t('checkout.codInstructions')}
                                </p>
                                <p className="mt-2 text-sm text-neutral-700">
                                    {t('checkout.packing')}
                                </p>
                            </div>
                        )}
                        <Link
                            href={shopIndex.url()}
                            className="mt-8 inline-block bg-black px-8 py-4 text-sm text-white"
                        >
                            {t('checkout.continueShopping')}
                        </Link>
                    </main>
                ) : isOrderCancelled ? (
                    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-40 pb-20 text-center">
                        <p className="text-xs tracking-[.25em] text-neutral-500 uppercase">
                            {t('checkout.qrisStatus.cancelled')}
                        </p>
                        <h1 className="mt-5 text-3xl font-medium">
                            {t('checkout.orderCancelled')}
                        </h1>
                        <p className="mt-4 text-neutral-600">
                            {order.orderNumber}
                        </p>
                        <Link
                            href={shopIndex.url()}
                            className="mt-8 inline-block bg-black px-8 py-4 text-sm text-white"
                        >
                            {t('checkout.continueShopping')}
                        </Link>
                    </main>
                ) : (
                    <>
                        <main className="mx-auto min-h-screen max-w-6xl px-5 pt-28 pb-20">
                            <h1 className="text-center text-3xl font-medium">
                                {t('checkout.title')}
                            </h1>
                            <section className="mx-auto mt-8 max-w-xl border border-neutral-200 p-6 text-center">
                                <p className="text-sm text-neutral-600">
                                    {paymentStatus === 'unpaid'
                                        ? t('checkout.qrisStatus.unpaid')
                                        : paymentStatus === 'expired'
                                          ? t('checkout.qrisStatus.expired')
                                          : paymentStatus === 'cancelled'
                                            ? t('checkout.qrisStatus.cancelled')
                                            : t('checkout.qrisStatus.failed')}
                                </p>
                                <p className="mt-2 text-lg font-semibold">
                                    {order.orderNumber}
                                </p>
                                <p className="mt-3 text-sm text-neutral-600">
                                    {t('checkout.paymentStatusAuto')}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setQrisModalOpen(true)}
                                    className="mt-4 bg-black px-4 py-2 text-sm text-white"
                                >
                                    {t('checkout.viewQris')}
                                </button>
                            </section>
                        </main>
                        <Dialog
                            open={qrisModalOpen}
                            onOpenChange={setQrisModalOpen}
                        >
                            <DialogContent
                                showCloseButton={false}
                                className="z-[90] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md overflow-y-auto bg-white p-4 text-neutral-900 sm:max-h-[90dvh] sm:p-6"
                                overlayClassName="z-[80]"
                            >
                                <DialogHeader>
                                    <DialogTitle>
                                        {t('checkout.qrisPayment')}
                                    </DialogTitle>
                                    <DialogDescription className="text-neutral-600">
                                        {order.orderNumber} ·{' '}
                                        {paymentStatus === 'unpaid' &&
                                        !isQrisExpired
                                            ? t('checkout.qrisStatus.unpaid')
                                            : isQrisExpired
                                              ? t('checkout.qrisStatus.expired')
                                              : paymentStatus === 'cancelled'
                                                ? t(
                                                      'checkout.qrisStatus.cancelled',
                                                  )
                                                : t(
                                                      'checkout.qrisStatus.failed',
                                                  )}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="text-center">
                                    <p className="text-sm text-neutral-600">
                                        {t('checkout.amountToPay')}
                                    </p>
                                    <p className="mt-1 text-3xl font-semibold">
                                        {money(
                                            order.qrisFinalAmount ??
                                                order.total,
                                        )}
                                    </p>
                                    {order.qrisExpiryTime &&
                                        paymentStatus === 'unpaid' &&
                                        !isQrisExpired && (
                                            <p className="mt-2 text-xs text-neutral-500">
                                                {t('checkout.qrisExpires')}:{' '}
                                                {new Date(
                                                    order.qrisExpiryTime,
                                                ).toLocaleString()}
                                            </p>
                                        )}
                                </div>
                                {order.hasQris &&
                                paymentStatus === 'unpaid' &&
                                !isQrisExpired ? (
                                    <div className="flex flex-col items-center gap-4">
                                        {order.qrisImage && (
                                            <img
                                                src={order.qrisImage}
                                                alt={t('checkout.qrisPayment')}
                                                className="size-64 max-h-[min(64vw,42dvh)] max-w-[min(64vw,42dvh)] rounded border border-neutral-200 bg-white p-2"
                                            />
                                        )}
                                        {qrisSecondsRemaining !== null && (
                                            <p
                                                aria-live="polite"
                                                className="text-sm font-medium text-neutral-700 tabular-nums"
                                            >
                                                {t(
                                                    'checkout.qrisTimeRemaining',
                                                )}
                                                :{' '}
                                                {String(
                                                    Math.floor(
                                                        qrisSecondsRemaining /
                                                            60,
                                                    ),
                                                ).padStart(2, '0')}
                                                :
                                                {String(
                                                    qrisSecondsRemaining % 60,
                                                ).padStart(2, '0')}
                                            </p>
                                        )}
                                        <p className="text-center text-sm text-neutral-600">
                                            {t('checkout.qrisInstructions')}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <p className="text-sm text-red-700">
                                            {isQrisExpired
                                                ? t(
                                                      'checkout.qrisExpiredMessage',
                                                  )
                                                : t(
                                                      'checkout.qrisGenerateFailed',
                                                  )}
                                        </p>
                                        {canGenerateQris && (
                                            <button
                                                type="button"
                                                disabled={qrisRegenerating}
                                                onClick={() =>
                                                    router.post(
                                                        regenerate.url(
                                                            order.id,
                                                        ),
                                                        {},
                                                        {
                                                            onStart: () =>
                                                                setQrisRegenerating(
                                                                    true,
                                                                ),
                                                            onFinish: () =>
                                                                setQrisRegenerating(
                                                                    false,
                                                                ),
                                                        },
                                                    )
                                                }
                                                className="mt-3 bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                                            >
                                                {qrisRegenerating
                                                    ? t('checkout.processing')
                                                    : t(
                                                          'checkout.qrisTryAgain',
                                                      )}
                                            </button>
                                        )}
                                    </div>
                                )}
                                <p className="text-center text-xs text-neutral-500">
                                    {t('checkout.paymentStatusAuto')}
                                </p>
                                {order.hasQris && (
                                    <p className="text-center text-xs text-neutral-500">
                                        {t('checkout.qrisModalCloseNote')}
                                    </p>
                                )}
                                <DialogFooter className="border-t border-neutral-200 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setQrisModalOpen(false)}
                                        className="w-full border border-neutral-300 px-4 py-3 text-sm hover:bg-neutral-100 disabled:opacity-50"
                                    >
                                        {t('common.close')}
                                    </button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </>
                )}
            </>
        );
    }

    return (
        <>
            <Head title="Checkout · Mellif Studio" />
            <main className="mx-auto min-h-screen max-w-6xl px-5 pt-28 pb-20">
                <h1 className="mb-8 text-center text-3xl font-medium">
                    {t('checkout.title')}
                </h1>
                {order && keepCheckoutVisible && (
                    <section className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-neutral-200 bg-white p-4 text-sm">
                        <div>
                            <p className="font-medium text-neutral-900">
                                {order.orderNumber}
                            </p>
                            <p className="mt-1 text-neutral-600">
                                {paymentStatus === 'unpaid'
                                    ? t('checkout.qrisStatus.unpaid')
                                    : paymentStatus === 'expired'
                                      ? t('checkout.qrisStatus.expired')
                                      : paymentStatus === 'cancelled'
                                        ? t('checkout.qrisStatus.cancelled')
                                        : t('checkout.qrisStatus.failed')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setQrisModalOpen(true)}
                            className="bg-black px-4 py-2 text-white"
                        >
                            {t('checkout.viewQris')}
                        </button>
                    </section>
                )}
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
                                [
                                    'address',
                                    isDirectCod
                                        ? t('checkout.codMeetupLocation')
                                        : t('checkout.address'),
                                ],
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
                        <label className="block text-sm">
                            <span>
                                {t('checkout.deliveryMethod')}
                                <span
                                    className="ml-1 text-red-600"
                                    aria-hidden="true"
                                >
                                    *
                                </span>
                            </span>
                            <select
                                required
                                value={deliveryMethod}
                                onChange={(event) =>
                                    setDeliveryMethod(
                                        event.target.value as
                                            | 'courier'
                                            | 'direct_cod',
                                    )
                                }
                                className="mt-2 w-full border border-neutral-300 bg-white px-3 py-3 text-neutral-900 [color-scheme:light]"
                            >
                                <option value="courier">
                                    {t('checkout.deliveryCourier')}
                                </option>
                                <option value="direct_cod">
                                    {t('checkout.deliveryCod')}
                                </option>
                            </select>
                        </label>
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
                                className="mt-2 w-full border border-neutral-300 bg-white px-3 py-3 text-neutral-900 [color-scheme:light]"
                            >
                                {paymentMethods.map((method) => (
                                    <option key={method.id} value={method.id}>
                                        {method.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {isDirectCod && (
                            <p className="border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                                {t('checkout.codDirectInstructions')}
                            </p>
                        )}
                        {requiresShipping && (
                            <>
                        <div className="relative">
                            <label className="block text-sm">
                                {t('checkout.destination')}{' '}
                                <span
                                    aria-hidden="true"
                                    className="text-red-700"
                                >
                                    *
                                </span>
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
                            {!destination && !errors.destination_id && (
                                <p className="mt-1 text-xs text-neutral-600">
                                    {t('checkout.destinationRequired')}
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
                            </>
                        )}
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
                                <span>
                                    {isDirectCod
                                        ? t('checkout.noShipping')
                                        : t('checkout.shipping')}
                                </span>
                                <span>
                                    {requiresShipping && !selectedRate
                                        ? '—'
                                        : money(shipping)}
                                </span>
                            </p>
                            <p className="flex justify-between border-t pt-3 font-semibold">
                                <span>{t('checkout.total')}</span>
                                <span>{money(subtotal + shipping)}</span>
                            </p>
                        </div>
                        <button
                            disabled={
                                !cart.length ||
                                (requiresShipping &&
                                    (!destination || !selectedRate))
                            }
                            onClick={() => setOrderConfirmOpen(true)}
                            className="mt-5 w-full bg-black py-4 text-sm font-medium text-white disabled:opacity-40"
                        >
                            {t('checkout.placeOrder')}
                        </button>
                    </aside>
                </div>
            </main>
            {order && keepCheckoutVisible && qrisModalOpen && (
                <Dialog
                    open={qrisModalOpen}
                    onOpenChange={setQrisModalOpen}
                >
                    <DialogContent
                        showCloseButton={false}
                        className="z-[90] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md overflow-y-auto bg-white p-4 text-neutral-900 sm:max-h-[90dvh] sm:p-6"
                        overlayClassName="z-[80]"
                    >
                        <DialogHeader>
                            <DialogTitle>
                                {t('checkout.qrisPayment')}
                            </DialogTitle>
                            <DialogDescription className="text-neutral-600">
                                {order.orderNumber} ·{' '}
                                {isQrisExpired
                                    ? t('checkout.qrisStatus.expired')
                                    : paymentStatus === 'unpaid'
                                      ? t('checkout.qrisStatus.unpaid')
                                      : t('checkout.qrisStatus.failed')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="text-center">
                            <p className="text-sm text-neutral-600">
                                {t('checkout.amountToPay')}
                            </p>
                            <p className="mt-1 text-3xl font-semibold">
                                {money(order.qrisFinalAmount ?? order.total)}
                            </p>
                            {order.qrisExpiryTime &&
                                paymentStatus === 'unpaid' &&
                                !isQrisExpired && (
                                    <p className="mt-2 text-xs text-neutral-500">
                                        {t('checkout.qrisExpires')}:{' '}
                                        {new Date(
                                            order.qrisExpiryTime,
                                        ).toLocaleString()}
                                    </p>
                                )}
                        </div>
                        {order.hasQris &&
                        paymentStatus === 'unpaid' &&
                        !isQrisExpired ? (
                            <div className="flex flex-col items-center gap-4">
                                {order.qrisImage && (
                                    <img
                                        src={order.qrisImage}
                                        alt={t('checkout.qrisPayment')}
                                        className="size-64 max-h-[min(64vw,42dvh)] max-w-[min(64vw,42dvh)] rounded border border-neutral-200 bg-white p-2"
                                    />
                                )}
                                {qrisSecondsRemaining !== null && (
                                    <p
                                        aria-live="polite"
                                        className="text-sm font-medium text-neutral-700 tabular-nums"
                                    >
                                        {t('checkout.qrisTimeRemaining')}:{' '}
                                        {String(
                                            Math.floor(
                                                qrisSecondsRemaining / 60,
                                            ),
                                        ).padStart(2, '0')}
                                        :
                                        {String(
                                            qrisSecondsRemaining % 60,
                                        ).padStart(2, '0')}
                                    </p>
                                )}
                                <p className="text-center text-sm text-neutral-600">
                                    {t('checkout.qrisInstructions')}
                                </p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-sm text-red-700">
                                    {isQrisExpired
                                        ? t('checkout.qrisExpiredMessage')
                                        : t('checkout.qrisGenerateFailed')}
                                </p>
                                {canGenerateQris && (
                                    <button
                                        type="button"
                                        disabled={qrisRegenerating}
                                        onClick={() =>
                                            router.post(
                                                regenerate.url(order.id),
                                                {},
                                                {
                                                    preserveState: true,
                                                    preserveScroll: true,
                                                    onStart: () =>
                                                        setQrisRegenerating(
                                                            true,
                                                        ),
                                                    onFinish: () =>
                                                        setQrisRegenerating(
                                                            false,
                                                        ),
                                                },
                                            )
                                        }
                                        className="mt-3 bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                                    >
                                        {qrisRegenerating
                                            ? t('checkout.processing')
                                            : t('checkout.qrisTryAgain')}
                                    </button>
                                )}
                            </div>
                        )}
                        <p className="text-center text-xs text-neutral-500">
                            {t('checkout.paymentStatusAuto')}
                        </p>
                        {order.hasQris && (
                            <p className="text-center text-xs text-neutral-500">
                                {t('checkout.qrisModalCloseNote')}
                            </p>
                        )}
                        <DialogFooter className="border-t border-neutral-200 pt-4">
                            <button
                                type="button"
                                onClick={() => setQrisModalOpen(false)}
                                className="w-full border border-neutral-300 px-4 py-3 text-sm hover:bg-neutral-100 disabled:opacity-50"
                            >
                                {t('common.close')}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            <Dialog
                open={orderConfirmOpen}
                onOpenChange={(open) => {
                    if (!orderSubmitting) setOrderConfirmOpen(open);
                }}
            >
                <DialogContent
                    className="z-[90] flex max-h-[92svh] flex-col gap-5 overflow-hidden bg-white text-neutral-900 sm:max-w-2xl"
                    overlayClassName="z-[80]"
                >
                    <DialogHeader>
                        <DialogTitle>{t('checkout.confirmTitle')}</DialogTitle>
                        <DialogDescription className="text-neutral-600">
                            {t('checkout.confirmDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                        <dl className="grid overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-sm sm:grid-cols-2">
                            <div className="min-w-0 border-b border-neutral-200 p-3 sm:border-r">
                                <dt className="text-xs text-neutral-500">
                                    {t('checkout.recipient')}
                                </dt>
                                <dd className="mt-1 font-medium break-words text-neutral-900">
                                    {form.recipient_name}
                                </dd>
                            </div>
                            <div className="min-w-0 border-b border-neutral-200 p-3">
                                <dt className="text-xs text-neutral-500">
                                    {t('checkout.phone')}
                                </dt>
                                <dd className="mt-1 font-medium break-words text-neutral-900">
                                    {form.phone}
                                </dd>
                            </div>
                            <div className="min-w-0 border-b border-neutral-200 p-3 sm:col-span-2">
                                <dt className="text-xs text-neutral-500">
                                    {isDirectCod
                                        ? t('checkout.codMeetupLocation')
                                        : t('checkout.address')}
                                </dt>
                                <dd className="mt-1 leading-5 break-words text-neutral-900">
                                    {form.address}
                                    {form.address_detail
                                        ? `, ${form.address_detail}`
                                        : ''}
                                </dd>
                            </div>
                            {requiresShipping && (
                                <div className="min-w-0 border-b border-neutral-200 p-3 sm:col-span-2">
                                    <dt className="text-xs text-neutral-500">
                                        {t('checkout.destination')}
                                    </dt>
                                    <dd className="mt-1 leading-5 break-words text-neutral-900">
                                        {destination?.label}
                                    </dd>
                                </div>
                            )}
                            {requiresShipping && (
                                <div className="min-w-0 border-b border-neutral-200 p-3 sm:border-r sm:border-b-0">
                                    <dt className="text-xs text-neutral-500">
                                        {t('checkout.courier')}
                                    </dt>
                                    <dd className="mt-1 font-medium break-words text-neutral-900">
                                        {selectedRate?.name}{' '}
                                        {selectedRate?.service}
                                    </dd>
                                </div>
                            )}
                            <div className="min-w-0 p-3">
                                <dt className="text-xs text-neutral-500">
                                    {t('checkout.payment')}
                                </dt>
                                <dd className="mt-1 font-medium break-words text-neutral-900">
                                    {selectedPaymentMethod?.name}
                                </dd>
                            </div>
                        </dl>
                        {isDirectCod && (
                            <p className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                                {t('checkout.codDirectInstructions')}
                            </p>
                        )}
                        {cart.map((line) => (
                            <div
                                key={line.variant.id}
                                className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-4 text-sm last:border-0 last:pb-0"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <img
                                        src={
                                            line.product.images[0] ??
                                            '/storage/products/placeholder.svg'
                                        }
                                        alt=""
                                        className="h-20 w-16 shrink-0 rounded-sm bg-neutral-100 object-cover"
                                    />
                                    <div className="min-w-0">
                                        <p className="line-clamp-2 font-medium">
                                            {line.product.name}
                                        </p>
                                        <p className="text-xs text-neutral-600">
                                            {t('cart.size')} {line.variant.size}{' '}
                                            · {t('cart.quantity')}{' '}
                                            {line.quantity}
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
                    <div className="shrink-0 space-y-2 border-t border-neutral-200 pt-4 text-sm">
                        <p className="flex justify-between">
                            <span>{t('checkout.subtotal')}</span>
                            <span>{money(subtotal)}</span>
                        </p>
                        <p className="flex justify-between">
                            <span>
                                {isDirectCod
                                    ? t('checkout.noShipping')
                                    : t('checkout.shipping')}
                            </span>
                            <span>{money(shipping)}</span>
                        </p>
                        <p className="flex justify-between border-t pt-2 font-semibold">
                            <span>{t('checkout.total')}</span>
                            <span>{money(subtotal + shipping)}</span>
                        </p>
                    </div>
                    <DialogFooter className="shrink-0 border-t border-neutral-200 pt-4">
                        <button
                            type="button"
                            disabled={orderSubmitting}
                            onClick={() => setOrderConfirmOpen(false)}
                            className="w-full border border-neutral-300 px-4 py-3 text-sm hover:bg-neutral-100 disabled:opacity-50 sm:w-auto"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            disabled={orderSubmitting}
                            onClick={confirmCheckout}
                            className="w-full bg-black px-5 py-3 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 sm:w-auto"
                        >
                            {orderSubmitting
                                ? t('checkout.processing')
                                : t('checkout.continueToPayment')}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AuthModal
                open={authOpen}
                onOpenChange={setAuthOpen}
                onAuthenticated={submitOrder}
            />
        </>
    );
}
