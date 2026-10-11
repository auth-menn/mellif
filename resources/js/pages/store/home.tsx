import { Head, Link, router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { index as shopIndex, show as shopShow } from '@/routes/shop';

type HomeSlide = {
    id: number;
    imageUrl: string;
    alt: string;
    productUrl?: string | null;
};

const fallbackSlides: HomeSlide[] = [
    { id: 1, imageUrl: '/images/home/look-01.webp', alt: '' },
    { id: 2, imageUrl: '/images/home/look-02.webp', alt: '' },
    { id: 3, imageUrl: '/images/home/look-03.webp', alt: '' },
    { id: 4, imageUrl: '/images/home/look-04.webp', alt: '' },
];

export default function Home({ heroImageUrl, heroVideos, productSlides }: { heroImageUrl: string; heroVideos: string[]; productSlides: HomeSlide[] }) {
    const { t } = useTranslation();
    const heroFrameRef = useRef<HTMLDivElement>(null);
    const heroVideoRef = useRef<HTMLVideoElement>(null);
    const carouselRef = useRef<HTMLElement>(null);
    const carouselFrameRef = useRef<HTMLDivElement>(null);
    const dragState = useRef<number | null>(null);
    const suppressSlideClick = useRef(false);
    const pendingDirection = useRef<-1 | 1 | null>(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const [carouselVisible, setCarouselVisible] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [carouselAspectRatio, setCarouselAspectRatio] = useState(1);
    const [activeHeroVideoIndex, setActiveHeroVideoIndex] = useState(0);
    const [heroVisible, setHeroVisible] = useState(false);
    const slides = productSlides.length > 0 ? productSlides : fallbackSlides;
    const activeHeroVideo = heroVideos[activeHeroVideoIndex] ?? heroVideos[0];

    const completeTransition = useCallback((): void => {
        const direction = pendingDirection.current;

        if (direction === null) {
            return;
        }

        pendingDirection.current = null;
        setIsResetting(true);
        setActiveSlide((currentSlide) => (currentSlide + direction + slides.length) % slides.length);
        window.requestAnimationFrame(() => {
            if (dragState.current === null) {
                carouselFrameRef.current?.style.setProperty('--drag-offset', '0px');
            }
            window.requestAnimationFrame(() => setIsResetting(false));
        });
    }, [slides.length]);

    const transitionSlide = useCallback((direction: -1 | 1): void => {
        if (pendingDirection.current !== null) {
            return;
        }

        const frameWidth = carouselFrameRef.current?.clientWidth ?? 0;

        if (frameWidth === 0) {
            setActiveSlide((currentSlide) => (currentSlide + direction + slides.length) % slides.length);

            return;
        }

        pendingDirection.current = direction;
        setIsDragging(false);
        window.requestAnimationFrame(() => {
            if (pendingDirection.current === direction) {
                carouselFrameRef.current?.style.setProperty('--drag-offset', `${direction === 1 ? -frameWidth : frameWidth}px`);
            }
        });
    }, [slides.length]);

    useEffect(() => {
        const frame = heroFrameRef.current;

        if (!frame) {
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
        const heroFrame = heroFrameRef.current;

        if (!heroFrame) {
            return;
        }

        const observer = new IntersectionObserver(([entry]) => {
            const video = heroVideoRef.current;

            if (!video) {
                return;
            }

            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !entry.isIntersecting) {
                video.pause();
                setHeroVisible(false);

                return;
            }

            setHeroVisible(true);
            void video.play().catch(() => undefined);
        }, { threshold: 0.1 });

        observer.observe(heroFrame);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const video = heroVideoRef.current;

        if (!video || !activeHeroVideo) {
            return;
        }

        video.load();

        if (heroVisible && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            void video.play().catch(() => undefined);
        }
    }, [activeHeroVideo, heroVisible]);

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
        if (!carouselVisible || isDragging || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const nextSlide = window.setTimeout(() => {
            transitionSlide(1);
        }, 5000);

        return () => {
            window.clearTimeout(nextSlide);
        };
    }, [activeSlide, carouselVisible, isDragging, slides.length, transitionSlide]);

    return (
        <>
            <Head title={t('home.title')} />
            <main className="overflow-x-clip bg-white">
                <section className="relative h-[115svh] bg-black sm:h-[120svh] landscape:max-xl:h-[110svh] xl:h-[130svh]" aria-label={t('home.collection')}>
                    <div className="sticky top-12 mx-auto h-[calc(100svh-3rem)] w-full sm:top-14 sm:h-[calc(100svh-3.5rem)] md:top-16 md:h-[calc(100svh-4rem)] landscape:max-xl:top-12 landscape:max-xl:h-[calc(100svh-3rem)]">
                        <Link href={shopIndex.url()} aria-label={t('nav.shop')} className="absolute inset-0 z-10 cursor-pointer" />
                        <div ref={heroFrameRef} className="absolute inset-0 overflow-hidden bg-neutral-900 [will-change:clip-path,transform]">
                            <video
                                key={activeHeroVideo}
                                ref={heroVideoRef}
                                aria-hidden="true"
                                muted
                                loop={heroVideos.length === 1}
                                playsInline
                                preload="metadata"
                                poster={heroImageUrl}
                                src={activeHeroVideo}
                                onEnded={() => setActiveHeroVideoIndex((index) => (index + 1) % heroVideos.length)}
                                className="h-full w-full object-cover"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-black/10" />
                        </div>
                    </div>
                </section>

                <section
                    ref={carouselRef}
                    className="relative isolate w-full cursor-grab touch-pan-y select-none overflow-hidden bg-white active:cursor-grabbing"
                    aria-label={t('home.collection')}
                >
                    <div
                        ref={carouselFrameRef}
                        className="home-carousel-frame relative w-full cursor-grab overflow-hidden bg-black active:cursor-grabbing"
                        style={{ '--home-carousel-aspect-ratio': carouselAspectRatio } as CSSProperties}
                        onPointerDown={(event) => {
                            if (event.button !== 0) {
                                return;
                            }

                            if (pendingDirection.current !== null) {
                                completeTransition();
                                event.currentTarget.style.setProperty('--drag-offset', '0px');
                            }

                            dragState.current = event.clientX;
                            suppressSlideClick.current = false;
                            event.currentTarget.setPointerCapture(event.pointerId);
                            event.currentTarget.style.setProperty('--drag-offset', '0px');
                            setIsDragging(true);
                        }}
                        role={slides[activeSlide].productUrl ? 'link' : undefined}
                        tabIndex={slides[activeSlide].productUrl ? 0 : undefined}
                        aria-label={slides[activeSlide].productUrl ? slides[activeSlide].alt : undefined}
                        onClick={(event) => {
                            if (suppressSlideClick.current) {
                                event.preventDefault();
                                suppressSlideClick.current = false;

                                return;
                            }

                            const productUrl = slides[activeSlide].productUrl;

                            if (productUrl) {
                                router.visit(shopShow.url({ product: productUrl }));
                            }
                        }}
                        onKeyDown={(event) => {
                            const productUrl = slides[activeSlide].productUrl;

                            if (productUrl && (event.key === 'Enter' || event.key === ' ')) {
                                event.preventDefault();
                                router.visit(shopShow.url({ product: productUrl }));
                            }
                        }}
                        onPointerMove={(event) => {
                            if (dragState.current !== null) {
                                if (Math.abs(event.clientX - dragState.current) > 3) {
                                    suppressSlideClick.current = true;
                                }

                                const frameWidth = event.currentTarget.clientWidth;
                                const distance = event.clientX - dragState.current;

                                event.currentTarget.style.setProperty('--drag-offset', `${Math.max(-frameWidth, Math.min(frameWidth, distance))}px`);
                            }
                        }}
                        onPointerUp={(event) => {
                            const startX = dragState.current;
                            dragState.current = null;
                            setIsDragging(false);

                            if (startX === null) {
                                return;
                            }

                            const distance = event.clientX - startX;
                            const threshold = Math.max(48, event.currentTarget.clientWidth * 0.12);

                            if (Math.abs(distance) >= threshold) {
                                transitionSlide(distance < 0 ? 1 : -1);
                            } else {
                                const frame = event.currentTarget;
                                window.requestAnimationFrame(() => {
                                    if (dragState.current === null && pendingDirection.current === null) {
                                        frame.style.setProperty('--drag-offset', '0px');
                                    }
                                });
                            }
                        }}
                        onPointerCancel={(event) => {
                            dragState.current = null;
                            setIsDragging(false);
                            event.currentTarget.style.setProperty('--drag-offset', '0px');
                        }}
                    >
                        {([-1, 0, 1] as const).map((relativeIndex) => {
                            const slideIndex = (activeSlide + relativeIndex + slides.length) % slides.length;
                            return (
                                <div
                                    key={relativeIndex}
                                    className={`absolute inset-0 [will-change:transform] ${isDragging || isResetting ? 'transition-none' : 'transition-transform duration-500 ease-out'}`}
                                    style={{ transform: `translate3d(calc(${relativeIndex * 100}% + var(--drag-offset, 0px)), 0, 0)` }}
                                    onTransitionEnd={(event) => {
                                        if (relativeIndex !== 0 || event.propertyName !== 'transform' || pendingDirection.current === null) {
                                            return;
                                        }

                                        completeTransition();
                                    }}
                                >
                                    <img
                                        src={slides[slideIndex].imageUrl}
                                        alt={slides[slideIndex].alt}
                                        draggable={false}
                                        aria-hidden={relativeIndex !== 0}
                                        fetchPriority={relativeIndex === 0 ? 'high' : 'low'}
                                        decoding="async"
                                        onLoad={(event) => {
                                            if (relativeIndex === 0) {
                                                setCarouselAspectRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight);
                                            }
                                        }}
                                        className="home-carousel-image pointer-events-none h-full w-full select-none object-contain"
                                    />
                                </div>
                            );
                        })}
                        <div className="pointer-events-none absolute inset-0 bg-black/10" />
                    </div>
                </section>
            </main>
        </>
    );
}
