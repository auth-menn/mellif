import { Head } from '@inertiajs/react';
import { useTranslation } from '@/hooks/use-translation';

export default function About() {
    const { t } = useTranslation();
    return <><Head title={`${t('nav.about')} — Mellif`} /><main className="mx-auto min-h-screen max-w-5xl px-6 pb-24 pt-36"><p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{t('about.eyebrow')}</p><h1 className="mt-5 max-w-3xl whitespace-pre-line text-5xl font-medium leading-tight md:text-7xl">{t('about.title')}</h1><p className="mt-10 max-w-2xl text-lg leading-8 text-neutral-600">{t('about.body')}</p></main></>;
}
