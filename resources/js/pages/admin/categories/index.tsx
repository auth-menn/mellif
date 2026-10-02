import { Head, Link, router, useForm } from '@inertiajs/react';
import adminRoutes from '@/routes/admin';
import { useTranslation } from '@/hooks/use-translation';

type Category = { id: number; name: string; slug: string; sort_order: number; products_count: number };
type Page<T> = { data: T[]; links: { url: string | null; label: string; active: boolean }[] };

export default function CategoriesIndex({ categories, editing }: { categories: Page<Category>; editing: Category | null }) {
    const { t } = useTranslation();
    const form = useForm({ name: editing?.name ?? '', slug: editing?.slug ?? '', sort_order: editing?.sort_order ?? 0 });
    const submit = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        if (editing) form.put(adminRoutes.categories.update.url({ category: editing.id }));
        else form.post(adminRoutes.categories.store.url());
    };
    return <><Head title={`${t('admin.categories')} — CMS Mellif`} /><div className="mb-6 flex items-center justify-between"><h1 className="text-3xl font-medium">{t('admin.categories')}</h1><Link href={adminRoutes.categories.index.url()} className="text-sm underline">{t('admin.newCategory')}</Link></div><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><section className="overflow-x-auto border bg-card"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-4">{t('admin.name')}</th><th className="p-4">{t('admin.slug')}</th><th className="p-4">{t('admin.productCount')}</th><th className="p-4">{t('admin.action')}</th></tr></thead><tbody>{categories.data.map((category) => <tr key={category.id} className="border-t"><td className="p-4">{category.name}</td><td className="p-4">{category.slug}</td><td className="p-4">{category.products_count}</td><td className="p-4"><Link href={adminRoutes.categories.index.url({ query: { edit: category.id } })} className="mr-3 underline">{t('admin.edit')}</Link><button className="text-destructive underline" onClick={() => { if (window.confirm(`${t('admin.deleteCategoryConfirm')} ${category.name}?`)) router.delete(adminRoutes.categories.destroy.url({ category: category.id })); }}>{t('admin.delete')}</button></td></tr>)}</tbody></table></section><form onSubmit={submit} className="h-fit space-y-4 border bg-card p-5"><h2 className="font-medium">{editing ? t('admin.edit') : t('admin.newCategory')}</h2><label className="block text-sm">{t('admin.name')}<input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} className="mt-2 w-full border p-3" /></label><label className="block text-sm">{t('admin.slug')}<input value={form.data.slug} onChange={(event) => form.setData('slug', event.target.value)} placeholder={t('admin.autoSlug')} className="mt-2 w-full border p-3" /></label><label className="block text-sm">{t('admin.order')}<input type="number" min={0} value={form.data.sort_order} onChange={(event) => form.setData('sort_order', Number(event.target.value))} className="mt-2 w-full border p-3" /></label><button className="bg-primary px-5 py-3 text-sm text-primary-foreground">{t('admin.save')}</button></form></div></>;
}
