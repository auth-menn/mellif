import { Head, Link } from '@inertiajs/react';
import { LayoutDashboard, Package, Tags, Truck, ShoppingCart, Settings } from 'lucide-react';
import { dashboard } from '@/routes/admin';
import { money } from '@/types/store';

type Order = { id: number; order_number: string; total: number; status: string; created_at: string; user: { name: string } | null };

export default function AdminDashboard({ stats, recentOrders }: { stats: { orders_today: number; pending_orders: number; products: number; low_stock: number }; recentOrders: Order[] }) {
    const links = [
        { label: 'Dashboard', href: dashboard.url(), icon: LayoutDashboard },
        { label: 'Produk', href: '#products', icon: Package },
        { label: 'Kategori', href: '#categories', icon: Tags },
        { label: 'Pesanan', href: '#orders', icon: ShoppingCart },
        { label: 'Ekspedisi', href: '#shipping', icon: Truck },
        { label: 'Pengaturan Beranda', href: '#settings', icon: Settings },
    ];
    const cards = [['Order hari ini', stats.orders_today], ['Order pending', stats.pending_orders], ['Total produk', stats.products], ['Varian stok menipis', stats.low_stock]] as const;

    return <><Head title="Admin — Mellif" /><div className="min-h-screen bg-[#f5f5f3] pt-[72px] md:grid md:grid-cols-[240px_1fr]"><aside className="hidden border-r border-neutral-200 bg-white p-5 md:block"><p className="mb-8 text-xl font-black tracking-[.18em]">MELLIF <span className="text-xs font-normal tracking-normal text-neutral-500">ADMIN</span></p><nav className="space-y-1">{links.map(({ label, href, icon: Icon }) => <Link key={label} href={href} className="flex items-center gap-3 rounded px-3 py-3 text-sm hover:bg-neutral-100"><Icon size={17} />{label}</Link>)}</nav></aside><main className="p-5 md:p-9"><p className="text-xs uppercase tracking-[.2em] text-neutral-500">Ringkasan</p><h1 className="mt-2 text-3xl font-medium">Dashboard</h1><div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value]) => <article key={label} className="border border-neutral-200 bg-white p-5"><p className="text-sm text-neutral-500">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></article>)}</div><section className="mt-8 overflow-hidden border border-neutral-200 bg-white"><div className="border-b p-5"><h2 className="font-medium">Pesanan terbaru</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-neutral-50 text-neutral-500"><tr><th className="p-4 font-medium">Nomor</th><th className="p-4 font-medium">Pelanggan</th><th className="p-4 font-medium">Total</th><th className="p-4 font-medium">Status</th></tr></thead><tbody>{recentOrders.map((order) => <tr key={order.id} className="border-t"><td className="p-4 font-medium">{order.order_number}</td><td className="p-4">{order.user?.name ?? '—'}</td><td className="p-4">{money(order.total)}</td><td className="p-4">{order.status}</td></tr>)}{recentOrders.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Belum ada pesanan.</td></tr>}</tbody></table></div></section></main></div></>;
}
