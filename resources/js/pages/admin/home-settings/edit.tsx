import { Head, useForm } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
    });

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
                                form.setData('page2_images', appendFiles(form.data.page2_images, Array.from(event.currentTarget.files ?? [])));
                                const addedFiles = appendFiles(form.data.page2_images, Array.from(event.currentTarget.files ?? [])).slice(form.data.page2_images.length);
                                form.setData('page2_upload_product_ids', [...form.data.page2_upload_product_ids, ...addedFiles.map(() => '')]);
                                event.currentTarget.value = '';
                            }}
                            className="mt-2 block w-full border border-input bg-card p-3 text-foreground"
                        />
                    </label>
                    {form.errors.page2_images && <p className="text-xs text-destructive">{form.errors.page2_images}</p>}
                    {form.errors['page2_images.0'] && <p className="text-xs text-destructive">{form.errors['page2_images.0']}</p>}
                    {form.data.page2_images.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {form.data.page2_images.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="space-y-2"><UploadPreview file={file} type="image" removeLabel={t('admin.removeOnSave')} onRemove={() => { form.setData('page2_images', form.data.page2_images.filter((_, fileIndex) => fileIndex !== index)); form.setData('page2_upload_product_ids', form.data.page2_upload_product_ids.filter((_, productIndex) => productIndex !== index)); }} /><label className="block text-xs">{t('admin.linkProduct')}<select value={form.data.page2_upload_product_ids[index] ?? ''} onChange={(event) => form.setData('page2_upload_product_ids', form.data.page2_upload_product_ids.map((id, productIndex) => productIndex === index ? event.target.value : id))} className="mt-1 w-full border border-input bg-card p-2 text-foreground"><option value="">{t('admin.noLinkedProduct')}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label></div>)}
                        </div>
                    )}
                    {page2Images.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('admin.noHomeImages')}</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {page2Images.map((image, index) => form.data.remove_page2_image_indexes.includes(index) ? null : (
                                <div key={image.path} className="relative space-y-2 border border-border p-3 text-sm">
                                    <button type="button" aria-label={t('admin.removeOnSave')} title={t('admin.removeOnSave')} onClick={() => form.setData('remove_page2_image_indexes', [...form.data.remove_page2_image_indexes, index])} className="absolute right-2 top-2 z-10 rounded-full bg-white p-1.5 text-foreground shadow hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                                        <X size={16} />
                                    </button>
                                    <img src={image.url} alt="" className="aspect-[3/4] w-full object-cover" />
                                    <span className="block break-all text-xs text-muted-foreground">{image.path}</span>
                                    <label className="block text-xs">{t('admin.linkProduct')}<select value={form.data.page2_product_ids[index] ?? ''} onChange={(event) => form.setData('page2_product_ids', form.data.page2_product_ids.map((id, productIndex) => productIndex === index ? event.target.value : id))} className="mt-1 w-full border border-input bg-card p-2 text-foreground"><option value="">{t('admin.noLinkedProduct')}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
                                </div>
                            ))}
                        </div>
                    )}
                </fieldset>

                <button disabled={form.processing} className="bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
                    {form.processing ? t('admin.saving') : t('admin.saveHome')}
                </button>
            </form>
            <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={saveSettings} processing={form.processing} title={t('admin.confirmTitle')} description={t('admin.confirmUpdate')} confirmLabel={t('admin.confirm')} cancelLabel={t('common.cancel')} />
        </>
    );
}
