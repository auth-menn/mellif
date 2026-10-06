import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import adminRoutes from '@/routes/admin';
import { useTranslation } from '@/hooks/use-translation';
import { AdminStatusBadge } from '@/components/admin/status-badge';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';

type Courier = {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
};

function courierCodePreview(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export default function ShippingIndex({
    couriers,
    editing,
}: {
    couriers: { data: Courier[] };
    editing: Courier | null;
}) {
    const { t } = useTranslation();
    const [pendingDelete, setPendingDelete] = useState<Courier | null>(null);
    const [confirmSave, setConfirmSave] = useState(false);
    const [processing, setProcessing] = useState(false);
    const form = useForm({
        name: editing?.name ?? '',
        is_active: editing?.is_active ?? true,
    });

    const save = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        setConfirmSave(true);
    };

    const confirmSaveAction = (): void => {
        setProcessing(true);
        const options = {
            onFinish: () => {
                setProcessing(false);
                setConfirmSave(false);
            },
        };
        if (editing)
            form.put(
                adminRoutes.shipping.update.url({ shipping: editing.id }),
                options,
            );
        else form.post(adminRoutes.shipping.store.url(), options);
    };

    const confirmDeleteAction = (): void => {
        if (!pendingDelete) return;
        setProcessing(true);
        router.delete(
            adminRoutes.shipping.destroy.url({ shipping: pendingDelete.id }),
            {
                onFinish: () => {
                    setProcessing(false);
                    setPendingDelete(null);
                },
            },
        );
    };

    return (
        <>
            <Head title={`${t('admin.shipping')} — CMS Mellif Studio`} />
            <div className="mb-6 flex justify-end">
                <Link
                    href={adminRoutes.shipping.index.url()}
                    className="text-sm font-medium text-primary underline"
                >
                    {t('admin.newCourier')}
                </Link>
            </div>
            <div className="space-y-6">
                <section className="overflow-x-auto border border-border bg-card">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="p-4">{t('admin.name')}</th>
                                <th className="p-4">{t('admin.code')}</th>
                                <th className="p-4">{t('admin.status')}</th>
                                <th className="p-4">{t('admin.action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {couriers.data.map((courier) => (
                                <tr
                                    key={courier.id}
                                    className="border-t border-border"
                                >
                                    <td className="p-4 text-foreground">
                                        {courier.name}
                                    </td>
                                    <td className="p-4 text-foreground">
                                        {courier.code}
                                    </td>
                                    <td className="p-4">
                                        <AdminStatusBadge
                                            tone={
                                                courier.is_active
                                                    ? 'success'
                                                    : 'neutral'
                                            }
                                        >
                                            {courier.is_active
                                                ? t('admin.active')
                                                : t('admin.inactive')}
                                        </AdminStatusBadge>
                                    </td>
                                    <td className="p-4">
                                        <Link
                                            href={adminRoutes.shipping.index.url(
                                                { query: { edit: courier.id } },
                                            )}
                                            className="mr-3 font-medium text-primary underline"
                                        >
                                            {t('admin.edit')}
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPendingDelete(courier)
                                            }
                                            className="font-medium text-destructive underline"
                                        >
                                            {t('admin.delete')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {couriers.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="p-6 text-center text-muted-foreground"
                                    >
                                        {t('admin.noCourier')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </section>
                <form
                    onSubmit={save}
                    className="w-full space-y-4 border border-border bg-card p-5 text-foreground"
                >
                    <h2 className="font-medium">
                        {editing
                            ? t('admin.editCourier')
                            : t('admin.newCourier')}
                    </h2>
                    <label className="block text-sm">
                        {t('admin.name')}
                        <input
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            className="mt-2 w-full border border-input bg-card p-3 text-foreground"
                        />
                        <span className="mt-2 block text-xs text-muted-foreground">
                            {t('admin.code')}: <code>{courierCodePreview(form.data.name) || '—'}</code>
                        </span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.data.is_active}
                            onChange={(event) =>
                                form.setData('is_active', event.target.checked)
                            }
                        />
                        {t('admin.activeToggle')}
                    </label>
                    <button
                        disabled={form.processing}
                        className="bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                        {t('admin.save')}
                    </button>
                </form>
            </div>
            <ConfirmDialog
                open={confirmSave}
                onOpenChange={setConfirmSave}
                onConfirm={confirmSaveAction}
                processing={processing}
                title={t('admin.confirmTitle')}
                description={
                    editing
                        ? t('admin.confirmUpdate')
                        : t('admin.confirmCreate')
                }
                confirmLabel={t('admin.confirm')}
                cancelLabel={t('common.cancel')}
            />
            <ConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open && !processing) setPendingDelete(null);
                }}
                onConfirm={confirmDeleteAction}
                processing={processing}
                destructive
                title={t('admin.confirmTitle')}
                description={t('admin.confirmDelete')}
                confirmLabel={t('admin.delete')}
                cancelLabel={t('common.cancel')}
            />
        </>
    );
}
