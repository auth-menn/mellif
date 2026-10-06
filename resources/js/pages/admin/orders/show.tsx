import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import adminRoutes from '@/routes/admin';
import { useTranslation, type TranslationKey } from '@/hooks/use-translation';
import { money } from '@/types/store';
import {
    AdminStatusBadge,
    orderStatusTone,
} from '@/components/admin/status-badge';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';

type Order = {
    id: number;
    order_number: string;
    status: string;
    recipient_name: string;
    phone: string;
    address: string;
    address_detail: string | null;
    shipping_courier: string;
    shipping_cost: number;
    payment_method: string;
    subtotal: number;
    total: number;
    notes: string | null;
    items: {
        id: number;
        product_name: string;
        size: string;
        qty: number;
        unit_price: number;
    }[];
    user: { name: string; email: string } | null;
};
const statusKeys: Record<string, TranslationKey> = {
    pending_payment: 'admin.waitingPayment',
    paid: 'admin.paid',
    processing: 'admin.processing',
    rejected: 'admin.rejected',
    cancelled: 'admin.cancelled',
};

export default function OrderShow({ order }: { order: Order }) {
    const { t } = useTranslation();
    const form = useForm({ status: 'processing', notes: order.notes ?? '' });
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const canUpdate = !['rejected', 'cancelled'].includes(order.status);
    const saveOrder = (): void => {
        setProcessing(true);
        form.patch(adminRoutes.orders.update.url({ order: order.id }), {
            onFinish: () => {
                setProcessing(false);
                setConfirmOpen(false);
            },
        });
    };
    return (
        <>
            <Head
                title={`${t('admin.detailPageTitle')} ${order.order_number} — CMS Mellif Studio`}
            />
            <div className="space-y-6">
                <section className="space-y-6">
                    <article className="border border-border bg-card p-5">
                        <h2 className="font-semibold text-foreground">
                            {t('admin.recipientData')}
                        </h2>
                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-muted-foreground">
                                    {t('admin.recipient')}
                                </dt>
                                <dd className="text-foreground">
                                    {order.recipient_name}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    {t('admin.phone')}
                                </dt>
                                <dd className="text-foreground">
                                    {order.phone}
                                </dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-muted-foreground">
                                    {t('admin.address')}
                                </dt>
                                <dd className="text-foreground">
                                    {order.address} {order.address_detail}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    {t('admin.account')}
                                </dt>
                                <dd className="text-foreground">
                                    {order.user?.name} · {order.user?.email}
                                </dd>
                            </div>
                        </dl>
                    </article>
                    <article className="overflow-x-auto border border-border bg-card">
                        <h2 className="p-5 font-semibold text-foreground">
                            {t('admin.orderItems')}
                        </h2>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted text-muted-foreground">
                                <tr>
                                    <th className="p-4">
                                        {t('admin.products')}
                                    </th>
                                    <th className="p-4">
                                        {t('admin.sizeLabel')}
                                    </th>
                                    <th className="p-4">{t('admin.qty')}</th>
                                    <th className="p-4">{t('admin.price')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-t border-border"
                                    >
                                        <td className="p-4 text-foreground">
                                            {item.product_name}
                                        </td>
                                        <td className="p-4 text-foreground">
                                            {item.size}
                                        </td>
                                        <td className="p-4 text-foreground">
                                            {item.qty}
                                        </td>
                                        <td className="p-4 text-foreground">
                                            {money(item.unit_price)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </article>
                </section>
                <aside className="h-fit space-y-4 border border-border bg-card p-5">
                    <p className="flex items-center justify-between gap-3 text-foreground">
                        {t('admin.status')}
                        <AdminStatusBadge tone={orderStatusTone(order.status)}>
                            {t(statusKeys[order.status] ?? 'admin.status')}
                        </AdminStatusBadge>
                    </p>
                    <p className="flex justify-between text-sm text-foreground">
                        <span>{t('admin.subtotal')}</span>
                        <span>{money(order.subtotal)}</span>
                    </p>
                    <p className="flex justify-between text-sm text-foreground">
                        <span>
                            {order.shipping_courier} · {t('admin.shippingCost')}
                        </span>
                        <span>{money(order.shipping_cost)}</span>
                    </p>
                    <p className="flex justify-between border-t border-border pt-3 font-semibold text-foreground">
                        <span>{t('admin.total')}</span>
                        <span>{money(order.total)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {t('admin.payment')}: {order.payment_method}
                    </p>
                    {canUpdate && (
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                setConfirmOpen(true);
                            }}
                            className="space-y-3 border-t border-border pt-4"
                        >
                            <label className="block text-sm text-foreground">
                                {t('admin.updateStatus')}
                                <select
                                    value={form.data.status}
                                    onChange={(event) =>
                                        form.setData(
                                            'status',
                                            event.target.value,
                                        )
                                    }
                                    className="mt-2 w-full border border-input bg-card p-2 text-foreground"
                                >
                                    {(
                                        [
                                            'processing',
                                            'rejected',
                                            'cancelled',
                                        ] as const
                                    ).map((value) => (
                                        <option key={value} value={value}>
                                            {t(statusKeys[value])}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block text-sm text-foreground">
                                {t('admin.notes')}
                                <textarea
                                    value={form.data.notes}
                                    onChange={(event) =>
                                        form.setData(
                                            'notes',
                                            event.target.value,
                                        )
                                    }
                                    className="mt-2 w-full border border-input bg-card p-2 text-foreground"
                                />
                            </label>
                            <button className="w-full bg-primary py-3 text-sm font-semibold text-primary-foreground">
                                {t('admin.saveStatus')}
                            </button>
                        </form>
                    )}
                    {!canUpdate && (
                        <p className="text-xs text-muted-foreground">
                            {t('admin.terminalOrder')}
                        </p>
                    )}
                </aside>
            </div>
            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                onConfirm={saveOrder}
                processing={processing}
                title={t('admin.confirmTitle')}
                description={t('admin.confirmUpdate')}
                confirmLabel={t('admin.confirm')}
                cancelLabel={t('common.cancel')}
            />
        </>
    );
}
