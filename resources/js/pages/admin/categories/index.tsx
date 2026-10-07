import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import adminRoutes from '@/routes/admin';
import { useTranslation } from '@/hooks/use-translation';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';

type Category = {
    id: number;
    name: string;
    slug: string;
    sort_order: number;
    products_count: number;
};
type PendingCategory = Category | null;

function slugPreview(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export default function CategoriesIndex({
    categories,
    editing,
}: {
    categories: { data: Category[] };
    editing: Category | null;
}) {
    const { t } = useTranslation();
    const [pendingDelete, setPendingDelete] = useState<PendingCategory>(null);
    const [confirmSave, setConfirmSave] = useState(false);
    const [processing, setProcessing] = useState(false);
    const form = useForm({
        name: editing?.name ?? '',
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
                adminRoutes.categories.update.url({ category: editing.id }),
                options,
            );
        else form.post(adminRoutes.categories.store.url(), options);
    };

    const confirmDeleteAction = (): void => {
        if (!pendingDelete) return;
        setProcessing(true);
        router.delete(
            adminRoutes.categories.destroy.url({ category: pendingDelete.id }),
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
            <Head title={`${t('admin.categories')} — CMS Mellif Studio`} />
            <div className="mb-6 flex justify-end">
                <Link
                    href={adminRoutes.categories.index.url()}
                    className="text-sm text-primary underline"
                >
                    {t('admin.newCategory')}
                </Link>
            </div>
            <div className="space-y-6">
                <section className="overflow-x-auto border border-border bg-card">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="p-4">{t('admin.name')}</th>
                                <th className="p-4">{t('admin.slug')}</th>
                                <th className="p-4">
                                    {t('admin.productCount')}
                                </th>
                                <th className="p-4">{t('admin.action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.data.map((category) => (
                                <tr
                                    key={category.id}
                                    className="border-t border-border"
                                >
                                    <td className="p-4 text-foreground">
                                        {category.name}
                                    </td>
                                    <td className="p-4 text-foreground">
                                        {category.slug}
                                    </td>
                                    <td className="p-4 text-foreground">
                                        {category.products_count}
                                    </td>
                                    <td className="p-4">
                                        <Link
                                            href={adminRoutes.categories.index.url(
                                                {
                                                    query: {
                                                        edit: category.id,
                                                    },
                                                },
                                            )}
                                            className="mr-3 font-medium text-primary underline"
                                        >
                                            {t('admin.edit')}
                                        </Link>
                                        <button
                                            type="button"
                                            className="text-destructive underline"
                                            onClick={() =>
                                                setPendingDelete(category)
                                            }
                                        >
                                            {t('admin.delete')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {categories.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="p-6 text-center text-muted-foreground"
                                    >
                                        {t('admin.noCategories')}
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
                        {editing ? t('admin.edit') : t('admin.newCategory')}
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
                            {t('admin.slug')}: <code>{slugPreview(form.data.name) || '—'}</code>
                        </span>
                    </label>
                    <button
                        disabled={form.processing}
                        className="bg-primary px-5 py-3 text-sm text-primary-foreground disabled:opacity-50"
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
