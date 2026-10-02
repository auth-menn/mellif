import { Head } from '@inertiajs/react';
import { money } from '@/types/store';
import { useTranslation, type TranslationKey } from '@/hooks/use-translation';
import { AdminStatusBadge, orderStatusTone } from '@/components/admin/status-badge';

type Order = { id: number; order_number: string; total: number; status: string; created_at: string; user: { name: string } | null };

const statusKeys: Record<string, TranslationKey> = {
    pending_payment: 'admin.waitingPayment',
    paid: 'admin.paid',
    processing: 'admin.processing',
    rejected: 'admin.rejected',
    cancelled: 'admin.cancelled',
};

export default function AdminDashboard({ stats, recentOrders }: { stats: { orders_today: number; pending_orders: number; products: number; low_stock: number }; recentOrders: Order[] }) {
    const { t } = useTranslation();
    const cards = [[t('admin.ordersToday'), stats.orders_today], [t('admin.pendingOrders'), stats.pending_orders], [t('admin.totalProducts'), stats.products], [t('admin.lowStock'), stats.low_stock]] as const;

    return <><Head title={`${t('admin.dashboard')} — Mellif`} /><p className="text-xs uppercase tracking-[.2em] text-neutral-600">{t('admin.summary')}</p><h1 className="mt-2 text-3xl font-semibold text-neutral-950">{t('admin.dashboard')}</h1><div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value]) => <article key={label} className="border border-neutral-300 bg-white p-5"><p className="text-sm text-neutral-600">{label}</p><p className="mt-3 text-3xl font-semibold text-neutral-950">{value}</p></article>)}</div><section className="mt-8 overflow-hidden border border-neutral-300 bg-white"><div className="border-b border-neutral-300 p-5"><h2 className="font-semibold text-neutral-950">{t('admin.recentOrders')}</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-neutral-100 text-neutral-700"><tr><th className="p-4 font-semibold">{t('admin.orderNumber')}</th><th className="p-4 font-semibold">{t('admin.customer')}</th><th className="p-4 font-semibold">{t('checkout.total')}</th><th className="p-4 font-semibold">{t('admin.status')}</th></tr></thead><tbody>{recentOrders.map((order) => <tr key={order.id} className="border-t border-neutral-200"><td className="p-4 font-medium text-neutral-950">{order.order_number}</td><td className="p-4 text-neutral-900">{order.user?.name ?? '—'}</td><td className="p-4 text-neutral-900">{money(order.total)}</td><td className="p-4"><AdminStatusBadge tone={orderStatusTone(order.status)}>{t(statusKeys[order.status] ?? 'admin.status')}</AdminStatusBadge></td></tr>)}{recentOrders.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-neutral-700">{t('admin.noOrders')}</td></tr>}</tbody></table></div></section></>;
}
