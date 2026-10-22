import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { AdminStatusBadge } from '@/components/admin/status-badge';
import { useTranslation } from '@/hooks/use-translation';
import adminRoutes from '@/routes/admin';

type Customer = {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    email_verified_at: string | null;
    created_at: string | null;
    orders_count: number;
    last_order_at: string | null;
};
type Page<T> = {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
    total: number;
};

function formatDate(value: string | null, language: string): string {
    if (!value) {
        return '—';
    }

    return new Date(value).toLocaleString(language === 'ID' ? 'id-ID' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

export default function UsersIndex({
    users,
    filters,
    stats,
}: {
    users: Page<Customer>;
    filters: { search?: string };
    stats: { total: number; verified: number; withOrders: number };
}) {
    const { language, t } = useTranslation();
    const [search, setSearch] = useState(filters.search ?? '');
    const summary = [
        [t('admin.totalUsers'), stats.total],
        [t('admin.verifiedUsers'), stats.verified],
        [t('admin.usersWithOrders'), stats.withOrders],
    ];

    return (
        <>
            <Head title={`${t('admin.users')} — Mellif Studio`} />
            <p className="mb-5 text-sm text-muted-foreground">
                {t('admin.userMonitoring')}
            </p>

            <div className="mb-6 grid gap-3 sm:grid-cols-3">
                {summary.map(([label, value]) => (
                    <section
                        key={label}
                        className="border border-border bg-card p-4"
                    >
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                            {value}
                        </p>
                    </section>
                ))}
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    router.get(
                        adminRoutes.users.index.url({
                            query: { search: search || undefined },
                        }),
                        {},
                        { preserveState: true },
                    );
                }}
                className="mb-5 flex min-w-0 gap-2"
            >
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('admin.userSearch')}
                    aria-label={t('admin.userSearch')}
                    className="w-full max-w-lg border border-input bg-card px-4 py-3 text-foreground"
                />
                <button className="border border-input bg-card px-5 font-medium text-foreground hover:bg-muted">
                    {t('admin.search')}
                </button>
            </form>

            <div className="overflow-x-auto border border-border bg-card">
                <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="p-4 font-semibold">{t('admin.customer')}</th>
                            <th className="p-4 font-semibold">{t('admin.userPhone')}</th>
                            <th className="p-4 font-semibold">{t('admin.status')}</th>
                            <th className="p-4 font-semibold">{t('admin.registeredAt')}</th>
                            <th className="p-4 font-semibold">{t('admin.orderCount')}</th>
                            <th className="p-4 font-semibold">{t('admin.lastOrder')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.data.map((user) => (
                            <tr key={user.id} className="border-t border-border">
                                <td className="p-4 text-foreground">
                                    <p className="font-medium">{user.name}</p>
                                    <p className="mt-1 text-muted-foreground">{user.email}</p>
                                </td>
                                <td className="p-4 text-foreground">
                                    {user.phone || '—'}
                                </td>
                                <td className="p-4">
                                    <AdminStatusBadge
                                        tone={user.email_verified_at ? 'success' : 'warning'}
                                    >
                                        {user.email_verified_at
                                            ? t('admin.verified')
                                            : t('admin.unverified')}
                                    </AdminStatusBadge>
                                </td>
                                <td className="p-4 text-foreground">
                                    {formatDate(user.created_at, language)}
                                </td>
                                <td className="p-4 text-foreground">
                                    {user.orders_count}
                                </td>
                                <td className="p-4 text-foreground">
                                    {formatDate(user.last_order_at, language)}
                                </td>
                            </tr>
                        ))}
                        {users.data.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="p-8 text-center text-muted-foreground"
                                >
                                    {t('admin.noUsers')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
                {users.links.map((link, index) => (
                    <Link
                        key={`${link.label}-${index}`}
                        href={link.url ?? '#'}
                        preserveState
                        className={`border border-input px-3 py-2 text-sm ${link.active ? 'bg-primary font-semibold text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'} ${!link.url ? 'pointer-events-none text-muted-foreground' : ''}`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ))}
            </div>
        </>
    );
}
