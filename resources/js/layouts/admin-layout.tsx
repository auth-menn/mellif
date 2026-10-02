import { Link, usePage } from '@inertiajs/react';
import { Home, LayoutDashboard, Package, Tags, ShoppingCart, Truck, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import adminRoutes from '@/routes/admin';

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { url } = usePage();
    const links = [
        { label: 'Dashboard', href: adminRoutes.dashboard.url(), icon: LayoutDashboard },
        { label: 'Produk', href: adminRoutes.products.index.url(), icon: Package },
        { label: 'Kategori', href: adminRoutes.categories.index.url(), icon: Tags },
        { label: 'Pesanan', href: adminRoutes.orders.index.url(), icon: ShoppingCart },
        { label: 'Ekspedisi', href: adminRoutes.shipping.index.url(), icon: Truck },
        { label: 'Pengaturan Beranda', href: adminRoutes.homeSettings.edit.url(), icon: Settings },
    ];

    return <div className="min-h-screen bg-[#f5f5f3] pt-[72px] md:grid md:grid-cols-[240px_1fr]"><header className="fixed inset-x-0 top-0 z-40 flex h-[72px] items-center justify-between bg-black px-5 text-white"><Link href={adminRoutes.dashboard.url()} className="font-black tracking-[.2em]">MELLIF <span className="text-xs font-normal tracking-normal">CMS</span></Link><Link href="/" className="flex items-center gap-2 text-xs"><Home size={15} /> Lihat toko</Link></header><aside className="hidden border-r border-neutral-200 bg-white p-5 md:block"><nav className="space-y-1">{links.map(({ label, href, icon: Icon }) => <Link key={label} href={href} className={`flex items-center gap-3 rounded px-3 py-3 text-sm ${url.startsWith(href.split('?')[0]) ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50'}`}><Icon size={17} />{label}</Link>)}</nav></aside><main className="min-w-0 p-5 md:p-9">{children}</main></div>;
}
