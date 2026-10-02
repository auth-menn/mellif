import { Head, Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { index as shopIndex } from '@/routes/shop';

type HomeSlide = {
    id: number;
    imageUrl: string;
    alt: string;
};

const fallbackSlides: HomeSlide[] = [
    { id: 1, imageUrl: '/images/home/look-01.webp', alt: '' },
    { id: 2, imageUrl: '/images/home/look-02.webp', alt: '' },
    { id: 3, imageUrl: '/images/home/look-03.webp', alt: '' },
    { id: 4, imageUrl: '/images/home/look-04.webp', alt: '' },
];

export default function Home({ heroImageUrl, productSlides }: { heroImageUrl: string; productSlides: HomeSlide[] }) {
    const { t } = useTranslation();
    const heroFrameRef = useRef<HTMLDivElement>(null);
    const heroVideoRef = useRef<HTMLVideoElement>(null);
    const carouselRef = useRef<HTMLElement>(null);
    const carouselFrameRef = useRef<HTMLDivElement>(null);
    const carouselTrackRef = useRef<HTMLDivElement>(null);
    const dragState = useRef<{ startX: number; startScrollLeft: number } | null>(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const [carouselVisible, setCarouselVisible] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const slides = productSlides.length > 1 ? productSlides : fallbackSlides;

    useEffect(() => {
        const frame = heroFrameRef.current;
        const carouselFrame = carouselFrameRef.current;
        const carousel = carouselRef.current;

        if (!frame || !carouselFrame || !carousel) {
            return;
        }

        let animationFrame = 0;

        const updateFrame = (): void => {
            if (animationFrame !== 0) {
                return;
            }

            animationFrame = window.requestAnimationFrame(() => {
                animationFrame = 0;
                const progress = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.28)));
                const sideInset = Math.max(0, Math.min(40, window.innerWidth * 0.03) * (1 - progress));
                const cornerRadius = 36 * (1 - progress);
                const frameWidth = frame.clientWidth;
                const frameHeight = frame.clientHeight;

                frame.style.clipPath = `path("M ${sideInset + cornerRadius} 0 H ${frameWidth - sideInset - cornerRadius} Q ${frameWidth - sideInset} 0 ${frameWidth - sideInset} ${cornerRadius} V ${frameHeight} H ${sideInset} V ${cornerRadius} Q ${sideInset} 0 ${sideInset + cornerRadius} 0 Z")`;
                frame.style.transform = `scale(${1 + progress * 0.025})`;

                const carouselProgress = Math.min(1, Math.max(0, (window.innerHeight - carousel.getBoundingClientRect().top) / (window.innerHeight * 0.35)));
                const carouselInset = Math.max(0, Math.min(40, window.innerWidth * 0.03) * (1 - carouselProgress));
                const carouselRadius = 68 * (1 - carouselProgress);

                carouselFrame.style.clipPath = `inset(0 ${carouselInset}px 0 ${carouselInset}px round ${carouselRadius}px)`;
                carouselFrame.style.transform = `scale(${1 + carouselProgress * 0.02})`;
            });
        };

        updateFrame();
        window.addEventListener('scroll', updateFrame, { passive: true });
        window.addEventListener('resize', updateFrame, { passive: true });

        return () => {
            window.removeEventListener('scroll', updateFrame);
            window.removeEventListener('resize', updateFrame);
            window.cancelAnimationFrame(animationFrame);
        };
    }, []);

    useEffect(() => {
        const video = heroVideoRef.current;
        const heroFrame = heroFrameRef.current;

        if (!video || !heroFrame) {
            return;
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !entry.isIntersecting) {
                video.pause();

                return;
            }

            void video.play().catch(() => undefined);
        }, { threshold: 0.1 });

        observer.observe(heroFrame);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const carousel = carouselRef.current;

        if (!carousel) {
            return;
        }

        const observer = new IntersectionObserver(([entry]) => {
            setCarouselVisible(entry.isIntersecting);
        }, { threshold: 0.35 });

        observer.observe(carousel);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const track = carouselTrackRef.current;

        if (!track || !carouselVisible || isDragging || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        let interval = 0;
        const startAutoplay = window.setTimeout(() => {
            interval = window.setInterval(() => {
                const currentSlide = Math.round(track.scrollLeft / track.clientWidth);
                const nextSlide = (currentSlide + 1) % slides.length;

                track.scrollTo({ left: nextSlide * track.clientWidth, behavior: 'smooth' });
            }, 2000);
        }, 4000);

        return () => {
            window.clearTimeout(startAutoplay);
            window.clearInterval(interval);
        };
    }, [carouselVisible, isDragging, slides.length]);

    return (
        <>
            <Head title={t('home.title')} />
            <main className="bg-white">
                <section className="relative h-[130svh] bg-black" aria-label={t('home.collection')}>
                    <div className="sticky top-14 mx-auto h-[calc(100svh-56px)] w-full md:top-16 md:h-[calc(100svh-64px)]">
                        <Link href={shopIndex.url()} aria-label={t('nav.shop')} className="absolute inset-0 z-10 cursor-pointer" />
                        <div ref={heroFrameRef} className="absolute inset-0 overflow-hidden bg-neutral-900 [will-change:clip-path,transform]">
                            <video
                                ref={heroVideoRef}
                                aria-hidden="true"
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                poster={heroImageUrl}
                                className="h-full w-full object-cover"
                            >
                                <source src="/videos/home-campaign.mp4" type="video/mp4" />
                            </video>
                            <div className="pointer-events-none absolute inset-0 bg-black/10" />
                        </div>
                    </div>
                </section>

                <section
                    ref={carouselRef}
                    className="relative isolate grid min-h-[100svh] cursor-grab touch-pan-y select-none place-items-center overflow-hidden bg-white active:cursor-grabbing"
                    aria-label={t('home.collection')}
                >
                    <div ref={carouselFrameRef} className="absolute inset-0 overflow-hidden bg-black [will-change:clip-path,transform]">
                        <div
                            ref={carouselTrackRef}
                            className="absolute inset-0 flex cursor-grab snap-x snap-mandatory touch-pan-y select-none overflow-x-auto overscroll-x-contain active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            onPointerDown={(event) => {
                                if (event.button !== 0) {
                                    return;
                                }

                                dragState.current = { startX: event.clientX, startScrollLeft: event.currentTarget.scrollLeft };
                                event.currentTarget.style.scrollBehavior = 'auto';
                                event.currentTarget.style.scrollSnapType = 'none';
                                event.currentTarget.setPointerCapture(event.pointerId);
                                setIsDragging(true);
                            }}
                            onPointerMove={(event) => {
                                const currentDrag = dragState.current;

                                if (currentDrag !== null) {
                                    event.currentTarget.scrollLeft = currentDrag.startScrollLeft - (event.clientX - currentDrag.startX);
                                }
                            }}
                            onPointerUp={(event) => {
                                dragState.current = null;
                                setIsDragging(false);
                                event.currentTarget.style.scrollBehavior = '';
                                event.currentTarget.style.scrollSnapType = '';
                            }}
                            onPointerCancel={(event) => {
                                dragState.current = null;
                                setIsDragging(false);
                                event.currentTarget.style.scrollBehavior = '';
                                event.currentTarget.style.scrollSnapType = '';
                            }}
                            onLostPointerCapture={(event) => {
                                dragState.current = null;
                                setIsDragging(false);
                                event.currentTarget.style.scrollBehavior = '';
                                event.currentTarget.style.scrollSnapType = '';
                            }}
                            onScroll={(event) => {
                                const track = event.currentTarget;
                                const currentSlide = Math.round(track.scrollLeft / track.clientWidth);

                                setActiveSlide(Math.min(currentSlide, slides.length - 1));
                            }}
                        >
                            {slides.map((slide, index) => (
                                <div key={slide.id} className="relative h-full w-full min-w-full shrink-0 snap-start">
                                    <img
                                        src={slide.imageUrl}
                                        alt={slide.alt}
                                        draggable={false}
                                        aria-hidden={index !== activeSlide}
                                        fetchPriority={index === 0 ? 'high' : 'low'}
                                        decoding="async"
                                        className="h-full w-full select-none object-cover"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="pointer-events-none absolute inset-0 bg-black/10" />
                    </div>
                </section>
            </main>
        </>
    );
}
