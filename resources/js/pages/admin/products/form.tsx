import { Head, router, useForm } from '@inertiajs/react';
import { Check, Crop, GripVertical, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
type VariantInput = { key: string; size: string; stock: string };
type NewVariantInput = Omit<VariantInput, 'key'>;

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
type SortableProductImage = {
    key: string;
    kind: 'existing' | 'new';
    id?: number;
    index: number;
    url: string;
    name: string;
    order: number;
};
type ProductImageCropRequest = {
    file: File;
    target: { kind: 'new'; index: number } | { kind: 'existing'; id: number; order: number };
};

function ProductImageCropDialog({
    file,
    onCancel,
    onApply,
}: {
    file: File;
    onCancel: () => void;
    onApply: (file: File) => void;
}) {
    const { t } = useTranslation();
    const [source, setSource] = useState<HTMLImageElement | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const cropFailedMessage = t('admin.cropFailed');
    const drag = useRef<{
        x: number;
        y: number;
        offsetX: number;
        offsetY: number;
    } | null>(null);
    const cropSize = 240;

    useEffect(() => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => setSource(image);
        image.onerror = () => setError(cropFailedMessage);
        image.src = url;

        return () => URL.revokeObjectURL(url);
    }, [file, cropFailedMessage]);

    const scale = source
        ? Math.max(cropSize / source.naturalWidth, cropSize / source.naturalHeight) * zoom
        : 1;
    const imageWidth = source ? source.naturalWidth * scale : cropSize;
    const imageHeight = source ? source.naturalHeight * scale : cropSize;
    const offsetX = Math.max(-((imageWidth - cropSize) / 2), Math.min((imageWidth - cropSize) / 2, offset.x));
    const offsetY = Math.max(-((imageHeight - cropSize) / 2), Math.min((imageHeight - cropSize) / 2, offset.y));

    const applyCrop = async (): Promise<void> => {
        if (!source) return;

        setProcessing(true);
        setError('');
        const canvas = document.createElement('canvas');
        const outputSize = 1200;
        canvas.width = outputSize;
        canvas.height = outputSize;
        const context = canvas.getContext('2d');

        if (!context) {
            setError(t('admin.cropFailed'));
            setProcessing(false);
            return;
        }

        const sourceX = (imageWidth / 2 - cropSize / 2 - offsetX) / scale;
        const sourceY = (imageHeight / 2 - cropSize / 2 - offsetY) / scale;
        const sourceSize = cropSize / scale;
        context.drawImage(source, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

        const mimeType = file.type || 'image/jpeg';
        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, mimeType, 0.92);
        });

        if (!blob) {
            setError(t('admin.cropFailed'));
            setProcessing(false);
            return;
        }

        const outputType = blob.type || mimeType;
        const extension = outputType.split('/')[1] ?? 'jpg';
        const filename = `${file.name.replace(/\.[^.]+$/, '')}-cropped.${extension}`;
        onApply(new File([blob], filename, { type: outputType, lastModified: Date.now() }));
        setProcessing(false);
    };

    return (
        <div
            role="presentation"
            onClick={onCancel}
            className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/60 p-4"
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-image-crop-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-lg space-y-4 bg-card p-5 text-foreground shadow-xl"
            >
                <div className="flex items-center justify-between gap-3">
                    <h2 id="product-image-crop-title" className="font-semibold">
                        {t('admin.cropImage')}
                    </h2>
                    <button type="button" onClick={onCancel} aria-label={t('common.cancel')} className="grid size-9 place-items-center">
                        <X size={18} />
                    </button>
                </div>
                <p className="text-sm text-muted-foreground">{t('admin.cropImageHelp')}</p>
                <div
                    className="relative mx-auto touch-none overflow-hidden bg-neutral-900"
                    style={{ width: cropSize, height: cropSize, maxWidth: '100%' }}
                    onPointerDown={(event) => {
                        drag.current = { x: event.clientX, y: event.clientY, offsetX, offsetY };
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                        if (!drag.current) return;
                        const movement = drag.current;
                        setOffset({
                            x: movement.offsetX + event.clientX - movement.x,
                            y: movement.offsetY + event.clientY - movement.y,
                        });
                    }}
                    onPointerUp={() => { drag.current = null; }}
                    onPointerCancel={() => { drag.current = null; }}
                >
                    {source ? (
                        <img
                            src={source.src}
                            alt=""
                            draggable={false}
                            className="pointer-events-none absolute max-w-none select-none"
                            style={{
                                width: imageWidth,
                                height: imageHeight,
                                left: '50%',
                                top: '50%',
                                transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
                            }}
                        />
                    ) : (
                        <div className="grid h-full place-items-center text-sm text-white">{t('admin.cropLoading')}</div>
                    )}
                </div>
                <label className="block text-sm">
                    {t('admin.cropZoom')}
                    <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        value={zoom}
                        onChange={(event) => setZoom(Number(event.target.value))}
                        className="mt-2 block w-full accent-primary"
                    />
                </label>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCancel} className="border border-input px-4 py-2 text-sm">
                        {t('common.cancel')}
                    </button>
                    <button type="button" disabled={!source || processing} onClick={() => void applyCrop()} className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                        <Check size={16} />
                        {t('admin.applyCrop')}
                    </button>
                </div>
            </section>
        </div>
    );
}

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
    const [newVariant, setNewVariant] = useState<NewVariantInput>({
        size: '',
        stock: '',
    });
    const nextVariantKey = useRef(1);
    const [newImagePreviews, setNewImagePreviews] = useState<
        { file: File; url: string }[]
    >([]);
    const [cropImageRequest, setCropImageRequest] = useState<ProductImageCropRequest | null>(null);
    const [cropImageError, setCropImageError] = useState('');
    const [draggedImageKey, setDraggedImageKey] = useState<string | null>(null);
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
            key: `saved-${variant.id}`,
            size: variant.size,
            stock: String(variant.stock),
        })) ?? [{ key: 'new-0', size: 'M', stock: '' }],
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
                size: variant.size,
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

    const sortableImages: SortableProductImage[] = [
        ...(product?.images
            .filter((image) => form.data.existing_images.includes(image.id))
            .map((image, index) => ({
                key: `existing:${image.id}`,
                kind: 'existing' as const,
                id: image.id,
                index,
                url: `/storage/${image.path}`,
                name: image.path.split('/').pop() ?? image.path,
                order: form.data.existing_image_orders[image.id] ?? image.sort_order,
            })) ?? []),
        ...newImagePreviews.map(({ file, url }, index) => ({
            key: `new:${index}`,
            kind: 'new' as const,
            index,
            url,
            name: file.name,
            order: form.data.image_orders[index] ?? (product?.images.length ?? 0) + index,
        })),
    ].sort((first, second) => first.order - second.order);

    const reorderImages = (sourceKey: string, targetKey: string): void => {
        if (sourceKey === targetKey) return;

        const reordered = [...sortableImages];
        const sourceIndex = reordered.findIndex((image) => image.key === sourceKey);
        const targetIndex = reordered.findIndex((image) => image.key === targetKey);
        if (sourceIndex < 0 || targetIndex < 0) return;

        const [image] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, image);

        const existingImageOrders = { ...form.data.existing_image_orders };
        const imageOrders = [...form.data.image_orders];
        reordered.forEach((item, position) => {
            if (item.kind === 'existing' && item.id !== undefined) {
                existingImageOrders[item.id] = position;
            } else if (item.kind === 'new') {
                imageOrders[item.index] = position;
            }
        });

        form.setData('existing_image_orders', existingImageOrders);
        form.setData('image_orders', imageOrders);
    };

    const openImageCrop = async (image: SortableProductImage): Promise<void> => {
        setCropImageError('');

        if (image.kind === 'new') {
            const file = form.data.images[image.index];
            if (file) {
                setCropImageRequest({ file, target: { kind: 'new', index: image.index } });
            }
            return;
        }

        if (image.id === undefined) return;

        try {
            const response = await fetch(image.url, { credentials: 'same-origin' });
            if (!response.ok) throw new Error('Image could not be loaded');

            const blob = await response.blob();
            const file = new File([blob], image.name, {
                type: blob.type || 'image/jpeg',
                lastModified: Date.now(),
            });
            setCropImageRequest({
                file,
                target: { kind: 'existing', id: image.id, order: image.order },
            });
        } catch {
            setCropImageError(t('admin.cropFailed'));
        }
    };

    const applyImageCrop = (croppedFile: File): void => {
        if (!cropImageRequest) return;

        if (cropImageRequest.target.kind === 'new') {
            const files = [...form.data.images];
            files[cropImageRequest.target.index] = croppedFile;
            form.setData('images', files);
            setNewImagePreviews(files.map((file) => ({
                file,
                url: URL.createObjectURL(file),
            })));
        } else {
            const { id, order } = cropImageRequest.target;
            const files = [...form.data.images, croppedFile];
            form.setData('images', files);
            form.setData('image_orders', [...form.data.image_orders, order]);
            form.setData('existing_images', form.data.existing_images.filter((imageId) => imageId !== id));
            const existingImageOrders = { ...form.data.existing_image_orders };
            delete existingImageOrders[id];
            form.setData('existing_image_orders', existingImageOrders);
            setNewImagePreviews(files.map((file) => ({
                file,
                url: URL.createObjectURL(file),
            })));
        }

        setCropImageRequest(null);
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
                                key={variant.key}
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
                                    disabled={form.data.variants.length <= 1}
                                    onClick={() =>
                                        form.setData(
                                            'variants',
                                            form.data.variants.filter(
                                                (_, itemIndex) =>
                                                    itemIndex !== index,
                                            ),
                                        )
                                    }
                                    className="px-3 font-medium text-destructive disabled:cursor-not-allowed disabled:opacity-40"
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
                                        {
                                            ...newVariant,
                                            key: `new-${nextVariantKey.current++}`,
                                        },
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
                                const lastSortOrder = sortableImages.reduce(
                                    (lastOrder, image) => Math.max(lastOrder, image.order),
                                    -1,
                                );
                                form.setData('images', files);
                                form.setData(
                                    'image_orders',
                                    files.map((_, index) => index < form.data.images.length
                                        ? form.data.image_orders[index] ?? lastSortOrder + index + 1
                                        : lastSortOrder + index - form.data.images.length + 1),
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
                    <p className="mt-4 text-xs text-muted-foreground">{t('admin.reorderImagesHelp')}</p>
                    <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                        {sortableImages.map((image) => (
                            <div
                                key={image.key}
                                data-image-sort-key={image.key}
                                className={`relative border border-border p-2 text-xs text-foreground transition-opacity ${draggedImageKey === image.key ? 'opacity-50' : ''}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => void openImageCrop(image)}
                                    aria-label={`${t('admin.cropImage')}: ${image.name}`}
                                    title={t('admin.cropImage')}
                                    className="group relative mb-2 block w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                    <img
                                        src={image.url}
                                        alt={image.name}
                                        className="aspect-square w-full object-cover"
                                        draggable={false}
                                    />
                                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-white/95 px-2 py-1 text-xs text-neutral-900 shadow-sm">
                                        <Crop size={14} aria-hidden="true" />
                                        {t('admin.cropImage')}
                                    </span>
                                </button>
                                <span className="block truncate">{image.name}</span>
                                <div className="mt-2 flex gap-2">
                                    <button
                                        type="button"
                                        aria-label={`${t('admin.reorderImage')}: ${image.name}`}
                                        title={t('admin.reorderImage')}
                                        onPointerDown={(event) => {
                                            event.preventDefault();
                                            event.currentTarget.setPointerCapture(event.pointerId);
                                            setDraggedImageKey(image.key);
                                        }}
                                        onPointerUp={(event) => {
                                            const target = document
                                                .elementFromPoint(event.clientX, event.clientY)
                                                ?.closest<HTMLElement>('[data-image-sort-key]')
                                                ?.dataset.imageSortKey;
                                            if (target) reorderImages(image.key, target);
                                            setDraggedImageKey(null);
                                        }}
                                        onPointerCancel={() => setDraggedImageKey(null)}
                                        onKeyDown={(event) => {
                                            if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) return;
                                            event.preventDefault();
                                            const imageIndex = sortableImages.findIndex((item) => item.key === image.key);
                                            const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
                                            const target = sortableImages[imageIndex + direction];
                                            if (target) reorderImages(image.key, target.key);
                                        }}
                                        className="inline-flex min-h-9 flex-1 touch-none cursor-grab items-center justify-center gap-1 border border-input px-2 active:cursor-grabbing"
                                    >
                                        <GripVertical size={15} aria-hidden="true" />
                                        {t('admin.reorderImage')}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (image.kind === 'existing' && image.id !== undefined) {
                                            form.setData('existing_images', form.data.existing_images.filter((id) => id !== image.id));
                                            return;
                                        }

                                        const files = form.data.images.filter((_, fileIndex) => fileIndex !== image.index);
                                        form.setData('images', files);
                                        form.setData('image_orders', form.data.image_orders.filter((_, fileIndex) => fileIndex !== image.index));
                                        setNewImagePreviews(files.map((selectedFile, fileIndex) => ({
                                            file: selectedFile,
                                            url: URL.createObjectURL(selectedFile),
                                        })));
                                    }}
                                    aria-label={`${t('admin.delete')}: ${image.name}`}
                                    title={t('admin.delete')}
                                    className="absolute right-3 top-3 grid size-8 place-items-center bg-white text-red-700 shadow-sm transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
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
            {cropImageError && <p role="alert" className="text-sm text-destructive">{cropImageError}</p>}
            {cropImageRequest && (
                <ProductImageCropDialog
                    key={`${cropImageRequest.file.name}-${cropImageRequest.target.kind}-${cropImageRequest.target.kind === 'new' ? cropImageRequest.target.index : cropImageRequest.target.id}`}
                    file={cropImageRequest.file}
                    onCancel={() => setCropImageRequest(null)}
                    onApply={applyImageCrop}
                />
            )}
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
