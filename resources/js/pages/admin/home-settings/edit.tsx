import { Head, useForm } from '@inertiajs/react';
import { Check, Crop, GripVertical, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import adminRoutes from '@/routes/admin';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';

type HomeMedia = {
    path: string;
    url: string;
    productId: number | null;
};

type ProductOption = { id: number; name: string; slug: string };

type HomeSettingsProps = {
    heroVideos: HomeMedia[];
    page2Images: HomeMedia[];
    products: ProductOption[];
};

type ImageEntry = {
    key: string;
    kind: 'existing' | 'upload';
    index: number;
    url: string;
    name: string;
    productId: string;
};

function ImageCropDialog({ file, onCancel, onApply }: { file: File; onCancel: () => void; onApply: (file: File) => void }) {
    const { t } = useTranslation();
    const [source, setSource] = useState<HTMLImageElement | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const cropFailedMessage = t('admin.cropFailed');
    const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
    const cropMaxSize = 240;

    useEffect(() => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => setSource(image);
        image.onerror = () => setError(cropFailedMessage);
        image.src = url;
        return () => URL.revokeObjectURL(url);
    }, [file, cropFailedMessage]);

    const aspectRatio = source ? source.naturalWidth / source.naturalHeight : 1;
    const cropWidth = aspectRatio >= 1 ? cropMaxSize : cropMaxSize * aspectRatio;
    const cropHeight = aspectRatio >= 1 ? cropMaxSize / aspectRatio : cropMaxSize;
    const scale = source ? Math.max(cropWidth / source.naturalWidth, cropHeight / source.naturalHeight) * zoom : 1;
    const imageWidth = source ? source.naturalWidth * scale : cropMaxSize;
    const imageHeight = source ? source.naturalHeight * scale : cropMaxSize;
    const offsetX = Math.max(-((imageWidth - cropWidth) / 2), Math.min((imageWidth - cropWidth) / 2, offset.x));
    const offsetY = Math.max(-((imageHeight - cropHeight) / 2), Math.min((imageHeight - cropHeight) / 2, offset.y));

    const applyCrop = async (): Promise<void> => {
        if (!source) return;
        setProcessing(true);
        const canvas = document.createElement('canvas');
        const outputWidth = aspectRatio >= 1 ? 1200 : Math.round(1200 * aspectRatio);
        const outputHeight = aspectRatio >= 1 ? Math.round(1200 / aspectRatio) : 1200;
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            setError(t('admin.cropFailed'));
            setProcessing(false);
            return;
        }

        const sourceX = (imageWidth / 2 - cropWidth / 2 - offsetX) / scale;
        const sourceY = (imageHeight / 2 - cropHeight / 2 - offsetY) / scale;
        const sourceWidth = cropWidth / scale;
        const sourceHeight = cropHeight / scale;
        context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
        const mimeType = file.type || 'image/jpeg';
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.92));
        if (!blob) {
            setError(t('admin.cropFailed'));
            setProcessing(false);
            return;
        }

        const outputType = blob.type || mimeType;
        const extension = outputType.split('/')[1] ?? 'jpg';
        onApply(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-cropped.${extension}`, { type: outputType, lastModified: Date.now() }));
        setProcessing(false);
    };

    return (
        <div role="presentation" onClick={onCancel} className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/60 p-4">
            <section role="dialog" aria-modal="true" aria-labelledby="home-image-crop-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-lg space-y-4 bg-card p-5 text-foreground shadow-xl">
                <div className="flex items-center justify-between gap-3"><h2 id="home-image-crop-title" className="font-semibold">{t('admin.cropImage')}</h2><button type="button" onClick={onCancel} aria-label={t('common.cancel')} className="grid size-9 place-items-center"><X size={18} /></button></div>
                <p className="text-sm text-muted-foreground">{t('admin.cropImageHelp')}</p>
                <div className="relative mx-auto touch-none overflow-hidden bg-neutral-900" style={{ width: cropWidth, height: cropHeight, maxWidth: '100%' }}
                    onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, offsetX, offsetY }; event.currentTarget.setPointerCapture(event.pointerId); }}
                    onPointerMove={(event) => { if (drag.current) setOffset({ x: drag.current.offsetX + event.clientX - drag.current.x, y: drag.current.offsetY + event.clientY - drag.current.y }); }}
                    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
                    {source ? <img src={source.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ width: imageWidth, height: imageHeight, left: '50%', top: '50%', transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))` }} /> : <div className="grid h-full place-items-center text-sm text-white">{t('admin.cropLoading')}</div>}
                </div>
                <label className="block text-sm">{t('admin.cropZoom')}<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="mt-2 block w-full accent-primary" /></label>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="border border-input px-4 py-2 text-sm">{t('common.cancel')}</button><button type="button" disabled={!source || processing} onClick={() => void applyCrop()} className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Check size={16} />{t('admin.applyCrop')}</button></div>
            </section>
        </div>
    );
}

function UploadPreview({ file, type, onRemove, removeLabel }: { file: File; type: 'image' | 'video'; onRemove: () => void; removeLabel: string }) {
    const [previewUrl, setPreviewUrl] = useState('');

    useEffect(() => {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [file]);

    return (
        <div className="relative space-y-2 border border-border p-3 text-sm">
            <button type="button" onClick={onRemove} aria-label={removeLabel} title={removeLabel} className="absolute right-2 top-2 z-10 rounded-full bg-white p-1.5 text-foreground shadow hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <X size={16} />
            </button>
            {type === 'video' ? (
                <video src={previewUrl || undefined} controls preload="metadata" className="aspect-video w-full bg-black object-contain" />
            ) : (
                <img src={previewUrl || undefined} alt={file.name} className="aspect-[3/4] w-full object-cover" />
            )}
            <span className="block break-all text-xs text-muted-foreground">{file.name}</span>
        </div>
    );
}

function appendFiles(current: File[], selected: File[]): File[] {
    const files = [...current];

    for (const file of selected) {
        const isAlreadySelected = files.some((existingFile) =>
            existingFile.name === file.name
            && existingFile.size === file.size
            && existingFile.lastModified === file.lastModified,
        );

        if (!isAlreadySelected) {
            files.push(file);
        }
    }

    return files;
}

export default function HomeSettingsEdit({ heroVideos, page2Images, products }: HomeSettingsProps) {
    const { t } = useTranslation();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const form = useForm({
        hero_videos: [] as File[],
        remove_hero_video_indexes: [] as number[],
        page2_images: [] as File[],
        page2_product_ids: page2Images.map((image) => image.productId?.toString() ?? ''),
        page2_upload_product_ids: [] as string[],
        remove_page2_image_indexes: [] as number[],
        page2_image_order: [...page2Images.map((_, index) => `existing-${index}`)],
    });
    const [cropTarget, setCropTarget] = useState<{ file: File; key: string } | null>(null);
    const [draggedImageKey, setDraggedImageKey] = useState<string | null>(null);
    const [uploadPreviewUrls, setUploadPreviewUrls] = useState<string[]>([]);

    useEffect(() => {
        const urls = form.data.page2_images.map((file) => URL.createObjectURL(file));
        setUploadPreviewUrls(urls);
        return () => urls.forEach((url) => URL.revokeObjectURL(url));
    }, [form.data.page2_images]);

    const imageEntries: ImageEntry[] = [
        ...page2Images.map((image, index) => ({
            key: `existing-${index}`, kind: 'existing' as const, index, url: image.url,
            name: image.path.split('/').pop() ?? image.path,
            productId: form.data.page2_product_ids[index] ?? image.productId?.toString() ?? '',
        })).filter((image) => !form.data.remove_page2_image_indexes.includes(image.index)),
        ...form.data.page2_images.map((file, index) => ({
            key: `upload-${index}`, kind: 'upload' as const, index,
            url: uploadPreviewUrls[index] ?? '', name: file.name,
            productId: form.data.page2_upload_product_ids[index] ?? '',
        })),
    ].sort((first, second) => {
        const firstOrder = form.data.page2_image_order.indexOf(first.key);
        const secondOrder = form.data.page2_image_order.indexOf(second.key);
        return (firstOrder < 0 ? Number.MAX_SAFE_INTEGER : firstOrder) - (secondOrder < 0 ? Number.MAX_SAFE_INTEGER : secondOrder);
    });

    const reorderImage = (sourceKey: string, targetKey: string): void => {
        if (sourceKey === targetKey) return;
        const order = imageEntries.map((image) => image.key);
        const sourceIndex = order.indexOf(sourceKey);
        const targetIndex = order.indexOf(targetKey);
        if (sourceIndex < 0 || targetIndex < 0) return;
        const [moved] = order.splice(sourceIndex, 1);
        order.splice(targetIndex, 0, moved);
        form.setData('page2_image_order', order);
    };

    const openCrop = async (image: ImageEntry): Promise<void> => {
        if (image.kind === 'upload') {
            const file = form.data.page2_images[image.index];
            if (file) setCropTarget({ file, key: image.key });
            return;
        }
        try {
            const response = await fetch(image.url, { credentials: 'same-origin' });
            if (!response.ok) throw new Error('Image could not be loaded');
            const blob = await response.blob();
            setCropTarget({ file: new File([blob], image.name, { type: blob.type || 'image/jpeg' }), key: image.key });
        } catch {
            form.setError('page2_images', t('admin.cropFailed'));
        }
    };

    const applyCrop = (file: File): void => {
        if (!cropTarget) return;
        if (cropTarget.key.startsWith('existing-')) {
            const existingIndex = Number(cropTarget.key.slice('existing-'.length));
            const uploadIndex = form.data.page2_images.length;
            form.setData('remove_page2_image_indexes', [...form.data.remove_page2_image_indexes, existingIndex]);
            form.setData('page2_images', [...form.data.page2_images, file]);
            form.setData('page2_upload_product_ids', [...form.data.page2_upload_product_ids, form.data.page2_product_ids[existingIndex] ?? '']);
            form.setData('page2_image_order', form.data.page2_image_order.map((key) => key === cropTarget.key ? `upload-${uploadIndex}` : key));
        } else {
            const uploadIndex = Number(cropTarget.key.slice('upload-'.length));
            form.setData('page2_images', form.data.page2_images.map((image, index) => index === uploadIndex ? file : image));
        }
        setCropTarget(null);
    };

    const submit = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        setConfirmOpen(true);
    };

    const saveSettings = (): void => {
        form.transform((data) => ({ ...data, _method: 'put' }));
        form.post(adminRoutes.homeSettings.update.url(), { forceFormData: true, onFinish: () => setConfirmOpen(false) });
    };

    return (
        <>
            <Head title={t('admin.homeSettings')} />
            <form onSubmit={submit} className="w-full space-y-7 border border-border bg-card p-5 text-foreground md:p-8">
                <fieldset className="space-y-4 border border-border p-4 md:p-5">
                    <legend className="px-2 text-lg font-medium">{t('admin.pageOneVideos')}</legend>
                    <label className="block text-sm">
                        {t('admin.uploadPageOneVideos')}
                        <input
                            type="file"
                            multiple
                            accept="video/mp4,video/webm,.mp4,.webm"
                            onChange={(event) => {
                                form.setData('hero_videos', appendFiles(form.data.hero_videos, Array.from(event.currentTarget.files ?? [])));
                                event.currentTarget.value = '';
                            }}
                            className="mt-2 block w-full border border-input bg-card p-3 text-foreground"
                        />
                    </label>
                    {form.errors.hero_videos && <p className="text-xs text-destructive">{form.errors.hero_videos}</p>}
                    {form.errors['hero_videos.0'] && <p className="text-xs text-destructive">{form.errors['hero_videos.0']}</p>}
                    {form.data.hero_videos.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {form.data.hero_videos.map((file, index) => <UploadPreview key={`${file.name}-${file.lastModified}-${index}`} file={file} type="video" removeLabel={t('admin.removeOnSave')} onRemove={() => form.setData('hero_videos', form.data.hero_videos.filter((_, fileIndex) => fileIndex !== index))} />)}
                        </div>
                    )}
                    {heroVideos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('admin.noHomeVideos')}</p>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {heroVideos.map((video, index) => form.data.remove_hero_video_indexes.includes(index) ? null : (
                                <div key={video.path} className="relative space-y-2 border border-border p-3 text-sm">
                                    <button type="button" aria-label={t('admin.removeOnSave')} title={t('admin.removeOnSave')} onClick={() => form.setData('remove_hero_video_indexes', [...form.data.remove_hero_video_indexes, index])} className="absolute right-2 top-2 z-10 rounded-full bg-white p-1.5 text-foreground shadow hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                                        <X size={16} />
                                    </button>
                                    <video src={video.url} controls preload="metadata" className="aspect-video w-full bg-black object-contain" />
                                    <span className="block break-all text-xs text-muted-foreground">{video.path}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </fieldset>

                <fieldset className="space-y-4 border border-border p-4 md:p-5">
                    <legend className="px-2 text-lg font-medium">{t('admin.pageTwoImages')}</legend>
                    <label className="block text-sm">
                        {t('admin.uploadPageTwoImages')}
                        <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                                const files = appendFiles(form.data.page2_images, Array.from(event.currentTarget.files ?? []));
                                const addedFiles = files.slice(form.data.page2_images.length);
                                const startIndex = form.data.page2_images.length;
                                form.setData('page2_images', files);
                                form.setData('page2_upload_product_ids', [...form.data.page2_upload_product_ids, ...addedFiles.map(() => '')]);
                                form.setData('page2_image_order', [...form.data.page2_image_order, ...addedFiles.map((_, index) => `upload-${startIndex + index}`)]);
                                event.currentTarget.value = '';
                            }}
                            className="mt-2 block w-full border border-input bg-card p-3 text-foreground"
                        />
                    </label>
                    {imageEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('admin.noHomeImages')}</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {imageEntries.map((image) => (
                                <div key={image.key} data-home-image-key={image.key} className={`relative space-y-2 border border-border p-3 text-sm transition-opacity ${draggedImageKey === image.key ? 'opacity-50' : ''}`}>
                                    <button type="button" aria-label={t('admin.removeOnSave')} title={t('admin.removeOnSave')} onClick={() => {
                                        let nextOrder = form.data.page2_image_order;
                                        if (image.kind === 'existing') {
                                            form.setData('remove_page2_image_indexes', [...form.data.remove_page2_image_indexes, image.index]);
                                        } else {
                                            const files = form.data.page2_images.filter((_, index) => index !== image.index);
                                            const links = form.data.page2_upload_product_ids.filter((_, index) => index !== image.index);
                                            nextOrder = form.data.page2_image_order.filter((key) => key !== image.key).map((key) => {
                                                if (!key.startsWith('upload-')) return key;
                                                const uploadIndex = Number(key.slice('upload-'.length));
                                                return `upload-${uploadIndex > image.index ? uploadIndex - 1 : uploadIndex}`;
                                            });
                                            form.setData('page2_images', files);
                                            form.setData('page2_upload_product_ids', links);
                                        }
                                        form.setData('page2_image_order', image.kind === 'existing' ? nextOrder.filter((key) => key !== image.key) : nextOrder);
                                    }} className="absolute right-2 top-2 z-10 rounded-full bg-white p-1.5 text-foreground shadow hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                                        <X size={16} />
                                    </button>
                                    <button type="button" onClick={() => void openCrop(image)} aria-label={`${t('admin.cropImage')}: ${image.name}`} title={t('admin.cropImage')} className="group relative block w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                                        <img src={image.url} alt={image.name} className="aspect-[3/4] w-full object-cover" draggable={false} />
                                        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-white/95 px-2 py-1 text-xs text-neutral-900 shadow-sm"><Crop size={14} aria-hidden="true" />{t('admin.cropImage')}</span>
                                    </button>
                                    <span className="block break-all text-xs text-muted-foreground">{image.name}</span>
                                    <button type="button" aria-label={t('admin.reorderImage')} title={t('admin.reorderImage')} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDraggedImageKey(image.key); }} onPointerUp={(event) => {
                                        const targetKey = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-home-image-key]')?.dataset.homeImageKey;
                                        if (targetKey) reorderImage(image.key, targetKey);
                                        setDraggedImageKey(null);
                                    }} onPointerCancel={() => setDraggedImageKey(null)} onKeyDown={(event) => {
                                        if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) return;
                                        event.preventDefault();
                                        const index = imageEntries.findIndex((entry) => entry.key === image.key);
                                        const target = imageEntries[index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)];
                                        if (target) reorderImage(image.key, target.key);
                                    }} className="inline-flex min-h-9 w-full touch-none cursor-grab items-center justify-center gap-1 border border-input px-2 active:cursor-grabbing"><GripVertical size={15} aria-hidden="true" />{t('admin.reorderImage')}</button>
                                    <label className="block text-xs">{t('admin.linkProduct')}<select value={image.productId} onChange={(event) => {
                                        if (image.kind === 'existing') {
                                            form.setData('page2_product_ids', form.data.page2_product_ids.map((id, index) => index === image.index ? event.target.value : id));
                                        } else {
                                            form.setData('page2_upload_product_ids', form.data.page2_upload_product_ids.map((id, index) => index === image.index ? event.target.value : id));
                                        }
                                    }} className="mt-1 w-full border border-input bg-card p-2 text-foreground"><option value="">{t('admin.noLinkedProduct')}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
                                </div>
                            ))}
                        </div>
                    )}
                    {form.errors.page2_images && <p className="text-xs text-destructive">{form.errors.page2_images}</p>}
                    {form.errors['page2_images.0'] && <p className="text-xs text-destructive">{form.errors['page2_images.0']}</p>}
                </fieldset>

                <button disabled={form.processing} className="bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
                    {form.processing ? t('admin.saving') : t('admin.saveHome')}
                </button>
            </form>
            {cropTarget && <ImageCropDialog key={`${cropTarget.key}-${cropTarget.file.name}`} file={cropTarget.file} onCancel={() => setCropTarget(null)} onApply={applyCrop} />}
            <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={saveSettings} processing={form.processing} title={t('admin.confirmTitle')} description={t('admin.confirmUpdate')} confirmLabel={t('admin.confirm')} cancelLabel={t('common.cancel')} />
        </>
    );
}
