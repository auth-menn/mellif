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
import TurnstileWidget from '@/components/store/turnstile-widget';
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

function digitsOnly(value: string): string {
    return value.replace(/\D/g, '');
}

function downloadQrisImage(imageDataUrl: string, orderNumber: string): void {
    const [metadata, encodedImage] = imageDataUrl.split(',', 2);
    const imageContent = metadata.includes(';base64')
        ? Uint8Array.from(atob(encodedImage), (character) =>
              character.charCodeAt(0),
          )
        : decodeURIComponent(encodedImage);
    const imageType = metadata.match(/^data:([^;]+)/)?.[1] ?? 'image/svg+xml';
    const imageUrl = URL.createObjectURL(
        new Blob([imageContent], { type: imageType }),
    );
    const downloadLink = document.createElement('a');

    downloadLink.href = imageUrl;
    downloadLink.download = `QRIS-${orderNumber}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
}

export default function Checkout({
    paymentMethods,
    order,
    turnstileSiteKey,
}: {
    paymentMethods: PaymentMethod[];
    order: CheckoutOrder | null;
    turnstileSiteKey: string | null;
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
        phone: digitsOnly(user?.phone ?? ''),
        address: user?.address ?? '',
        address_detail: user?.address_detail ?? '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [authOpen, setAuthOpen] = useState(false);
    const [cartMessage, setCartMessage] = useState('');
    const [orderConfirmOpen, setOrderConfirmOpen] = useState(false);
    const [orderSubmitting, setOrderSubmitting] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [turnstileAttempt, setTurnstileAttempt] = useState(0);
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
            phone: current.phone || digitsOnly(user.phone || ''),
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
                ...(turnstileSiteKey && turnstileToken
                    ? { turnstile_token: turnstileToken }
                    : {}),
                items: cart.map((line) => ({
                    variant_id: line.variant.id,
                    qty: line.quantity,
                })),
            },
            {
                preserveState: true,
                preserveScroll: true,
                onStart: () => setOrderSubmitting(true),
                onError: (responseErrors) => {
                    setErrors(responseErrors as Record<string, string>);
                    if (turnstileSiteKey) {
                        setTurnstileToken(null);
                        setTurnstileAttempt((attempt) => attempt + 1);
                        setOrderConfirmOpen(true);
                    }
                },
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
    const hasActiveCheckoutQris = Boolean(
        order &&
            keepCheckoutVisible &&
            order.hasQris &&
            paymentStatus === 'unpaid',
    );
    const handlePlaceOrder = (): void => {
        if (hasActiveCheckoutQris) {
            setQrisModalOpen(true);
            return;
        }

        setOrderConfirmOpen(true);
    };

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
                    <main className="payment-success-screen mx-auto flex h-[100svh] w-full items-center justify-center overflow-hidden px-3 pt-14 pb-3 sm:px-6 sm:pt-16">
                        <section className="payment-success-card flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_24px_80px_-40px_rgba(0,0,0,0.22)]">
                            <header className="payment-success-hero flex shrink-0 items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-3 sm:px-6 sm:py-4">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm sm:size-11">
                                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5 sm:size-6">
                                        <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold tracking-[.18em] text-emerald-800 uppercase sm:text-xs">
                                        {t('checkout.accepted')}
                                    </p>
                                    <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-950 sm:text-xl">
                                        {t('checkout.paymentSuccessTitle')}
                                    </h1>
                                    <p className="payment-success-description mt-1 text-xs leading-5 text-neutral-600 sm:text-sm">
                                        {t('checkout.paymentSuccessDescription')}
                                    </p>
                                </div>
                            </header>

                            <div className="payment-success-content grid min-h-0 gap-3 p-3 sm:gap-4 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.85fr)]">
                                <div className="payment-success-order min-w-0 space-y-3">
                                    <div className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2.5">
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-neutral-500 sm:text-xs">{t('checkout.orderNumber')}</p>
                                            <p className="mt-0.5 truncate text-sm font-semibold tracking-wide text-neutral-900 sm:text-base">{order.orderNumber}</p>
                                        </div>
                                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-900 ring-1 ring-emerald-200 sm:text-xs">
                                            <span className="size-1.5 rounded-full bg-emerald-600" />
                                            {t('checkout.qrisStatus.paid')}
                                        </span>
                                    </div>

                                    <div className="min-w-0">
                                        <h2 className="text-xs font-semibold text-neutral-900 sm:text-sm">{t('checkout.orderDetails')}</h2>
                                        <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200 px-3">
                                            {order.items.slice(0, 2).map((item, index) => (
                                                <div key={`${item.name}-${item.size}-${index}`} className="payment-success-item flex items-center justify-between gap-3 py-2">
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <div className="size-11 shrink-0 overflow-hidden rounded-md bg-neutral-100 sm:size-12">
                                                            {item.imageUrl ? (
                                                                <img src={item.imageUrl} alt={item.name} className="size-full object-cover" loading="lazy" />
                                                            ) : (
                                                                <div className="flex size-full items-center justify-center text-[9px] text-neutral-400">Mellif</div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="line-clamp-1 text-xs font-medium text-neutral-900 sm:text-sm">{item.name}</p>
                                                            <p className="mt-0.5 text-[10px] text-neutral-500 sm:text-xs">{t('cart.size')} {item.size} | {t('cart.quantity')}: {item.quantity}</p>
                                                        </div>
                                                    </div>
                                                    <p className="shrink-0 text-xs text-neutral-700 sm:text-sm">{money(item.unitPrice * item.quantity)}</p>
                                                </div>
                                            ))}
                                            {order.items.length > 2 && (
                                                <p className="py-1.5 text-[10px] text-neutral-500 sm:text-xs">{t('checkout.moreOrderItems')}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="payment-success-summary min-w-0 space-y-2.5">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-lg border border-neutral-200 px-3 py-2.5">
                                            <p className="text-[10px] text-neutral-500 sm:text-xs">{t('checkout.amountPaid')}</p>
                                            <p className="mt-0.5 text-sm font-semibold text-neutral-950 sm:text-base">{money(order.qrisFinalAmount ?? order.total)}</p>
                                            <p className="mt-0.5 text-[10px] font-medium text-neutral-500 sm:text-xs">{isCodOrder ? 'COD' : 'QRIS'}</p>
                                        </div>
                                        <div className="rounded-lg border border-neutral-200 px-3 py-2.5">
                                            <p className="text-[10px] text-neutral-500 sm:text-xs">{t('checkout.orderProgress')}</p>
                                            <p className="mt-0.5 text-xs font-semibold text-neutral-950 sm:text-sm">{t('checkout.packingStatus')}</p>
                                            <p className="payment-success-description mt-0.5 text-[10px] leading-4 text-neutral-500 sm:text-xs">{t('checkout.packing')}</p>
                                        </div>
                                    </div>

                                    <dl className="space-y-1.5 rounded-lg border border-neutral-200 px-3 py-2.5 text-xs">
                                        <div className="flex justify-between gap-3 text-neutral-600"><dt>{t('checkout.subtotal')}</dt><dd>{money(order.subtotal)}</dd></div>
                                        <div className="flex justify-between gap-3 text-neutral-600"><dt>{t('checkout.shipping')}</dt><dd>{money(order.shippingCost)}</dd></div>
                                        <div className="flex justify-between gap-3 border-t border-neutral-200 pt-1.5 font-semibold text-neutral-950"><dt>{t('checkout.total')}</dt><dd>{money(order.total)}</dd></div>
                                    </dl>

                                    <div className="rounded-lg border border-neutral-200 px-3 py-2 text-xs sm:text-sm">
                                        <p className="text-[10px] text-neutral-500 sm:text-xs">{t('checkout.deliveryMethod')}</p>
                                        <p className="mt-0.5 truncate font-medium text-neutral-900">{order.shippingCourier}{order.shippingService ? ` | ${order.shippingService}` : ''}</p>
                                        {isCodOrder && <p className="payment-success-description mt-1 text-[10px] leading-4 text-neutral-600 sm:text-xs">{t('checkout.codInstructions')}</p>}
                                    </div>
                                </div>
                            </div>

                            <footer className="shrink-0 border-t border-neutral-200 bg-neutral-50 px-3 py-2.5 sm:px-5">
                                <Link href={shopIndex.url()} className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-neutral-950 px-5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 sm:w-auto sm:text-sm">
                                    {t('checkout.continueShopping')}
                                </Link>
                            </footer>
                        </section>
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
                            </section>
                        </main>
                        <Dialog
                            open={qrisModalOpen}
                            onOpenChange={setQrisModalOpen}
                        >
                            <DialogContent
                                showCloseButton={false}
                                className="qris-payment-dialog z-[90] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md bg-white p-3 text-neutral-900 sm:p-5"
                                overlayClassName="z-[80]"
                            >
                                <DialogHeader className="qris-dialog-header">
                                    <DialogTitle>
                                        {t('checkout.qrisPayment')}
                                    </DialogTitle>
                                    <DialogDescription className="text-neutral-600">
                                        {order.orderNumber} |{' '}
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
                                <div className="qris-dialog-amount rounded-xl bg-neutral-50 px-4 py-2 text-center">
                                    <p className="text-xs font-medium tracking-wide text-neutral-500">
                                        {t('checkout.amountToPay')}
                                    </p>
                                    <p className="mt-1 text-3xl font-semibold tracking-tight">
                                        {money(
                                            order.qrisFinalAmount ??
                                                order.total,
                                        )}
                                    </p>
                                    {order.qrisExpiryTime &&
                                        paymentStatus === 'unpaid' &&
                                        !isQrisExpired && (
                                            <p className="mt-2 text-xs leading-5 text-neutral-500">
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
                                    <div className="qris-dialog-code flex flex-col items-center gap-2">
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
                                                className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 tabular-nums"
                                            >
                                                {t(
                                                    'checkout.qrisTimeRemaining',
                                                )}
                                                :{' '}
                                                {String(
                                                    Math.floor(
                                                        qrisSecondsRemaining /
                                                            3600,
                                                    ),
                                                ).padStart(2, '0')}
                                                :
                                                {String(
                                                    Math.floor(
                                                        (qrisSecondsRemaining %
                                                            3600) /
                                                            60,
                                                    ),
                                                ).padStart(2, '0')}
                                                :
                                                {String(
                                                    qrisSecondsRemaining % 60,
                                                ).padStart(2, '0')}
                                            </p>
                                        )}
                                        <p className="max-w-sm text-center text-sm leading-6 text-neutral-600">
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
                                <div className="qris-dialog-info space-y-1 rounded-lg bg-neutral-50 px-3 py-2 text-center text-xs leading-5 text-neutral-500">
                                    <p>{t('checkout.paymentStatusAuto')}</p>
                                </div>
                                <DialogFooter className="qris-dialog-footer border-t border-neutral-200 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setQrisModalOpen(false)}
                                        className="w-full border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50"
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
                                        placeholder={
                                            key === 'address'
                                                ? t(
                                                      isDirectCod
                                                          ? 'checkout.codMeetupLocationPlaceholder'
                                                          : 'checkout.addressPlaceholder',
                                                  )
                                                : t('checkout.addressDetailPlaceholder')
                                        }
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
                                        type={key === 'phone' ? 'tel' : 'text'}
                                        inputMode={key === 'phone' ? 'numeric' : undefined}
                                        pattern={key === 'phone' ? '[0-9]*' : undefined}
                                        value={form[key]}
                                        placeholder={
                                            key === 'phone'
                                                ? t('checkout.phonePlaceholder')
                                                : t('checkout.recipientPlaceholder')
                                        }
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                [key]:
                                                    key === 'phone'
                                                        ? digitsOnly(event.target.value)
                                                        : event.target.value,
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
                            onClick={handlePlaceOrder}
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
                        className="qris-payment-dialog z-[90] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md bg-white p-3 text-neutral-900 sm:p-5"
                        overlayClassName="z-[80]"
                    >
                        <DialogHeader className="qris-dialog-header">
                            <DialogTitle>
                                {t('checkout.qrisPayment')}
                            </DialogTitle>
                            <DialogDescription className="text-neutral-600">
                                {order.orderNumber} |{' '}
                                {isQrisExpired
                                    ? t('checkout.qrisStatus.expired')
                                    : paymentStatus === 'unpaid'
                                      ? t('checkout.qrisStatus.unpaid')
                                      : t('checkout.qrisStatus.failed')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="qris-dialog-amount rounded-xl bg-neutral-50 px-4 py-2 text-center">
                            <p className="text-xs font-medium tracking-wide text-neutral-500">
                                {t('checkout.amountToPay')}
                            </p>
                            <p className="mt-1 text-3xl font-semibold tracking-tight">
                                {money(order.qrisFinalAmount ?? order.total)}
                            </p>
                            {order.qrisExpiryTime &&
                                paymentStatus === 'unpaid' &&
                                !isQrisExpired && (
                                    <p className="mt-2 text-xs leading-5 text-neutral-500">
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
                            <div className="qris-dialog-code flex flex-col items-center gap-2">
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
                                        className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 tabular-nums"
                                    >
                                        {t('checkout.qrisTimeRemaining')}:{' '}
                                        {String(
                                            Math.floor(
                                                qrisSecondsRemaining / 3600,
                                            ),
                                        ).padStart(2, '0')}
                                        :
                                        {String(
                                            Math.floor(
                                                (qrisSecondsRemaining % 3600) /
                                                    60,
                                            ),
                                        ).padStart(2, '0')}
                                        :
                                        {String(
                                            qrisSecondsRemaining % 60,
                                        ).padStart(2, '0')}
                                    </p>
                                )}
                                <p className="max-w-sm text-center text-sm leading-6 text-neutral-600">
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
                        <div className="qris-dialog-info space-y-1 rounded-lg bg-neutral-50 px-3 py-2 text-center text-xs leading-5 text-neutral-500">
                            <p>{t('checkout.paymentStatusAuto')}</p>
                        </div>
                        <DialogFooter className="qris-dialog-footer grid grid-cols-2 border-t border-neutral-200 pt-2">
                            {order.hasQris &&
                                paymentStatus === 'unpaid' &&
                                !isQrisExpired &&
                                order.qrisImage && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            downloadQrisImage(
                                                order.qrisImage!,
                                                order.orderNumber,
                                            )
                                        }
                                        className="min-h-11 touch-manipulation border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
                                    >
                                        {t('checkout.downloadQris')}
                                    </button>
                                )}
                            <button
                                type="button"
                                onClick={() => setQrisModalOpen(false)}
                                className={`min-h-11 touch-manipulation border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50 ${order.hasQris && paymentStatus === 'unpaid' && !isQrisExpired && order.qrisImage ? '' : 'col-span-2'}`}
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
                    {turnstileSiteKey && (
                        <div className="shrink-0 border-t border-neutral-200 pt-3">
                            <TurnstileWidget
                                key={turnstileAttempt}
                                siteKey={turnstileSiteKey}
                                onTokenChange={setTurnstileToken}
                                instruction={t('checkout.captchaInstruction')}
                                errorMessage={t('checkout.captchaUnavailable')}
                            />
                            {errors.turnstile_token && !turnstileToken && (
                                <p className="mt-1 text-xs text-red-700" role="alert">
                                    {errors.turnstile_token}
                                </p>
                            )}
                        </div>
                    )}
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
                            disabled={
                                orderSubmitting ||
                                (Boolean(turnstileSiteKey) && !turnstileToken)
                            }
                            onClick={confirmCheckout}
                            className="w-full bg-black px-5 py-3 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 sm:w-auto"
                        >
                            {orderSubmitting
                                ? t('checkout.processing')
                                : turnstileSiteKey && !turnstileToken
                                  ? t('checkout.captchaRequired')
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
