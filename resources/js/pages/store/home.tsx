import { Head, Link } from '@inertiajs/react';
import { index as shopIndex } from '@/routes/shop';

export default function Home() {
    return <><Head title="Mellif — Local Goods" /><main className="relative grid h-[100svh] min-h-[620px] place-items-center overflow-hidden bg-neutral-800 text-white"><img src="/images/hero.svg" alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-black/35" /><section className="relative mt-12 px-6 text-center"><p className="mb-5 text-xs uppercase tracking-[0.38em] md:text-sm">Independent local label</p><h1 className="max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">Made to move<br />with your own rhythm.</h1><Link href={shopIndex.url()} className="mt-9 inline-flex border border-white px-10 py-4 text-sm font-medium uppercase tracking-[0.2em] transition hover:bg-white hover:text-black">Shop Now</Link></section><p className="absolute bottom-8 left-8 text-xs uppercase tracking-[0.25em]">Mellif / Collection 01</p></main></>;
}
