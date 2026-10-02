import { Head, Link, useForm } from '@inertiajs/react';
import { useState } from 'react';
import adminRoutes from '@/routes/admin';
import { useTranslation } from '@/hooks/use-translation';
import type { StoreVariant } from '@/types/store';

type Category = { id: number; name: string };
type ExistingImage = { id: number; path: string; sort_order: number };
type EditableProduct = { id: number; category_id: number; name: string; description: string; price: number; discount_percent: number | null; is_active: boolean; is_featured: boolean; variants: StoreVariant[]; images: ExistingImage[] };
type VariantInput = { size: string; stock: number };
type ProductFormData = {
    category_id: number;
    name: string;
    description: string;
    price: number;
    discount_percent: number | '';
    is_active: boolean;
    is_featured: boolean;
    variants: VariantInput[];
    images: File[];
    image_orders: number[];
    existing_images: number[];
    existing_image_orders: Record<number, number>;
};

export default function ProductForm({ product, categories }: { product: EditableProduct | null; categories: Category[] }) {
    const { t } = useTranslation();
    const [newVariant, setNewVariant] = useState<VariantInput>({ size: '', stock: 0 });
    const form = useForm<ProductFormData>({
        category_id: product?.category_id ?? categories[0]?.id ?? 0,
        name: product?.name ?? '',
        description: product?.description ?? '',
        price: product?.price ?? 0,
        discount_percent: product?.discount_percent ?? '',
        is_active: product?.is_active ?? true,
        is_featured: product?.is_featured ?? false,
        variants: product?.variants.map((variant: StoreVariant) => ({ size: variant.size, stock: variant.stock })) ?? [{ size: 'M', stock: 0 }],
        images: [] as File[],
        image_orders: [] as number[],
        existing_images: product?.images.map((image) => image.id) ?? [],
        existing_image_orders: Object.fromEntries(product?.images.map((image) => [image.id, image.sort_order]) ?? []) as Record<number, number>,
    });
    const submit = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        const action = product ? adminRoutes.products.update.url({ product: product.id }) : adminRoutes.products.store.url();
        form.transform((data) => ({ ...data, _method: product ? 'put' : 'post' }));
        form.post(action, { forceFormData: true });
    };

    return <><Head title={`${product ? t('admin.editProduct') : t('admin.newProduct')} — Mellif`} /><div className="mb-6 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{t('admin.catalog')}</p><h1 className="text-3xl font-medium text-foreground">{product ? t('admin.editProduct') : t('admin.newProduct')}</h1></div><Link href={adminRoutes.products.index.url()} className="text-sm font-medium text-primary underline underline-offset-2">{t('admin.back')}</Link></div><form onSubmit={submit} className="max-w-4xl space-y-6 border border-border bg-card p-5 text-foreground md:p-8"><div className="grid gap-5 md:grid-cols-2"><label className="text-sm">{t('admin.productName')}<input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} className="mt-2 w-full border border-input bg-card px-3 py-3 text-foreground" />{form.errors.name && <span className="text-xs text-destructive">{form.errors.name}</span>}</label><label className="text-sm">{t('admin.category')}<select value={form.data.category_id} onChange={(event) => form.setData('category_id', Number(event.target.value))} className="mt-2 w-full border border-input bg-card px-3 py-3 text-foreground">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-sm">{t('admin.priceRupiah')}<input type="number" min={0} value={form.data.price} onChange={(event) => form.setData('price', Number(event.target.value))} className="mt-2 w-full border border-input bg-card px-3 py-3 text-foreground" /></label><label className="text-sm">{t('admin.discountPercent')}<input type="number" min={1} max={99} value={form.data.discount_percent} onChange={(event) => form.setData('discount_percent', event.target.value ? Number(event.target.value) : '')} className="mt-2 w-full border border-input bg-card px-3 py-3 text-foreground" /></label></div><label className="block text-sm">{t('admin.description')}<textarea value={form.data.description} onChange={(event) => form.setData('description', event.target.value)} className="mt-2 min-h-32 w-full border border-input bg-card p-3 text-foreground" /></label><fieldset><legend className="mb-3 text-sm font-medium">{t('admin.variants')}</legend><div className="space-y-2">{form.data.variants.map((variant, index) => <div key={`${variant.size}-${index}`} className="flex gap-2"><input aria-label={t('admin.size')} value={variant.size} onChange={(event) => form.setData('variants', form.data.variants.map((item, itemIndex) => itemIndex === index ? { ...item, size: event.target.value } : item))} className="w-1/2 border border-input bg-card px-3 py-2 text-foreground" /><input aria-label={t('admin.stock')} type="number" min={0} value={variant.stock} onChange={(event) => form.setData('variants', form.data.variants.map((item, itemIndex) => itemIndex === index ? { ...item, stock: Number(event.target.value) } : item))} className="w-1/3 border border-input bg-card px-3 py-2 text-foreground" /><button type="button" onClick={() => form.setData('variants', form.data.variants.filter((_, itemIndex) => itemIndex !== index))} className="px-3 font-medium text-destructive">{t('admin.delete')}</button></div>)}</div><div className="mt-3 flex gap-2"><input aria-label={t('admin.newSize')} placeholder={t('admin.size')} value={newVariant.size} onChange={(event) => setNewVariant({ ...newVariant, size: event.target.value })} className="w-1/2 border border-input bg-card px-3 py-2 text-foreground" /><input aria-label={t('admin.openingStock')} placeholder={t('admin.stock')} type="number" min={0} value={newVariant.stock} onChange={(event) => setNewVariant({ ...newVariant, stock: Number(event.target.value) })} className="w-1/3 border border-input bg-card px-3 py-2 text-foreground" /><button type="button" onClick={() => { if (newVariant.size.trim()) { form.setData('variants', [...form.data.variants, newVariant]); setNewVariant({ size: '', stock: 0 }); } }} className="border border-input px-3 text-sm text-foreground">{t('admin.addVariant')}</button></div></fieldset><div><label className="block text-sm">{t('admin.uploadProductImages')}<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { const files = Array.from(event.target.files ?? []); form.setData('images', files); form.setData('image_orders', files.map((_, index) => index + (product?.images.length ?? 0))); }} className="mt-2 block w-full border border-input bg-card p-3 text-foreground" /></label>{product && <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{product.images.map((image) => <label key={image.id} className="border border-border p-2 text-xs text-foreground"><img src={`/storage/${image.path}`} alt="" className="mb-2 aspect-square w-full object-cover" /><span className="flex items-center gap-2"><input type="checkbox" checked={form.data.existing_images.includes(image.id)} onChange={(event) => form.setData('existing_images', event.target.checked ? [...form.data.existing_images, image.id] : form.data.existing_images.filter((id) => id !== image.id))} />{t('admin.keepImage')}</span><input type="number" aria-label={t('admin.orderImage')} value={form.data.existing_image_orders[image.id] ?? 0} onChange={(event) => form.setData('existing_image_orders', { ...form.data.existing_image_orders, [image.id]: Number(event.target.value) })} className="mt-2 w-full border border-input px-2 py-1 text-foreground" /></label>)}</div>}</div><div className="flex gap-6"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />{t('admin.activeToggle')}</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data.is_featured} onChange={(event) => form.setData('is_featured', event.target.checked)} />{t('admin.featuredToggle')}</label></div><button disabled={form.processing} className="bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted">{form.processing ? t('admin.saving') : t('admin.saveProduct')}</button></form></>;
}
