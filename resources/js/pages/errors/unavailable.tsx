import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, House } from 'lucide-react';
import { home } from '@/routes';
import { useTranslation } from '@/hooks/use-translation';

export default function Unavailable({ status }: { status: number }) {
    const { t } = useTranslation();

    return <>
        <Head title={`${status} — ${t('unavailable.title')}`} />
        <main className="relative grid min-h-screen justify-items-center bg-black px-6 pt-8 pb-24 text-white sm:pt-12">
            <section className="flex w-full max-w-2xl flex-col items-center gap-5 text-center">
                <video src="/videos/mellif-logo.webm" autoPlay loop muted playsInline aria-hidden="true" className="h-48 w-96 object-contain sm:h-64 sm:w-[32rem]" />
                <p className="text-7xl font-light tracking-tight sm:text-8xl">{status}</p>
                <h1 className="text-2xl font-medium">{t('unavailable.title')}</h1>
            </section>
            <Link href={home.url()} className="absolute bottom-8 left-1/2 inline-flex -translate-x-1/2 items-center justify-center gap-2 whitespace-nowrap bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-neutral-200">
                <ArrowLeft size={16} />
                <House size={16} />
                {t('unavailable.home')}
            </Link>
        </main>
    </>;
}
