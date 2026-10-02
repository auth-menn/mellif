import { Head, Link } from '@inertiajs/react';
import { index as shopIndex } from '@/routes/shop';
import { useTranslation } from '@/hooks/use-translation';

export default function Home({ tagline, heroImageUrl }: { tagline: string; heroImageUrl: string }) {
    const { t } = useTranslation();
    const visibleTagline = tagline === 'Made to move with your own rhythm.' ? t('home.tagline') : tagline;
    return <><Head title="Mellif — Local Goods" /><main className="relative grid h-[100svh] min-h-[620px] place-items-center overflow-hidden bg-neutral-800 text-white"><img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-black/35" /><section className="relative mt-12 px-6 text-center"><p className="mb-5 text-xs uppercase tracking-[0.38em] md:text-sm">{t('home.eyebrow')}</p><h1 className="max-w-4xl whitespace-pre-line text-5xl font-semibold tracking-tight md:text-7xl">{visibleTagline}</h1><Link href={shopIndex.url()} className="mt-9 inline-flex border border-white px-10 py-4 text-sm font-medium uppercase tracking-[0.2em] transition hover:bg-white hover:text-black">{t('home.shopNow')}</Link></section><p className="absolute bottom-8 left-8 text-xs uppercase tracking-[0.25em]">{t('home.collection')}</p></main></>;
}
