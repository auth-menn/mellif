import { Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, House, Info, LoaderCircle, Menu, Search, ShoppingBag, Store, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CartLine } from '@/types/store';
import { money } from '@/types/store';
import { loadServerCart, readGuestCart, removeServerCartLine } from '@/lib/cart-api';
import { about, logout } from '@/routes';
import { dashboard as adminDashboard } from '@/routes/admin';
import { edit as profileEdit } from '@/routes/profile';
import { index as shopIndex } from '@/routes/shop';
import { show as checkoutShow } from '@/routes/checkout';
import AuthModal from '@/components/store/auth-modal';
import SearchOverlay from '@/components/store/search-overlay';
import CartRemoveDialog from '@/components/store/cart-remove-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-translation';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
    const { url, props } = usePage();
    const isHome = url.split('?')[0] === '/';
    const isShop = url.split('?')[0] === '/shop';
    const isProduct = url.split('?')[0].startsWith('/shop/');
    const isCheckout = url.split('?')[0] === '/checkout';
    const hasFloatingNavbar = isHome || isShop || isProduct || isCheckout;
    const user = (props.auth as { user?: { id: number; name: string; is_admin?: boolean } | null } | undefined)?.user;
    const [menuOpen, setMenuOpen] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [notification, setNotification] = useState('');
    const [accountOpen, setAccountOpen] = useState(false);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const [logoutProcessing, setLogoutProcessing] = useState(false);
    const [floatingNavbarScrolled, setFloatingNavbarScrolled] = useState(false);
    const [languageOpen, setLanguageOpen] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const [cart, setCart] = useState<CartLine[]>([]);
    const [pendingCartRemoval, setPendingCartRemoval] = useState<CartLine | null>(null);
    const [cartRemovalProcessing, setCartRemovalProcessing] = useState(false);
    const userRef = useRef(user);
    userRef.current = user;
    const { language, setLanguage, t } = useTranslation();

    useEffect(() => {
        if (!hasFloatingNavbar) {
            setFloatingNavbarScrolled(false);

            return;
        }

        let animationFrame = 0;
        const updateScrollState = (): void => {
            if (animationFrame !== 0) {
                return;
            }

            animationFrame = window.requestAnimationFrame(() => {
                animationFrame = 0;
                setFloatingNavbarScrolled(window.scrollY > 12);
            });
        };

        updateScrollState();
        window.addEventListener('scroll', updateScrollState, { passive: true });

        return () => {
            window.removeEventListener('scroll', updateScrollState);
            window.cancelAnimationFrame(animationFrame);
        };
    }, [hasFloatingNavbar]);

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
                setSearchOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        const openSearch = (event: Event): void => {
            setSearchQuery(event instanceof CustomEvent && typeof event.detail === 'string' ? event.detail : '');
            setSearchOpen(true);
        };
        window.addEventListener('mellif-search-open', openSearch);
        return () => window.removeEventListener('mellif-search-open', openSearch);
    }, []);

    useEffect(() => {
        let timeout: number | undefined;
        const showNotification = (event: Event): void => {
            if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
            setNotification(event.detail);
            window.clearTimeout(timeout);
            timeout = window.setTimeout(() => setNotification(''), 3500);
        };
        window.addEventListener('mellif-notification', showNotification);
        return () => {
            window.removeEventListener('mellif-notification', showNotification);
            window.clearTimeout(timeout);
        };
    }, []);

    const confirmLogout = (): void => {
        router.post(logout.url(), {}, {
            onStart: () => setLogoutProcessing(true),
            onSuccess: () => {
                setLogoutConfirmOpen(false);
                window.dispatchEvent(new CustomEvent('mellif-notification', { detail: t('nav.logoutSuccess') }));
            },
            onFinish: () => setLogoutProcessing(false),
        });
    };

    const confirmCartRemoval = async (): Promise<void> => {
        if (!pendingCartRemoval) return;

        setCartRemovalProcessing(true);
        try {
            if (userRef.current) {
                await removeServerCartLine(pendingCartRemoval.variant.id);
            } else {
                const nextCart = cart.filter((line) => line.variant.id !== pendingCartRemoval.variant.id);
                localStorage.setItem('mellif-cart', JSON.stringify(nextCart));
                window.dispatchEvent(new Event('mellif-cart-updated'));
            }
            setPendingCartRemoval(null);
        } catch {
            setNotification(t('cart.updateFailed'));
        } finally {
            setCartRemovalProcessing(false);
        }
    };

    const confirmCheckout = (): void => {
        setCheckoutConfirmOpen(false);
        setCartOpen(false);
        router.visit(checkoutShow.url());
    };

    const cartSubtotal = cart.reduce((sum, line) => sum + line.product.discounted_price * line.quantity, 0);

    const selectLanguage = (selectedLanguage: 'ID' | 'EN'): void => {
        setLanguage(selectedLanguage);
        setLanguageOpen(false);
    };

    return (
        <div className="min-h-screen bg-white text-[#171815]">
            <header className={`fixed z-40 transition-all duration-300 ease-out ${hasFloatingNavbar ? floatingNavbarScrolled ? 'left-1/2 right-auto top-2 h-11 w-[calc(100%-16px)] max-w-[1800px] -translate-x-1/2 rounded-2xl border border-white/15 bg-black text-white shadow-lg shadow-black/20 backdrop-blur-xl sm:top-3 sm:h-12 sm:w-[calc(100%-24px)] md:w-[calc(100%-32px)] md:h-14 landscape:max-xl:h-10' : 'inset-x-0 top-0 h-12 bg-black text-white sm:h-14 md:h-16 landscape:max-xl:h-12' : 'inset-x-0 top-0 h-12 bg-black text-white sm:h-14 md:h-16 landscape:max-xl:h-12'}`}>
                <div className="mx-auto grid h-full max-w-[1800px] grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-1 px-2 sm:grid-cols-3 sm:gap-2 sm:px-4 md:px-7">
                    <button aria-label={t('nav.openMenu')} onClick={() => setMenuOpen(true)} className="grid size-9 place-items-center"><Menu size={22} strokeWidth={1.5} /></button>
                    <Link href="/" aria-label="Mellif" className="justify-self-center">
                        <video
                            src="/videos/mellif-logo.webm"
                            autoPlay
                            loop
                            muted
                            playsInline
                            aria-hidden="true"
                            className={`object-contain transition-[width,height] duration-300 ${hasFloatingNavbar && floatingNavbarScrolled ? 'h-9 w-[4.5rem] sm:h-10 sm:w-20 md:h-12 md:w-24 landscape:max-xl:h-9 landscape:max-xl:w-[4.5rem]' : 'h-10 w-20 sm:h-12 sm:w-24 md:h-14 md:w-28 landscape:max-xl:h-10 landscape:max-xl:w-20'}`}
                        />
                    </Link>
                    <div className="flex shrink-0 items-center justify-self-end gap-0.5 sm:gap-2 md:gap-4">
                        <div className="relative">
                            <button type="button" onClick={() => setLanguageOpen(!languageOpen)} aria-label={t('nav.language')} aria-expanded={languageOpen} title={t('nav.language')} className="flex h-9 min-w-9 items-center justify-center gap-1.5 px-1.5 py-1 text-sm">
                                <span aria-hidden="true">{language === 'EN' ? '🇬🇧' : '🇮🇩'}</span><span className="hidden sm:inline landscape:max-xl:hidden">{language}</span>
                            </button>
                            {languageOpen && <div className="absolute right-0 top-full z-50 mt-3 w-52 rounded-xl border border-white/70 bg-white/85 p-2 text-sm text-neutral-900 shadow-xl backdrop-blur-xl" role="menu" aria-label={t('nav.language')}>
                                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('nav.language')}</p>
                                <button type="button" role="menuitemradio" aria-checked={language === 'ID'} onClick={() => selectLanguage('ID')} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 ${language === 'ID' ? 'font-semibold' : ''}`}><span>🇮🇩&nbsp; Bahasa Indonesia</span>{language === 'ID' && <span aria-hidden="true">✓</span>}</button>
                                <button type="button" role="menuitemradio" aria-checked={language === 'EN'} onClick={() => selectLanguage('EN')} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 ${language === 'EN' ? 'font-semibold' : ''}`}><span>🇬🇧&nbsp; English</span>{language === 'EN' && <span aria-hidden="true">✓</span>}</button>
                            </div>}
                        </div>
                        <button type="button" onClick={() => { setSearchQuery(''); setSearchOpen(true); }} aria-label={t('nav.search')} className="grid size-9 place-items-center"><Search size={21} strokeWidth={1.5} /></button>
                        <button onClick={() => setCartOpen(true)} aria-label={`${t('nav.cart')}, ${cartCount} ${t('cart.quantity').toLowerCase()}`} className="relative grid size-9 place-items-center"><ShoppingBag size={21} strokeWidth={1.5} />{cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{cartCount}</span>}</button>
                        {user ? <button onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen} aria-label={t('nav.account')} className="grid size-9 place-items-center"><UserRound size={21} strokeWidth={1.5} /></button> : <button onClick={() => setAuthOpen(true)} aria-label={t('nav.login')} className="grid size-9 place-items-center"><UserRound size={21} strokeWidth={1.5} /></button>}
                    </div>
                </div>
            </header>
            {user && accountOpen && <div className="fixed right-5 top-[64px] z-50 min-w-52 rounded-xl border border-white/70 bg-white/85 p-4 text-sm text-black shadow-lg backdrop-blur-xl"><p className="font-medium">{user.name}</p><Link href={profileEdit.url()} onClick={() => setAccountOpen(false)} className="mt-3 block py-2">{t('nav.profile')}</Link>{user.is_admin && <Link href={adminDashboard.url()} onClick={() => setAccountOpen(false)} className="block py-2">{t('admin.dashboard')}</Link>}<button type="button" onClick={() => { setAccountOpen(false); setLogoutConfirmOpen(true); }} className="w-full pt-3 text-left text-red-700">{t('nav.logout')}</button></div>}
            {children}
            <Dialog open={logoutConfirmOpen} onOpenChange={(open) => { if (!logoutProcessing) setLogoutConfirmOpen(open); }}>
                <DialogContent className="bg-white text-black">
                    <DialogHeader>
                        <DialogTitle>{t('nav.logoutConfirmTitle')}</DialogTitle>
                        <DialogDescription className="text-neutral-600">{t('nav.logoutConfirmDescription')}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button type="button" disabled={logoutProcessing} onClick={() => setLogoutConfirmOpen(false)} className="border border-neutral-300 px-4 py-2 text-sm font-medium text-black hover:bg-neutral-100 disabled:opacity-50">{t('common.cancel')}</button>
                        <button type="button" disabled={logoutProcessing} onClick={confirmLogout} className="inline-flex items-center justify-center gap-2 bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60">{logoutProcessing && <LoaderCircle size={16} className="animate-spin" />}{logoutProcessing ? t('nav.loggingOut') : t('nav.logout')}</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <SearchOverlay open={searchOpen} initialQuery={searchQuery} onClose={() => setSearchOpen(false)} />
            {notification && <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 bg-black px-5 py-3 text-sm text-white shadow-lg">{notification}</div>}
            {(menuOpen || cartOpen) && <button aria-label={t('nav.closePanel')} className="fixed inset-0 z-50 bg-black/45" onClick={() => { setMenuOpen(false); setCartOpen(false); }} />}
            <aside className={`fixed inset-y-0 left-0 z-[51] flex w-[min(360px,86vw)] flex-col overflow-y-auto bg-white px-6 py-6 text-black shadow-xl transition-transform ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!menuOpen}>
                <div className="flex justify-end"><button aria-label={t('nav.closeMenu')} onClick={() => setMenuOpen(false)} className="rounded-full p-1.5 transition-colors hover:bg-neutral-100"><X size={21} strokeWidth={1.7} /></button></div>
                <nav className="mt-10 flex flex-col border-y border-neutral-200 text-base font-normal">
                    <Link onClick={() => setMenuOpen(false)} href="/" aria-current={isHome ? 'page' : undefined} className={`flex items-center gap-3 border-b border-neutral-200 py-4 transition-colors hover:bg-neutral-50 ${isHome ? 'font-medium text-black' : 'text-neutral-700 hover:text-black'}`}><House size={19} strokeWidth={1.7} />{t('nav.home')}</Link>
                    <Link onClick={() => setMenuOpen(false)} href={shopIndex.url()} aria-current={isShop ? 'page' : undefined} className={`flex items-center gap-3 border-b border-neutral-200 py-4 transition-colors hover:bg-neutral-50 ${isShop ? 'font-semibold text-black' : 'text-neutral-700 hover:text-black'}`}><Store size={19} strokeWidth={1.7} />{t('nav.shop')}<ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} className="shop-menu-arrow ml-auto" /></Link>
                    <Link onClick={() => setMenuOpen(false)} href={about.url()} className="flex items-center gap-3 py-4 text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-black"><Info size={19} strokeWidth={1.7} />{t('nav.about')}</Link>
                </nav>
                <footer className="mt-auto border-t border-neutral-200 pt-5">
                    <a
                        href="https://auth-men.my.id/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-xs text-gray-500 transition hover:bg-[linear-gradient(110deg,#980609,#FFB938,#980609)] hover:bg-clip-text hover:text-transparent"
                    >
                        Dibuat oleh auth-men
                    </a>
                </footer>
            </aside>
            <aside className={`fixed inset-y-0 right-0 z-[51] flex w-[min(420px,92vw)] flex-col bg-white text-black shadow-xl transition-transform ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`} aria-hidden={!cartOpen}>
                <div className="flex items-center justify-between border-b p-6"><h2 className="text-lg font-semibold">{t('cart.title')} ({cartCount})</h2><button aria-label={t('common.close')} onClick={() => setCartOpen(false)}><X /></button></div>
                <div className="flex-1 space-y-5 overflow-y-auto p-6 text-sm text-neutral-600">{cart.length === 0 ? <p>{t('cart.empty')}</p> : cart.map((line) => <div key={line.variant.id} className="flex gap-4 border-b border-neutral-200 pb-5 last:border-b-0 last:pb-0"><img src={line.product.images[0] ?? '/storage/products/placeholder.svg'} alt="" className="h-24 w-20 bg-neutral-100 object-cover" /><div className="min-w-0 flex-1"><p className="font-medium text-black">{line.product.name}</p><p className="mt-1">{t('cart.size')} {line.variant.size}</p><p className="mt-1 text-black">{money(line.product.discounted_price * line.quantity)}</p><button onClick={() => setPendingCartRemoval(line)} className="mt-2 text-xs text-red-600 underline transition-colors hover:text-red-800">{t('cart.remove')}</button></div><span aria-label={`${t('cart.quantity')}: ${line.quantity}`} className="grid size-7 shrink-0 place-items-center rounded-full bg-black text-xs text-white">{line.quantity}</span></div>)}</div>
                <button type="button" disabled={!cart.length} onClick={() => setCheckoutConfirmOpen(true)} className="m-6 bg-black px-5 py-4 text-center text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{t('cart.checkout')}</button>
            </aside>
            <Dialog open={checkoutConfirmOpen} onOpenChange={setCheckoutConfirmOpen}>
                <DialogContent className="z-[90] bg-white text-neutral-900 sm:max-w-xl" overlayClassName="z-[80]">
                    <DialogHeader>
                        <DialogTitle>{t('checkout.confirmTitle')}</DialogTitle>
                        <DialogDescription className="text-neutral-600">{t('checkout.confirmDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-64 space-y-4 overflow-y-auto">
                        {cart.map((line) => (
                            <div key={line.variant.id} className="flex items-center justify-between gap-4 text-sm">
                                <div className="flex min-w-0 items-center gap-3">
                                    <img src={line.product.images[0] ?? '/storage/products/placeholder.svg'} alt="" className="h-16 w-14 shrink-0 bg-neutral-100 object-cover" />
                                    <div className="min-w-0">
                                        <p className="line-clamp-2 font-medium">{line.product.name}</p>
                                        <p className="text-xs text-neutral-600">{t('cart.size')} {line.variant.size} · {t('cart.quantity')} {line.quantity}</p>
                                    </div>
                                </div>
                                <span className="shrink-0">{money(line.product.discounted_price * line.quantity)}</span>
                            </div>
                        ))}
                    </div>
                    <p className="flex justify-between border-t pt-4 text-sm font-semibold"><span>{t('checkout.subtotal')}</span><span>{money(cartSubtotal)}</span></p>
                    <DialogFooter>
                        <button type="button" onClick={() => setCheckoutConfirmOpen(false)} className="border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100">{t('common.cancel')}</button>
                        <button type="button" onClick={confirmCheckout} className="bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800">{t('cart.checkout')}</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CartRemoveDialog
                open={pendingCartRemoval !== null}
                productName={pendingCartRemoval?.product.name ?? ''}
                productImage={pendingCartRemoval?.product.images[0] ?? '/storage/products/placeholder.svg'}
                size={pendingCartRemoval?.variant.size ?? ''}
                quantity={pendingCartRemoval?.quantity ?? 0}
                title={t('cart.removeConfirmTitle')}
                description={t('cart.removeConfirmDescription')}
                confirmLabel={t('cart.confirmRemove')}
                cancelLabel={t('common.cancel')}
                processing={cartRemovalProcessing}
                onOpenChange={(open) => {
                    if (!open && !cartRemovalProcessing) setPendingCartRemoval(null);
                }}
                onConfirm={() => { void confirmCartRemoval(); }}
            />
            <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
        </div>
    );
}
