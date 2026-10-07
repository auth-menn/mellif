import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import adminRoutes from '@/routes/admin';
import { money } from '@/types/store';
import { useTranslation } from '@/hooks/use-translation';
import { AdminStatusBadge } from '@/components/admin/status-badge';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';

type Page<T> = {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
    total: number;
};
type AdminProduct = {
    id: number;
    name: string;
    category: { name: string } | null;
    images: { id: number; path: string; sort_order: number }[];
    discounted_price: number;
    discount_percent: number | null;
    is_active: boolean;
    is_featured: boolean;
    stock: number;
};
type PendingAction = {
    type: 'status' | 'delete';
    product: AdminProduct;
} | null;

export default function ProductsIndex({
    products,
    filters,
}: {
    products: Page<AdminProduct>;
    filters: { search?: string };
}) {
    const { t } = useTranslation();
    const [search, setSearch] = useState(filters.search ?? '');
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [processing, setProcessing] = useState(false);

    const confirmAction = (): void => {
        if (!pendingAction) return;
        setProcessing(true);
        const finish = (): void => {
            setProcessing(false);
            setPendingAction(null);
        };

        if (pendingAction.type === 'status') {
            router.patch(
                adminRoutes.products.status.url({
                    product: pendingAction.product.id,
                }),
                { is_active: !pendingAction.product.is_active },
                { onFinish: finish },
            );
            return;
        }

        router.delete(
            adminRoutes.products.destroy.url({
                product: pendingAction.product.id,
            }),
            { onFinish: finish },
        );
    };

    return (
        <>
            <Head title={`${t('admin.products')} — Mellif Studio`} />
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        router.get(
                            adminRoutes.products.index.url({ query: { search } }),
                            {},
                            { preserveState: true },
                        );
                    }}
                    className="flex min-w-0 flex-1 gap-2"
                >
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('admin.productSearch')}
                        className="w-full max-w-sm border border-input bg-card px-4 py-3 text-foreground"
                    />
                    <button className="border border-input bg-card px-5 font-medium text-foreground hover:bg-muted">
                        {t('admin.search')}
                    </button>
                </form>
                <Link
                    href={adminRoutes.products.create.url()}
                    className="bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                >
                    {t('admin.addProduct')}
                </Link>
            </div>
            <div className="overflow-x-auto border border-border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="p-4">{t('admin.products')}</th>
                            <th className="p-4">{t('admin.category')}</th>
                            <th className="p-4">{t('admin.price')}</th>
                            <th className="p-4">{t('admin.stock')}</th>
                            <th className="p-4">{t('admin.status')}</th>
                            <th className="p-4">{t('admin.action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.data.map((product) => (
                            <tr
                                key={product.id}
                                className="border-t border-border"
                            >
                                <td className="p-4 font-medium text-foreground">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={
                                                product.images[0]?.path
                                                    ? `/storage/${product.images[0].path}`
                                                    : '/storage/products/placeholder.svg'
                                            }
                                            alt=""
                                            className="h-14 w-12 object-cover"
                                        />
                                        <span>{product.name}</span>
                                        {product.is_featured && (
                                            <AdminStatusBadge tone="info">
                                                {t('admin.featured')}
                                            </AdminStatusBadge>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-foreground">
                                    {product.category?.name ?? '—'}
                                </td>
                                <td className="p-4 text-foreground">
                                    {money(product.discounted_price)}
                                    {product.discount_percent ? (
                                        <span className="ml-2 text-xs font-medium text-destructive">
                                            −{product.discount_percent}%
                                        </span>
                                    ) : null}
                                </td>
                                <td className="p-4 text-foreground">
                                    {product.stock}
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={product.is_active}
                                            aria-label={
                                                product.is_active
                                                    ? t(
                                                          'admin.deactivateProduct',
                                                      )
                                                    : t('admin.activateProduct')
                                            }
                                            onClick={() =>
                                                setPendingAction({
                                                    type: 'status',
                                                    product,
                                                })
                                            }
                                            className="inline-flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                        >
                                            <span
                                                className={`relative block h-6 w-11 shrink-0 rounded-full transition-colors ${product.is_active ? 'bg-emerald-700' : 'bg-neutral-400'}`}
                                            >
                                                <span
                                                    className={`absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform ${product.is_active ? 'translate-x-5' : 'translate-x-0'}`}
                                                />
                                            </span>
                                            <span className="text-xs font-semibold text-foreground">
                                                {product.is_active
                                                    ? 'ON'
                                                    : 'OFF'}
                                            </span>
                                        </button>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-wrap gap-3">
                                        <Link
                                            href={adminRoutes.products.edit.url(
                                                { product: product.id },
                                            )}
                                            className="font-medium text-primary underline underline-offset-2"
                                        >
                                            {t('admin.edit')}
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPendingAction({
                                                    type: 'delete',
                                                    product,
                                                })
                                            }
                                            className="font-medium text-destructive underline underline-offset-2"
                                        >
                                            {t('admin.delete')}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {products.data.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="p-8 text-center text-muted-foreground"
                                >
                                    {t('admin.noProducts')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
                {products.links.map((link, index) => (
                    <Link
                        key={`${link.label}-${index}`}
                        href={link.url ?? '#'}
                        preserveState
                        className={`border border-input px-3 py-2 text-sm ${link.active ? 'bg-primary font-semibold text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'} ${!link.url ? 'pointer-events-none text-muted-foreground' : ''}`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ))}
            </div>
            <ConfirmDialog
                open={pendingAction !== null}
                onOpenChange={(open) => {
                    if (!open && !processing) setPendingAction(null);
                }}
                onConfirm={confirmAction}
                processing={processing}
                destructive={pendingAction?.type === 'delete'}
                title={t('admin.confirmTitle')}
                confirmLabel={
                    pendingAction?.type === 'delete'
                        ? t('admin.delete')
                        : t('admin.confirm')
                }
                cancelLabel={t('common.cancel')}
                description={
                    pendingAction?.type === 'delete'
                        ? t('admin.confirmDelete')
                        : pendingAction?.product.is_active
                          ? t('admin.confirmDeactivate')
                          : t('admin.confirmActivate')
                }
            />
        </>
    );
}
