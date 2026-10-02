import { Head, Link, useForm } from '@inertiajs/react';
import adminRoutes from '@/routes/admin';
import { useTranslation } from '@/hooks/use-translation';
import { useState } from 'react';

export default function HomeSettingsEdit({ tagline, heroImage }: { tagline: string; heroImage: string | null }) {
    const { t } = useTranslation();
    const [preview, setPreview] = useState<string | null>(null);
    const form = useForm({ tagline, hero_image: null as File | null });
    const submit = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        form.transform((data) => ({ ...data, _method: 'put' }));
        form.post(adminRoutes.homeSettings.update.url(), { forceFormData: true });
    };
    const image = preview ?? (heroImage ? `/storage/${heroImage}` : '/images/hero.svg');
    return <><Head title={t('admin.homeSettings')} /><div className="mb-6 flex items-center justify-between"><h1 className="text-3xl font-medium">{t('admin.homeSettings')}</h1><Link href={adminRoutes.dashboard.url()} className="text-sm underline">{t('admin.dashboardLink')}</Link></div><form onSubmit={submit} className="max-w-2xl space-y-6 border bg-card p-6"><label className="block text-sm">{t('admin.tagline')}<input value={form.data.tagline} onChange={(event) => form.setData('tagline', event.target.value)} className="mt-2 w-full border p-3" /></label><div><label className="block text-sm">{t('admin.heroUpload')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; form.setData('hero_image', file); setPreview(file ? URL.createObjectURL(file) : null); }} className="mt-2 w-full border p-3" /></label><img src={image} alt={t('admin.heroPreview')} className="mt-4 aspect-video w-full object-cover" /></div><button disabled={form.processing} className="bg-primary px-6 py-3 text-sm text-primary-foreground">{form.processing ? t('admin.saving') : t('admin.saveHome')}</button></form></>;
}
