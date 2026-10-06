import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Home, LayoutDashboard, Package, Tags, ShoppingCart, Truck, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import adminRoutes from '@/routes/admin';
import { useTranslation } from '@/hooks/use-translation';

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { url, props } = usePage();
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

    let pageTitle = t('admin.dashboard');
    let pageSection = t('admin.summary');
    let backHref = adminRoutes.products.index.url();

    if (currentPath.startsWith('/admin/products')) {
        pageSection = t('admin.catalog');
        pageTitle = currentPath.endsWith('/create')
            ? t('admin.newProduct')
            : /\/edit$/.test(currentPath)
              ? t('admin.editProduct')
              : t('admin.products');
        backHref = currentPath.endsWith('/create') || /\/edit$/.test(currentPath)
            ? adminRoutes.products.index.url()
            : adminRoutes.dashboard.url();
    } else if (currentPath.startsWith('/admin/categories')) {
        pageTitle = t('admin.categories');
        backHref = adminRoutes.dashboard.url();
    } else if (currentPath.startsWith('/admin/orders/')) {
        const order = (props as Record<string, unknown>).order as { order_number?: string } | undefined;
        pageTitle = order?.order_number ?? t('admin.orderDetails');
        pageSection = t('admin.orders');
        backHref = adminRoutes.orders.index.url();
    } else if (currentPath.startsWith('/admin/orders')) {
        pageTitle = t('admin.orders');
        backHref = adminRoutes.dashboard.url();
    } else if (currentPath.startsWith('/admin/shipping')) {
        pageTitle = t('admin.shipping');
        backHref = adminRoutes.dashboard.url();
    } else if (currentPath.startsWith('/admin/home-settings')) {
        pageTitle = t('admin.homeSettings');
        backHref = adminRoutes.dashboard.url();
    }

    return (
        <div className="admin-theme min-h-screen bg-background pt-[72px] text-foreground md:grid md:grid-cols-[240px_1fr]">
            <header className="fixed inset-x-0 top-0 z-40 flex h-[72px] items-center justify-between gap-3 border-b border-border bg-card px-3 text-foreground sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                    <Link href={backHref} aria-label={t('admin.back')} title={t('admin.back')} className="flex size-10 shrink-0 items-center justify-center border border-border text-foreground hover:bg-muted">
                        <ArrowLeft size={18} />
                    </Link>
                    <Link href={adminRoutes.dashboard.url()} className="hidden shrink-0 font-black tracking-[.2em] sm:block">
                        MELLIF <span className="text-xs font-normal tracking-normal">{t('admin.label')}</span>
                    </Link>
                    <div className="min-w-0 border-l border-border pl-3">
                        <p className="truncate text-xs text-muted-foreground">{pageSection}</p>
                        <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{pageTitle}</h1>
                    </div>
                </div>
                <Link href="/" className="flex shrink-0 items-center gap-2 text-xs text-primary underline underline-offset-2">
                    <Home size={15} /> <span className="hidden sm:inline">{t('nav.viewStore')}</span>
                </Link>
            </header>
            <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] self-start overflow-y-auto border-r border-border bg-card p-5 md:block">
                <nav className="space-y-1">
                    {links.map(({ label, href, icon: Icon }) => {
                        const targetPath = href.split('?')[0].replace(/\/+$/, '') || '/';
                        const isActive = currentPath === targetPath || (targetPath !== '/admin' && currentPath.startsWith(`${targetPath}/`));

                        return (
                            <Link key={label} href={href} aria-current={isActive ? 'page' : undefined} className={`flex items-center gap-3 border-l-2 px-3 py-3 text-sm transition-colors ${isActive ? 'border-primary bg-accent font-semibold text-accent-foreground' : 'border-transparent text-foreground hover:bg-muted'}`}>
                                <Icon size={17} />{label}
                            </Link>
                        );
                    })}
                </nav>
            </aside>
            <main className="min-w-0 bg-background p-4 text-foreground sm:p-5 md:p-8">{children}</main>
        </div>
    );
}
