import { Head, router, useForm } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import adminRoutes from '@/routes/admin';
import { useTranslation } from '@/hooks/use-translation';
import type { StoreVariant } from '@/types/store';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';

type Category = { id: number; name: string };
type ExistingImage = { id: number; path: string; sort_order: number };
type EditableProduct = {
    id: number;
    category_id: number;
    name: string;
    description: string;
    price: number;
    weight: number;
    discount_percent: number | null;
    is_active: boolean;
    is_featured: boolean;
    variants: StoreVariant[];
    images: ExistingImage[];
};
type VariantInput = { size: string; stock: string };

function normalizeStock(value: string): string {
    return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

function formatRupiah(value: string | number): string {
    const digits = String(value)
        .replace(/\D/g, '')
        .replace(/^0+(?=\d)/, '');

    return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
}

type ProductFormData = {
    category_id: number;
    name: string;
    description: string;
    price: string;
    weight: string;
    discount_percent: number | '';
    is_active: boolean;
    is_featured: boolean;
    variants: VariantInput[];
    images: File[];
    image_orders: number[];
    sync_existing_images: boolean;
    existing_images: number[];
    existing_image_orders: Record<number, number>;
};

export default function ProductForm({
    product,
    categories,
}: {
    product: EditableProduct | null;
    categories: Category[];
}) {
    const { t } = useTranslation();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteProcessing, setDeleteProcessing] = useState(false);
    const [newVariant, setNewVariant] = useState<VariantInput>({
        size: '',
        stock: '',
    });
    const [newImagePreviews, setNewImagePreviews] = useState<
        { file: File; url: string }[]
    >([]);
    useEffect(
        () => () =>
            newImagePreviews.forEach(({ url }) => URL.revokeObjectURL(url)),
        [newImagePreviews],
    );
    const form = useForm<ProductFormData>({
        category_id: product?.category_id ?? categories[0]?.id ?? 0,
        name: product?.name ?? '',
        description: product?.description ?? '',
        price: product ? formatRupiah(product.price) : '',
        weight: String(product?.weight ?? 500),
        discount_percent: product?.discount_percent ?? '',
        is_active: product?.is_active ?? true,
        is_featured: product?.is_featured ?? false,
        variants: product?.variants.map((variant: StoreVariant) => ({
            size: variant.size,
            stock: String(variant.stock),
        })) ?? [{ size: 'M', stock: '' }],
        images: [] as File[],
        image_orders: [] as number[],
        sync_existing_images: product !== null,
        existing_images: product?.images.map((image) => image.id) ?? [],
        existing_image_orders: Object.fromEntries(
            product?.images.map((image) => [image.id, image.sort_order]) ?? [],
        ) as Record<number, number>,
    });
    const submit = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        setConfirmOpen(true);
    };

    const saveProduct = (): void => {
        const action = product
            ? adminRoutes.products.update.url({ product: product.id })
            : adminRoutes.products.store.url();
        form.transform((data) => ({
            ...data,
            price: Number(data.price.replace(/\D/g, '')),
            weight: Number(data.weight),
            discount_percent:
                data.discount_percent === '' ? null : data.discount_percent,
            variants: data.variants.map((variant) => ({
                ...variant,
                stock: variant.stock === '' ? '' : Number(variant.stock),
            })),
            _method: product ? 'put' : 'post',
        }));
        form.post(action, {
            forceFormData: true,
            onFinish: () => setConfirmOpen(false),
        });
    };

    const deleteProduct = (): void => {
        if (!product) return;

        router.delete(
            adminRoutes.products.destroy.url({ product: product.id }),
            {
                onStart: () => setDeleteProcessing(true),
                onFinish: () => {
                    setDeleteProcessing(false);
                    setDeleteConfirmOpen(false);
                },
            },
        );
    };

    return (
        <>
            <Head
                title={`${product ? t('admin.editProduct') : t('admin.newProduct')} — Mellif Studio`}
            />
            <form
                onSubmit={submit}
                className="w-full space-y-6 border border-border bg-card p-5 text-foreground md:p-8"
            >
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">
                        {product
                            ? t('admin.editProduct')
                            : t('admin.newProduct')}
                    </h1>
                    {product && (
                        <button
                            type="button"
                            aria-label={t('admin.delete')}
                            title={t('admin.delete')}
                            onClick={() => setDeleteConfirmOpen(true)}
                            className="grid size-9 place-items-center border border-red-300 text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                    <label className="text-sm">
                        {t('admin.productName')}
                        <input
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            className="mt-2 w-full border border-input bg-card px-3 py-3 text-foreground"
                        />
                        {form.errors.name && (
                            <span className="text-xs text-destructive">
                                {form.errors.name}
                            </span>
                        )}
                    </label>
                    <label className="text-sm">
                        {t('admin.category')}
                        <select
                            value={form.data.category_id}
                            onChange={(event) =>
                                form.setData(
                                    'category_id',
                                    Number(event.target.value),
                                )
                            }
                            className="mt-2 w-full border border-input bg-card px-3 py-3 text-foreground"
                        >
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm">
                        {t('admin.priceRupiah')}
                        <div className="mt-2 flex items-center border border-input bg-card">
                            <span className="pl-3 text-muted-foreground">
                                Rp
                            </span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={form.data.price}
                                onChange={(event) =>
                                    form.setData(
                                        'price',
                                        formatRupiah(event.target.value),
                                    )
                                }
                                className="w-full border-0 bg-transparent px-3 py-3 text-foreground"
                            />
                        </div>
                        {form.errors.price && (
                            <span className="text-xs text-destructive">
                                {form.errors.price}
                            </span>
                        )}
                    </label>
                    <label className="text-sm">
                        {t('admin.weight')}
                        <input
                            type="number"
                            min={1}
                            max={50000}
                            value={form.data.weight}
                            onChange={(event) =>
                                form.setData('weight', event.target.value)
                            }
                            className="mt-2 w-full border border-input bg-card px-3 py-3 text-foreground"
                        />
                        <span className="mt-1 block text-xs text-muted-foreground">
                            {t('admin.weightHelp')}
                        </span>
                        {form.errors.weight && (
                            <span className="text-xs text-destructive">
                                {form.errors.weight}
                            </span>
                        )}
                    </label>
                    <label className="text-sm">
                        {t('admin.discountPercent')}{' '}
                        <span className="text-xs text-muted-foreground">
                            (Opsional)
                        </span>
                        <input
                            type="number"
                            min={1}
                            max={99}
                            value={form.data.discount_percent}
                            onChange={(event) =>
                                form.setData(
                                    'discount_percent',
                                    event.target.value
                                        ? Number(event.target.value)
                                        : '',
                                )
                            }
                            className="mt-2 w-full border border-input bg-card px-3 py-3 text-foreground"
                        />
                    </label>
                </div>
                <label className="block text-sm">
                    {t('admin.description')}
                    <textarea
                        value={form.data.description}
                        onChange={(event) =>
                            form.setData('description', event.target.value)
                        }
                        className="mt-2 min-h-32 w-full border border-input bg-card p-3 text-foreground"
                    />
                </label>
                <fieldset>
                    <legend className="mb-3 text-sm font-medium">
                        {t('admin.variants')}
                    </legend>
                    <div className="space-y-2">
                        {form.data.variants.map((variant, index) => (
                            <div
                                key={`${variant.size}-${index}`}
                                className="flex gap-2"
                            >
                                <input
                                    aria-label={t('admin.size')}
                                    value={variant.size}
                                    onChange={(event) =>
                                        form.setData(
                                            'variants',
                                            form.data.variants.map(
                                                (item, itemIndex) =>
                                                    itemIndex === index
                                                        ? {
                                                              ...item,
                                                              size: event.target
                                                                  .value,
                                                          }
                                                        : item,
                                            ),
                                        )
                                    }
                                    className="w-1/2 border border-input bg-card px-3 py-2 text-foreground"
                                />
                                <input
                                    aria-label={t('admin.stock')}
                                    type="text"
                                    inputMode="numeric"
                                    value={variant.stock}
                                    onChange={(event) =>
                                        form.setData(
                                            'variants',
                                            form.data.variants.map(
                                                (item, itemIndex) =>
                                                    itemIndex === index
                                                        ? {
                                                              ...item,
                                                              stock: normalizeStock(
                                                                  event.target
                                                                      .value,
                                                              ),
                                                          }
                                                        : item,
                                            ),
                                        )
                                    }
                                    className="w-1/3 border border-input bg-card px-3 py-2 text-foreground"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        form.setData(
                                            'variants',
                                            form.data.variants.filter(
                                                (_, itemIndex) =>
                                                    itemIndex !== index,
                                            ),
                                        )
                                    }
                                    className="px-3 font-medium text-destructive"
                                >
                                    {t('admin.delete')}
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <input
                            aria-label={t('admin.newSize')}
                            placeholder={t('admin.size')}
                            value={newVariant.size}
                            onChange={(event) =>
                                setNewVariant({
                                    ...newVariant,
                                    size: event.target.value,
                                })
                            }
                            className="w-1/2 border border-input bg-card px-3 py-2 text-foreground"
                        />
                        <input
                            aria-label={t('admin.openingStock')}
                            placeholder={t('admin.stock')}
                            type="text"
                            inputMode="numeric"
                            value={newVariant.stock}
                            onChange={(event) =>
                                setNewVariant({
                                    ...newVariant,
                                    stock: normalizeStock(event.target.value),
                                })
                            }
                            className="w-1/3 border border-input bg-card px-3 py-2 text-foreground"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                if (newVariant.size.trim()) {
                                    form.setData('variants', [
                                        ...form.data.variants,
                                        newVariant,
                                    ]);
                                    setNewVariant({ size: '', stock: '' });
                                }
                            }}
                            className="border border-input px-3 text-sm text-foreground"
                        >
                            {t('admin.addVariant')}
                        </button>
                    </div>
                </fieldset>
                <div>
                    <label className="block text-sm">
                        {t('admin.uploadProductImages')}
                        <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                                const added = Array.from(
                                    event.target.files ?? [],
                                );
                                const files = [
                                    ...form.data.images,
                                    ...added,
                                ].slice(
                                    0,
                                    Math.max(
                                        0,
                                        8 - form.data.existing_images.length,
                                    ),
                                );
                                form.setData('images', files);
                                form.setData(
                                    'image_orders',
                                    files.map(
                                        (_, index) =>
                                            index +
                                            (product?.images.length ?? 0),
                                    ),
                                );
                                setNewImagePreviews(
                                    files.map((file) => ({
                                        file,
                                        url: URL.createObjectURL(file),
                                    })),
                                );
                                event.target.value = '';
                            }}
                            className="mt-2 block w-full border border-input bg-card p-3 text-foreground"
                        />
                        <span className="mt-1 block text-xs text-muted-foreground">
                            {form.data.existing_images.length +
                                form.data.images.length}
                            /8
                        </span>
                    </label>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                        {product?.images
                            .filter((image) =>
                                form.data.existing_images.includes(image.id),
                            )
                            .map((image) => (
                                <div
                                    key={image.id}
                                    className="relative border border-border p-2 text-xs text-foreground"
                                >
                                    <img
                                        src={`/storage/${image.path}`}
                                        alt=""
                                        className="mb-2 aspect-square w-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        aria-label={t('admin.delete')}
                                        title={t('admin.delete')}
                                        onClick={() =>
                                            form.setData(
                                                'existing_images',
                                                form.data.existing_images.filter(
                                                    (id) => id !== image.id,
                                                ),
                                            )
                                        }
                                        className="absolute top-3 right-3 grid size-8 place-items-center bg-white text-red-700 shadow-sm transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                                    >
                                        <X size={16} />
                                    </button>
                                    <input
                                        type="number"
                                        aria-label={t('admin.orderImage')}
                                        value={
                                            form.data.existing_image_orders[
                                                image.id
                                            ] ?? 0
                                        }
                                        onChange={(event) =>
                                            form.setData(
                                                'existing_image_orders',
                                                {
                                                    ...form.data
                                                        .existing_image_orders,
                                                    [image.id]: Number(
                                                        event.target.value,
                                                    ),
                                                },
                                            )
                                        }
                                        className="mt-2 w-full border border-input px-2 py-1 text-foreground"
                                    />
                                </div>
                            ))}
                        {newImagePreviews.map(({ file, url }, index) => (
                            <div
                                key={`${file.name}-${index}-${file.lastModified}`}
                                className="relative border border-border p-2 text-xs text-foreground"
                            >
                                <img
                                    src={url}
                                    alt={file.name}
                                    className="mb-2 aspect-square w-full object-cover"
                                />
                                <span className="block truncate">
                                    {file.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const files = form.data.images.filter(
                                            (_, fileIndex) =>
                                                fileIndex !== index,
                                        );
                                        form.setData('images', files);
                                        form.setData(
                                            'image_orders',
                                            files.map(
                                                (_, fileIndex) =>
                                                    fileIndex +
                                                    (product?.images.length ??
                                                        0),
                                            ),
                                        );
                                        setNewImagePreviews(
                                            files.map((selectedFile) => ({
                                                file: selectedFile,
                                                url: URL.createObjectURL(
                                                    selectedFile,
                                                ),
                                            })),
                                        );
                                    }}
                                    aria-label={t('admin.delete')}
                                    title={t('admin.delete')}
                                    className="absolute top-3 right-3 grid size-8 place-items-center bg-white text-red-700 shadow-sm transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.data.is_active}
                            onChange={(event) =>
                                form.setData('is_active', event.target.checked)
                            }
                        />
                        {t('admin.activeToggle')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.data.is_featured}
                            onChange={(event) =>
                                form.setData(
                                    'is_featured',
                                    event.target.checked,
                                )
                            }
                        />
                        {t('admin.featuredToggle')}
                    </label>
                </div>
                <button
                    disabled={form.processing}
                    className="bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted"
                >
                    {form.processing
                        ? t('admin.saving')
                        : t('admin.saveProduct')}
                </button>
            </form>
            <ConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                onConfirm={deleteProduct}
                processing={deleteProcessing}
                destructive
                title={t('admin.confirmTitle')}
                description={t('admin.deleteProductConfirm')}
                confirmLabel={t('admin.confirm')}
                cancelLabel={t('common.cancel')}
            />
            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                onConfirm={saveProduct}
                processing={form.processing}
                title={t('admin.confirmTitle')}
                description={
                    product
                        ? t('admin.confirmUpdate')
                        : t('admin.confirmCreate')
                }
                confirmLabel={t('admin.confirm')}
                cancelLabel={t('common.cancel')}
            />
        </>
    );
}
