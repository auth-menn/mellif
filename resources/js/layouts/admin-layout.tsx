import { Link, usePage } from '@inertiajs/react';
import { Home, LayoutDashboard, Package, Tags, ShoppingCart, Truck, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import adminRoutes from '@/routes/admin';
import { useTranslation } from '@/hooks/use-translation';

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { url } = usePage();
    const { t } = useTranslation();
    const currentPath = url.split('?')[0].replace(/\/+$/, '') || '/';
    const links = [
        { label: t('admin.dashboard'), href: adminRoutes.dashboard.url(), icon: LayoutDashboard },
        { label: t('admin.products'), href: adminRoutes.products.index.url(), icon: Package },
        { label: t('admin.categories'), href: adminRoutes.categories.index.url(), icon: Tags },
        { label: t('admin.orders'), href: adminRoutes.orders.index.url(), icon: ShoppingCart },
        { label: t('admin.shipping'), href: adminRoutes.shipping.index.url(), icon: Truck },
        { label: t('admin.homeSettings'), href: adminRoutes.homeSettings.edit.url(), icon: Settings },
    ];

    return <div className="admin-theme min-h-screen bg-background pt-[72px] text-foreground md:grid md:grid-cols-[240px_1fr]"><header className="fixed inset-x-0 top-0 z-40 flex h-[72px] items-center justify-between border-b border-border bg-card px-5 text-foreground"><Link href={adminRoutes.dashboard.url()} className="font-black tracking-[.2em]">MELLIF <span className="text-xs font-normal tracking-normal">{t('admin.label')}</span></Link><Link href="/" className="flex items-center gap-2 text-xs text-primary underline underline-offset-2"><Home size={15} /> {t('nav.viewStore')}</Link></header><aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] self-start overflow-y-auto border-r border-border bg-card p-5 md:block"><nav className="space-y-1">{links.map(({ label, href, icon: Icon }) => {
        const targetPath = href.split('?')[0].replace(/\/+$/, '') || '/';
        const isActive = currentPath === targetPath || (targetPath !== '/admin' && currentPath.startsWith(`${targetPath}/`));

        return <Link key={label} href={href} aria-current={isActive ? 'page' : undefined} className={`flex items-center gap-3 border-l-2 px-3 py-3 text-sm transition-colors ${isActive ? 'border-primary bg-accent font-semibold text-accent-foreground' : 'border-transparent text-foreground hover:bg-muted'}`}><Icon size={17} />{label}</Link>;
    })}</nav></aside><main className="min-w-0 bg-background p-5 text-foreground md:p-9">{children}</main></div>;
}
