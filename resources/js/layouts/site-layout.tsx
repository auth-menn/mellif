import { Link, usePage } from '@inertiajs/react';
import { Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CartLine } from '@/types/store';
import { money } from '@/types/store';
import { loadServerCart, readGuestCart, removeServerCartLine } from '@/lib/cart-api';
import { about, logout } from '@/routes';
import { index as shopIndex } from '@/routes/shop';
import { show as checkoutShow } from '@/routes/checkout';
import AuthModal from '@/components/store/auth-modal';
import { useTranslation } from '@/hooks/use-translation';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
    const { url, props } = usePage();
    const isHome = url.split('?')[0] === '/';
    const user = (props.auth as { user?: { id: number; name: string } | null } | undefined)?.user;
    const [menuOpen, setMenuOpen] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [homeScrolled, setHomeScrolled] = useState(false);
    const [languageOpen, setLanguageOpen] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const [cart, setCart] = useState<CartLine[]>([]);
    const userRef = useRef(user);
    userRef.current = user;
    const { language, setLanguage, t } = useTranslation();

    useEffect(() => {
        if (!isHome) {
            setHomeScrolled(false);

            return;
        }

        let animationFrame = 0;
        const updateScrollState = (): void => {
            if (animationFrame !== 0) {
                return;
            }

            animationFrame = window.requestAnimationFrame(() => {
                animationFrame = 0;
                setHomeScrolled(window.scrollY > 12);
            });
        };

        updateScrollState();
        window.addEventListener('scroll', updateScrollState, { passive: true });

        return () => {
            window.removeEventListener('scroll', updateScrollState);
            window.cancelAnimationFrame(animationFrame);
        };
    }, [isHome]);

    useEffect(() => {
        let active = true;
        const refresh = async (): Promise<void> => {
            const lines = userRef.current ? await loadServerCart().catch(() => []) : readGuestCart();
            if (!active) return;
            setCart(lines);
            setCartCount(lines.reduce((sum, line) => sum + line.quantity, 0));
        };
        void refresh();
        window.addEventListener('storage', refresh);
        window.addEventListener('mellif-cart-updated', refresh);
        return () => {
            active = false;
            window.removeEventListener('storage', refresh);
            window.removeEventListener('mellif-cart-updated', refresh);
        };
    }, [user?.id]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
                setCartOpen(false);
                setLanguageOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const selectLanguage = (selectedLanguage: 'ID' | 'EN'): void => {
        setLanguage(selectedLanguage);
        setLanguageOpen(false);
    };

    return (
        <div className="min-h-screen bg-white text-[#171815]">
            <header className={`fixed z-40 transition-all duration-300 ease-out ${isHome ? homeScrolled ? 'left-1/2 right-auto top-3 h-12 w-[calc(100%-32px)] max-w-[1800px] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/80 text-white shadow-lg shadow-black/20 backdrop-blur-xl md:h-14' : 'inset-x-0 top-0 h-14 bg-black text-white md:h-16' : 'inset-x-0 top-0 h-14 bg-black text-white md:h-16'}`}>
                <div className="mx-auto grid h-full max-w-[1800px] grid-cols-3 items-center px-4 md:px-7">
                    <button aria-label={t('nav.openMenu')} onClick={() => setMenuOpen(true)} className="w-fit p-1.5"><Menu size={24} strokeWidth={1.5} /></button>
                    <Link href="/" aria-label="Mellif" className="justify-self-center">
                        <video
                            src="/videos/mellif-logo.webm"
                            autoPlay
                            loop
                            muted
                            playsInline
                            aria-hidden="true"
                            className={`object-contain transition-[width,height] duration-300 ${isHome && homeScrolled ? 'h-12 w-24' : 'h-14 w-28'}`}
                        />
                    </Link>
                    <div className="flex items-center justify-self-end gap-2.5 md:gap-4">
                        <div className="relative">
                            <button type="button" onClick={() => setLanguageOpen(!languageOpen)} aria-label={t('nav.language')} aria-expanded={languageOpen} title={t('nav.language')} className="flex items-center gap-1.5 px-1.5 py-1 text-sm">
                                <span aria-hidden="true">{language === 'EN' ? '🇬🇧' : '🇮🇩'}</span><span>{language}</span>
                            </button>
                            {languageOpen && <div className="absolute right-0 top-full z-50 mt-3 w-52 rounded-xl border border-white/70 bg-white/85 p-2 text-sm text-neutral-900 shadow-xl backdrop-blur-xl" role="menu" aria-label={t('nav.language')}>
                                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('nav.language')}</p>
                                <button type="button" role="menuitemradio" aria-checked={language === 'ID'} onClick={() => selectLanguage('ID')} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 ${language === 'ID' ? 'font-semibold' : ''}`}><span>🇮🇩&nbsp; Bahasa Indonesia</span>{language === 'ID' && <span aria-hidden="true">✓</span>}</button>
                                <button type="button" role="menuitemradio" aria-checked={language === 'EN'} onClick={() => selectLanguage('EN')} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 ${language === 'EN' ? 'font-semibold' : ''}`}><span>🇬🇧&nbsp; English</span>{language === 'EN' && <span aria-hidden="true">✓</span>}</button>
                            </div>}
                        </div>
                        <Link href={shopIndex.url()} aria-label={t('nav.search')} className="p-1"><Search size={24} strokeWidth={1.5} /></Link>
                        <button onClick={() => setCartOpen(true)} aria-label={`${t('nav.cart')}, ${cartCount} ${t('cart.quantity').toLowerCase()}`} className="relative p-1"><ShoppingBag size={24} strokeWidth={1.5} />{cartCount > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{cartCount}</span>}</button>
                        {user ? <button onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen} aria-label={t('nav.account')} className="p-1"><UserRound size={24} strokeWidth={1.5} /></button> : <button onClick={() => setAuthOpen(true)} aria-label={t('nav.login')} className="p-1"><UserRound size={24} strokeWidth={1.5} /></button>}
                    </div>
                </div>
            </header>
            {user && accountOpen && <div className="fixed right-5 top-[64px] z-50 min-w-52 rounded-xl border border-white/70 bg-white/85 p-4 text-sm text-black shadow-lg backdrop-blur-xl"><p className="font-medium">{user.name}</p><Link href="/dashboard" onClick={() => setAccountOpen(false)} className="mt-3 block py-2">{t('nav.myOrders')}</Link><Link href={logout.url()} method="post" as="button" className="w-full pt-3 text-left text-red-700">{t('nav.logout')}</Link></div>}
            {children}
            {(menuOpen || cartOpen) && <button aria-label={t('nav.closePanel')} className="fixed inset-0 z-50 bg-black/45" onClick={() => { setMenuOpen(false); setCartOpen(false); }} />}
            <aside className={`fixed inset-y-0 left-0 z-[51] w-[min(360px,86vw)] bg-white px-6 py-6 text-black shadow-xl transition-transform ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!menuOpen}>
                <div className="flex items-center justify-between"><span className="text-lg font-black tracking-[0.16em]">MELLIF</span><button aria-label={t('nav.closeMenu')} onClick={() => setMenuOpen(false)} className="rounded-full p-1.5 transition-colors hover:bg-neutral-100"><X size={21} strokeWidth={1.7} /></button></div>
                <nav className="mt-10 flex flex-col gap-5 text-base font-normal"><Link onClick={() => setMenuOpen(false)} href="/" className="py-1 transition-colors hover:text-neutral-500">{t('nav.home')}</Link><Link onClick={() => setMenuOpen(false)} href={shopIndex.url()} className="py-1 transition-colors hover:text-neutral-500">{t('nav.shop')}</Link><Link onClick={() => setMenuOpen(false)} href={about.url()} className="py-1 transition-colors hover:text-neutral-500">{t('nav.about')}</Link></nav>
                <div className="mt-9 border-t border-neutral-200 pt-5 text-sm leading-relaxed text-neutral-500">{t('admin.allRights')}</div>
            </aside>
            <aside className={`fixed inset-y-0 right-0 z-[51] flex w-[min(420px,92vw)] flex-col bg-white text-black shadow-xl transition-transform ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`} aria-hidden={!cartOpen}>
                <div className="flex items-center justify-between border-b p-6"><h2 className="text-lg font-semibold">{t('cart.title')} ({cartCount})</h2><button aria-label={t('common.close')} onClick={() => setCartOpen(false)}><X /></button></div>
                <div className="flex-1 space-y-5 overflow-y-auto p-6 text-sm text-neutral-600">{cart.length === 0 ? <p>{t('cart.empty')}</p> : cart.map((line) => <div key={line.variant.id} className="flex gap-4"><img src={line.product.images[0] ?? '/storage/products/placeholder.svg'} alt="" className="h-24 w-20 bg-neutral-100 object-cover" /><div className="flex-1"><p className="font-medium text-black">{line.product.name}</p><p className="mt-1">{t('cart.size')} {line.variant.size} · {t('cart.quantity')} {line.quantity}</p><p className="mt-1 text-black">{money(line.product.discounted_price * line.quantity)}</p><button onClick={() => { if (user) { void removeServerCartLine(line.variant.id); } else { const next = cart.filter((item) => item.variant.id !== line.variant.id); localStorage.setItem('mellif-cart', JSON.stringify(next)); window.dispatchEvent(new Event('mellif-cart-updated')); } }} className="mt-2 text-xs underline">{t('cart.remove')}</button></div></div>)}</div>
                <Link href={checkoutShow.url()} onClick={() => setCartOpen(false)} className="m-6 bg-black px-5 py-4 text-center text-sm font-semibold text-white">{t('cart.checkout')}</Link>
            </aside>
            <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
        </div>
    );
}
