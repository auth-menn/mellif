import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    Clock3,
    Package,
    ShoppingBag,
    TrendingUp,
    Users,
} from 'lucide-react';
import { AdminStatusBadge, orderStatusTone } from '@/components/admin/status-badge';
import { useTranslation, type TranslationKey } from '@/hooks/use-translation';
import adminRoutes from '@/routes/admin';
import { money } from '@/types/store';

type Order = {
    id: number;
    order_number: string;
    total: number;
    status: string;
    created_at: string;
    user: { name: string } | null;
};

type ManualReviewOrder = {
    id: number;
    order_number: string;
    total: number;
    created_at: string;
    customer: string | null;
    reason: 'paid_after_cancellation' | 'insufficient_stock';
};

type RevenuePoint = {
    date: string;
    label: string;
    revenue: number;
    orders: number;
};

type RevenuePeriod = 'daily' | 'monthly' | 'yearly';

const revenuePeriodKeys: Record<RevenuePeriod, TranslationKey> = {
    daily: 'admin.periodDaily',
    monthly: 'admin.periodMonthly',
    yearly: 'admin.periodYearly',
};

const statusKeys: Record<string, TranslationKey> = {
    pending_payment: 'admin.waitingPayment',
    paid: 'admin.paid',
    processing: 'admin.processing',
    rejected: 'admin.rejected',
    cancelled: 'admin.cancelled',
};

const activityStatuses = [
    { key: 'pending_payment', color: 'bg-amber-500' },
    { key: 'paid', color: 'bg-emerald-600' },
    { key: 'processing', color: 'bg-blue-600' },
    { key: 'rejected', color: 'bg-red-600' },
    { key: 'cancelled', color: 'bg-neutral-500' },
] as const;

export default function AdminDashboard({
    stats,
    period,
    revenueTrend,
    ordersByStatus,
    recentOrders,
    manualReviewOrders,
}: {
    stats: {
        orders_today: number;
        pending_orders: number;
        products: number;
        low_stock: number;
        customers: number;
        revenue_today: number;
        revenue_month: number;
    };
    period: RevenuePeriod;
    revenueTrend: RevenuePoint[];
    ordersByStatus: Record<string, number>;
    recentOrders: Order[];
    manualReviewOrders: ManualReviewOrder[];
}) {
    const { language, t } = useTranslation();
    const locale = language === 'ID' ? 'id-ID' : 'en-US';
    const maxRevenue = Math.max(...revenueTrend.map((point) => point.revenue), 1);
    const totalOrders = Object.values(ordersByStatus).reduce(
        (sum, count) => sum + Number(count),
        0,
    );
    const cards = [
        {
            label: t('admin.revenueToday'),
            value: money(stats.revenue_today),
            icon: TrendingUp,
            accent: 'text-emerald-700 bg-emerald-50',
        },
        {
            label: t('admin.revenueMonth'),
            value: money(stats.revenue_month),
            icon: ShoppingBag,
            accent: 'text-blue-700 bg-blue-50',
        },
        {
            label: t('admin.ordersToday'),
            value: stats.orders_today,
            icon: Clock3,
            accent: 'text-violet-700 bg-violet-50',
        },
        {
            label: t('admin.pendingOrders'),
            value: stats.pending_orders,
            icon: ShoppingBag,
            accent: 'text-amber-800 bg-amber-50',
        },
        {
            label: t('admin.totalProducts'),
            value: stats.products,
            icon: Package,
            accent: 'text-neutral-800 bg-neutral-100',
        },
        {
            label: t('admin.totalCustomers'),
            value: stats.customers,
            icon: Users,
            accent: 'text-cyan-800 bg-cyan-50',
        },
    ] as const;

    return (
        <>
            <Head title={`${t('admin.dashboard')} — Mellif Studio`} />
            <div className="space-y-6 lg:space-y-8">
                <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">
                            {new Intl.DateTimeFormat(locale, {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                            }).format(new Date())}
                        </p>
                        <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {t('admin.dashboard')}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {t('admin.dashboardIntro')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={adminRoutes.orders.index.url()}
                            className="inline-flex min-h-10 items-center justify-center gap-2 border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                            {t('admin.viewOrders')}
                            <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <Link
                            href={adminRoutes.products.index.url()}
                            className="inline-flex min-h-10 items-center justify-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                        >
                            {t('admin.viewProducts')}
                            <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                    </div>
                </section>

                <section aria-label={t('admin.summary')} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    {cards.map(({ label, value, icon: Icon, accent }) => (
                        <article
                            key={label}
                            className="min-w-0 border border-border bg-card p-4 shadow-sm sm:p-5"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-medium leading-5 text-muted-foreground sm:text-sm">
                                    {label}
                                </p>
                                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
                                    <Icon size={18} aria-hidden="true" />
                                </span>
                            </div>
                            <p className="mt-4 truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                                {value}
                            </p>
                        </article>
                    ))}
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
                    <article className="min-w-0 border border-border bg-card shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                            <div>
                                <h3 className="font-semibold text-foreground">{t('admin.revenueTrend')}</h3>
                                <p className="mt-1 text-xs text-muted-foreground">{t('admin.revenueDefinition')}</p>
                            </div>
                            <div
                                className="flex max-w-full flex-wrap gap-1 rounded-lg border border-border bg-muted/50 p-1"
                                role="group"
                                aria-label={t('admin.revenuePeriod')}
                            >
                                {(Object.keys(revenuePeriodKeys) as RevenuePeriod[]).map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        aria-pressed={period === option}
                                        onClick={() => router.get(
                                            adminRoutes.dashboard.url({ query: { period: option } }),
                                            {},
                                            { preserveScroll: true, preserveState: true, only: ['period', 'revenueTrend'] },
                                        )}
                                        className={`min-h-9 rounded-md px-2.5 text-xs font-semibold transition-colors sm:px-3 ${period === option ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        {t(revenuePeriodKeys[option])}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {revenueTrend.some((point) => point.revenue > 0) ? (
                            <div
                                className="grid h-64 gap-1 px-4 pb-4 pt-6 sm:gap-2 sm:px-6"
                                style={{ gridTemplateColumns: `repeat(${revenueTrend.length}, minmax(0, 1fr))` }}
                            >
                                {revenueTrend.map((point, index) => {
                                    const label = period === 'daily'
                                        ? `${point.label}:00`
                                        : period === 'monthly'
                                          ? point.label
                                          : new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
                                                new Date(Date.UTC(Number(point.date.slice(0, 4)), Number(point.label) - 1, 15)),
                                            );
                                    const showLabel = period === 'yearly'
                                        || (period === 'daily' && index % 4 === 0)
                                        || (period === 'monthly' && (index % 5 === 0 || index === revenueTrend.length - 1));
                                    const barHeight = Math.max(
                                        (point.revenue / maxRevenue) * 100,
                                        point.revenue > 0 ? 8 : 0,
                                    );

                                    return (
                                        <div
                                            key={point.date}
                                            className="flex min-w-0 flex-col items-center justify-end gap-2"
                                            aria-label={`${label}: ${money(point.revenue)}, ${point.orders} ${t('admin.ordersCount')}`}
                                            title={`${label}: ${money(point.revenue)} | ${point.orders} ${t('admin.ordersCount')}`}
                                        >
                                            <div className="flex h-full w-full items-end justify-center rounded-t bg-muted/70">
                                                <div
                                                    className="w-full max-w-10 rounded-t bg-primary transition-[height]"
                                                    style={{ height: `${barHeight}%` }}
                                                    aria-hidden="true"
                                                />
                                            </div>
                                            <span className="min-h-3 truncate text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                                                {showLabel ? label : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                                {t('admin.noRevenue')}
                            </p>
                        )}
                    </article>

                    <article className="border border-border bg-card p-5 shadow-sm sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="font-semibold text-foreground">{t('admin.orderActivity')}</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {t('admin.orderActivityDescription')}
                                </p>
                            </div>
                            <ShoppingBag size={19} className="mt-0.5 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <div
                            className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-muted"
                            role="img"
                            aria-label={t('admin.orderActivity')}
                        >
                            {activityStatuses.map(({ key, color }) => {
                                const count = Number(ordersByStatus[key] ?? 0);

                                return count > 0 ? (
                                    <div
                                        key={key}
                                        className={color}
                                        style={{ width: `${(count / Math.max(totalOrders, 1)) * 100}%` }}
                                        title={`${t(statusKeys[key])}: ${count}`}
                                    />
                                ) : null;
                            })}
                        </div>
                        <div className="mt-5 space-y-3">
                            {activityStatuses.map(({ key, color }) => (
                                <div key={key} className="flex items-center justify-between gap-3 text-sm">
                                    <span className="flex min-w-0 items-center gap-2 text-foreground">
                                        <span className={`size-2.5 shrink-0 rounded-full ${color}`} aria-hidden="true" />
                                        <span className="truncate">{t(statusKeys[key])}</span>
                                    </span>
                                    <span className="font-semibold tabular-nums text-foreground">
                                        {Number(ordersByStatus[key] ?? 0)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                            <span className="text-muted-foreground">{t('admin.totalOrders')}</span>
                            <span className="font-bold text-foreground">{totalOrders}</span>
                        </div>
                    </article>
                </section>

                {stats.low_stock > 0 && (
                    <Link
                        href={adminRoutes.products.index.url()}
                        className="flex items-center gap-3 border border-amber-300 bg-amber-50 p-4 text-amber-950 transition-colors hover:bg-amber-100"
                    >
                        <AlertTriangle size={20} className="shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 text-sm font-medium">
                            {t('admin.lowStock')}: {stats.low_stock}
                        </span>
                        <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                )}

                {manualReviewOrders.length > 0 && (
                    <section className="overflow-hidden border border-amber-300 bg-card shadow-sm">
                        <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 p-5">
                            <AlertTriangle className="mt-0.5 shrink-0 text-amber-800" size={19} aria-hidden="true" />
                            <div>
                                <h3 className="font-semibold text-amber-950">{t('admin.manualReviewOrders')}</h3>
                                <p className="mt-1 text-sm text-amber-900">{t('admin.manualReviewReason')}</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted text-muted-foreground">
                                    <tr>
                                        <th className="p-4 font-semibold">{t('admin.orderNumber')}</th>
                                        <th className="p-4 font-semibold">{t('admin.customer')}</th>
                                        <th className="p-4 font-semibold">{t('checkout.total')}</th>
                                        <th className="p-4 font-semibold">{t('admin.status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {manualReviewOrders.map((order) => (
                                        <tr key={order.id} className="border-t border-border">
                                            <td className="p-4 font-medium text-foreground">{order.order_number}</td>
                                            <td className="p-4 text-foreground">{order.customer ?? '—'}</td>
                                            <td className="p-4 text-foreground">{money(order.total)}</td>
                                            <td className="p-4">
                                                <AdminStatusBadge tone="warning">
                                                    {t(order.reason === 'paid_after_cancellation' ? 'admin.manualReviewCancelled' : 'admin.manualReviewStock')}
                                                </AdminStatusBadge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                <section className="overflow-hidden border border-border bg-card shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:px-6">
                        <div>
                            <h3 className="font-semibold text-foreground">{t('admin.recentOrders')}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{t('admin.latestOrderActivity')}</p>
                        </div>
                        <Link
                            href={adminRoutes.orders.index.url()}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-foreground underline underline-offset-4 hover:text-muted-foreground"
                        >
                            {t('admin.viewOrders')}
                            <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted text-muted-foreground">
                                <tr>
                                    <th className="p-4 font-semibold">{t('admin.orderNumber')}</th>
                                    <th className="p-4 font-semibold">{t('admin.customer')}</th>
                                    <th className="p-4 font-semibold">{t('admin.date')}</th>
                                    <th className="p-4 font-semibold">{t('checkout.total')}</th>
                                    <th className="p-4 font-semibold">{t('admin.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((order) => (
                                    <tr key={order.id} className="border-t border-border transition-colors hover:bg-muted/40">
                                        <td className="whitespace-nowrap p-4 font-semibold text-foreground">{order.order_number}</td>
                                        <td className="p-4 text-foreground">{order.user?.name ?? '—'}</td>
                                        <td className="whitespace-nowrap p-4 text-muted-foreground">
                                            {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(order.created_at))}
                                        </td>
                                        <td className="whitespace-nowrap p-4 font-medium text-foreground">{money(order.total)}</td>
                                        <td className="p-4">
                                            <AdminStatusBadge tone={orderStatusTone(order.status)}>
                                                {t(statusKeys[order.status] ?? 'admin.status')}
                                            </AdminStatusBadge>
                                        </td>
                                    </tr>
                                ))}
                                {recentOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                            {t('admin.noOrders')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </>
    );
}
