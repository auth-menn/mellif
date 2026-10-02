import { Head, Link, useForm } from '@inertiajs/react';
import adminRoutes from '@/routes/admin';
import { useState } from 'react';

export default function HomeSettingsEdit({ tagline, heroImage }: { tagline: string; heroImage: string | null }) {
    const [preview, setPreview] = useState<string | null>(null);
    const form = useForm({ tagline, hero_image: null as File | null });
    const submit = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        form.transform((data) => ({ ...data, _method: 'put' }));
        form.post(adminRoutes.homeSettings.update.url(), { forceFormData: true });
    };
    return <><Head title="Pengaturan Beranda — CMS Mellif" /><div className="mb-6 flex items-center justify-between"><h1 className="text-3xl font-medium">Pengaturan Beranda</h1><Link href={adminRoutes.dashboard.url()} className="text-sm underline">Dashboard</Link></div><form onSubmit={submit} className="max-w-2xl space-y-6 border bg-white p-6"><label className="block text-sm">Tagline<input value={form.data.tagline} onChange={(event) => form.setData('tagline', event.target.value)} className="mt-2 w-full border p-3" /></label><div><label className="block text-sm">Gambar hero (JPG, PNG, WebP · maks. 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; form.setData('hero_image', file); setPreview(file ? URL.createObjectURL(file) : null); }} className="mt-2 w-full border p-3" /></label>{(preview ?? (heroImage ? `/storage/${heroImage}` : '/images/hero.svg')) && <img src={preview ?? (heroImage ? `/storage/${heroImage}` : '/images/hero.svg')} alt="Preview hero" className="mt-4 aspect-video w-full object-cover" />}</div><button disabled={form.processing} className="bg-black px-6 py-3 text-sm text-white">Simpan</button></form></>;
}
