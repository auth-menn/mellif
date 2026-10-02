import { Link, usePage } from '@inertiajs/react';
import { Home, LayoutDashboard, Package, Tags, ShoppingCart, Truck, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import adminRoutes from '@/routes/admin';
import { useTranslation } from '@/hooks/use-translation';

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { url } = usePage();
    const { t } = useTranslation();
    const links = [
        { label: t('admin.dashboard'), href: adminRoutes.dashboard.url(), icon: LayoutDashboard },
        { label: t('admin.products'), href: adminRoutes.products.index.url(), icon: Package },
        { label: t('admin.categories'), href: adminRoutes.categories.index.url(), icon: Tags },
        { label: t('admin.orders'), href: adminRoutes.orders.index.url(), icon: ShoppingCart },
        { label: t('admin.shipping'), href: adminRoutes.shipping.index.url(), icon: Truck },
        { label: t('admin.homeSettings'), href: adminRoutes.homeSettings.edit.url(), icon: Settings },
    ];

    return <div className="admin-theme min-h-screen bg-background text-foreground pt-[72px] md:grid md:grid-cols-[240px_1fr]"><header className="fixed inset-x-0 top-0 z-40 flex h-[72px] items-center justify-between bg-black px-5 text-white"><Link href={adminRoutes.dashboard.url()} className="font-black tracking-[.2em]">MELLIF <span className="text-xs font-normal tracking-normal">{t('admin.label')}</span></Link><Link href="/" className="flex items-center gap-2 text-xs"><Home size={15} /> {t('nav.viewStore')}</Link></header><aside className="hidden border-r border-neutral-300 bg-white p-5 md:block"><nav className="space-y-1">{links.map(({ label, href, icon: Icon }) => {
        const isActive = url.startsWith(href.split('?')[0]);

        return <Link key={label} href={href} aria-current={isActive ? 'page' : undefined} className={`flex items-center gap-3 border-l-2 px-3 py-3 text-sm transition-colors ${isActive ? 'border-blue-700 bg-blue-50 font-semibold text-blue-900' : 'border-transparent text-neutral-800 hover:bg-neutral-100'}`}><Icon size={17} />{label}</Link>;
    })}</nav></aside><main className="min-w-0 p-5 md:p-9">{children}</main></div>;
}
