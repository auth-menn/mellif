import { Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Check, House, Info, LoaderCircle, Menu, MessageCircle, Search, ShoppingBag, Store, UserRound, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CartLine } from '@/types/store';
import { money } from '@/types/store';
import { loadServerCartOverview, readGuestCart, removeServerCartLine, type CartOrderSummary } from '@/lib/cart-api';
import { announceAuthChange } from '@/lib/auth-sync';
import { about, logout } from '@/routes';
import { dashboard as adminDashboard } from '@/routes/admin';
import { edit as profileEdit } from '@/routes/profile';
import { index as shopIndex } from '@/routes/shop';
import { show as checkoutShow } from '@/routes/checkout';
import AuthModal from '@/components/store/auth-modal';
import AuthStateSync from '@/components/store/auth-state-sync';
import FlagIcon from '@/components/store/flag-icon';
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
    const user = (props.auth as { user?: { id: number; name: string; is_admin?: boolean } | null } | undefined)?.user;
    const [menuOpen, setMenuOpen] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const [cartSection, setCartSection] = useState<'cart' | 'awaitingPayment' | 'paid'>('cart');
    const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [notification, setNotification] = useState('');
    const [accountOpen, setAccountOpen] = useState(false);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const [logoutProcessing, setLogoutProcessing] = useState(false);
    const [floatingNavbarScrolled, setFloatingNavbarScrolled] = useState(false);
    const [supportChatOpen, setSupportChatOpen] = useState(false);
    const [languageOpen, setLanguageOpen] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const [cart, setCart] = useState<CartLine[]>([]);
    const [cartReady, setCartReady] = useState(false);
    const [cartOrders, setCartOrders] = useState<{ awaitingPayment: CartOrderSummary[]; paid: CartOrderSummary[] }>({ awaitingPayment: [], paid: [] });
    const [pendingCartRemoval, setPendingCartRemoval] = useState<CartLine | null>(null);
    const [cartRemovalProcessing, setCartRemovalProcessing] = useState(false);
    const userRef = useRef(user);
    const supportPupilLeftRef = useRef<SVGCircleElement | null>(null);
    const supportPupilRightRef = useRef<SVGCircleElement | null>(null);
    userRef.current = user;
    const { language, setLanguage, t } = useTranslation();

    useEffect(() => {
        const moveSupportEyes = (pointerX: number, pointerY: number): void => {
            const svg = supportPupilLeftRef.current?.ownerSVGElement;
            if (!svg) return;

            const bounds = svg.getBoundingClientRect();
            const pupils = [
                { element: supportPupilLeftRef.current, x: 74, y: 86 },
                { element: supportPupilRightRef.current, x: 104, y: 86 },
            ];

            for (const pupil of pupils) {
                if (!pupil.element) continue;

                const eyeX = bounds.left + ((pupil.x - 22) / 200) * bounds.width;
                const eyeY = bounds.top + ((pupil.y + 4) / 190) * bounds.height;
                const angle = Math.atan2(pointerY - eyeY, pointerX - eyeX);
                const distance = Math.min(
                    4,
                    Math.hypot(pointerX - eyeX, pointerY - eyeY) / 30,
                );

                pupil.element.setAttribute(
                    'cx',
                    String(pupil.x + Math.cos(angle) * distance),
                );
                pupil.element.setAttribute(
                    'cy',
                    String(pupil.y + Math.sin(angle) * distance),
                );
            }
        };
        const handlePointerMove = (event: PointerEvent): void => {
            moveSupportEyes(event.clientX, event.clientY);
        };

        window.addEventListener('pointermove', handlePointerMove, {
            passive: true,
        });

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
        };
    }, []);

    const refreshCart = useCallback(async (): Promise<void> => {
        if (userRef.current) {
            const overview = await loadServerCartOverview().catch(() => ({
                items: [],
                orders: { awaitingPayment: [], paid: [] },
            }));
            setCart(overview.items);
            setCartOrders(overview.orders);
            setCartCount(overview.items.reduce((sum, line) => sum + line.quantity, 0));
            setCartReady(true);
            return;
        }

        const lines = readGuestCart();
        setCart(lines);
        setCartOrders({ awaitingPayment: [], paid: [] });
        setCartCount(lines.reduce((sum, line) => sum + line.quantity, 0));
        setCartReady(true);
    }, []);

    useEffect(() => {
        const pageUrl = new URL(window.location.href);
        if (pageUrl.searchParams.get('auth_error') === 'google_state') {
            setNotification(t('auth.googleSessionExpired'));
            window.setTimeout(() => setNotification(''), 3500);
            pageUrl.searchParams.delete('auth_error');
        }
        const requestedMode = pageUrl.searchParams.get('auth');
        if (requestedMode === 'login' || requestedMode === 'register') {
            setAuthInitialMode(requestedMode);
            setAuthOpen(true);
            pageUrl.searchParams.delete('auth');
        }
        if (pageUrl.searchParams.has('auth_error') || requestedMode === 'login' || requestedMode === 'register') {
            const query = pageUrl.searchParams.toString();
            window.history.replaceState(window.history.state, '', `${pageUrl.pathname}${query ? `?${query}` : ''}${pageUrl.hash}`);
        }
    }, [t, url]);

    useEffect(() => {
        if (user) setAuthOpen(false);
    }, [user]);

    useEffect(() => {
        const removeHttpExceptionListener = router.on('httpException', (event) => {
            const status = event.detail.response.status;

            if (status === 401) {
                event.preventDefault();
                setAuthInitialMode('login');
                setAuthOpen(true);
                window.dispatchEvent(new CustomEvent('mellif-notification', { detail: t('auth.loginRequired') }));
            }

            if (status === 419) {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent('mellif-notification', { detail: t('auth.sessionExpired') }));
                router.reload({ only: ['auth'] });
            }
        });

        return () => removeHttpExceptionListener();
    }, [t]);

    useEffect(() => {
        let animationFrame = 0;
        const updateScrollState = (): void => {
            if (animationFrame !== 0) {
                return;
            }

            animationFrame = window.requestAnimationFrame(() => {
                animationFrame = 0;
                setFloatingNavbarScrolled((wasScrolled) => window.scrollY > (wasScrolled ? 8 : 24));
            });
        };

        updateScrollState();
        window.addEventListener('scroll', updateScrollState, { passive: true });

        return () => {
            window.removeEventListener('scroll', updateScrollState);
            window.cancelAnimationFrame(animationFrame);
        };
    }, []);

    useEffect(() => {
        void refreshCart();
        window.addEventListener('storage', refreshCart);
        window.addEventListener('mellif-cart-updated', refreshCart);
        return () => {
            window.removeEventListener('storage', refreshCart);
            window.removeEventListener('mellif-cart-updated', refreshCart);
        };
    }, [refreshCart, user?.id]);

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
                announceAuthChange();
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
            <AuthStateSync />
            <header className={`fixed left-1/2 z-40 w-full -translate-x-1/2 text-white will-change-[width,height,top] transition-[width,height,top,border-radius,border-color,box-shadow] duration-500 ease-out ${floatingNavbarScrolled ? 'top-2 h-11 w-[calc(100%-16px)] max-w-[1800px] rounded-2xl border border-white/15 bg-black shadow-lg shadow-black/20 sm:top-3 sm:h-12 sm:w-[calc(100%-24px)] md:w-[calc(100%-32px)] md:h-14 landscape:max-xl:h-10' : 'top-0 h-12 rounded-none border border-transparent bg-black shadow-none sm:h-14 md:h-16 landscape:max-xl:h-12'}`}>
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
                            className={`object-contain transition-[width,height] duration-500 ease-out ${floatingNavbarScrolled ? 'h-9 w-[4.5rem] sm:h-10 sm:w-20 md:h-12 md:w-24 landscape:max-xl:h-9 landscape:max-xl:w-[4.5rem]' : 'h-10 w-20 sm:h-12 sm:w-24 md:h-14 md:w-28 landscape:max-xl:h-10 landscape:max-xl:w-20'}`}
                        />
                    </Link>
                    <div className="flex shrink-0 items-center justify-self-end gap-0.5 sm:gap-2 md:gap-4">
                        <div className="relative">
                            <button type="button" onClick={() => setLanguageOpen(!languageOpen)} aria-label={t(language === 'ID' ? 'nav.languageCurrentIndonesia' : 'nav.languageCurrentEnglish')} aria-expanded={languageOpen} title={t('nav.language')} className="flex h-9 min-w-9 items-center justify-center gap-1.5 px-1.5 py-1 text-sm">
                                <FlagIcon language={language} /><span>{language}</span>
                            </button>
                            {languageOpen && <div className="absolute right-0 top-full z-50 mt-3 w-52 rounded-xl border border-white/70 bg-white/85 p-2 text-sm text-neutral-900 shadow-xl backdrop-blur-xl" role="menu" aria-label={t('nav.language')}>
                                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('nav.language')}</p>
                                <button type="button" role="menuitemradio" aria-checked={language === 'ID'} onClick={() => selectLanguage('ID')} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 ${language === 'ID' ? 'font-semibold' : ''}`}><span className="flex items-center gap-3"><FlagIcon language="ID" />{t('nav.languageIndonesia')}</span>{language === 'ID' && <Check aria-hidden="true" size={14} />}</button>
                                <button type="button" role="menuitemradio" aria-checked={language === 'EN'} onClick={() => selectLanguage('EN')} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 ${language === 'EN' ? 'font-semibold' : ''}`}><span className="flex items-center gap-3"><FlagIcon language="EN" />{t('nav.languageEnglish')}</span>{language === 'EN' && <Check aria-hidden="true" size={14} />}</button>
                            </div>}
                        </div>
                        <button type="button" onClick={() => { setSearchQuery(''); setSearchOpen(true); }} aria-label={t('nav.search')} className="grid size-9 place-items-center"><Search size={21} strokeWidth={1.5} /></button>
                        <button onClick={() => { void refreshCart(); setCartSection('cart'); setCartOpen(true); }} aria-label={`${t('nav.cart')}, ${cartCount} ${t('cart.quantity').toLowerCase()}`} className="relative grid size-9 place-items-center"><ShoppingBag size={21} strokeWidth={1.5} />{cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{cartCount}</span>}</button>
                        {user ? <button onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen} aria-label={t('nav.account')} className="grid size-9 place-items-center"><UserRound size={21} strokeWidth={1.5} /></button> : <button onClick={() => { setAuthInitialMode('login'); setAuthOpen(true); }} aria-label={t('nav.login')} className="grid size-9 place-items-center"><UserRound size={21} strokeWidth={1.5} /></button>}
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
            <aside className={`fixed inset-y-0 right-0 z-[51] flex w-[min(560px,96vw)] flex-col bg-white text-black shadow-xl transition-transform ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`} aria-hidden={!cartOpen}>
                <div className="border-b px-5 pt-5">
                    <div className="flex items-center justify-between pb-4"><h2 className="text-lg font-semibold">{t('cart.title')}</h2><button aria-label={t('common.close')} onClick={() => setCartOpen(false)}><X /></button></div>
                    <div className={`grid ${user ? 'grid-cols-3' : 'grid-cols-1'}`} role="tablist" aria-label={t('cart.title')}>
                        <button id="cart-tab-items" type="button" role="tab" aria-selected={cartSection === 'cart'} aria-controls="cart-panel" onClick={() => setCartSection('cart')} className={`min-h-12 border-b-2 px-2 pb-2 text-center text-xs font-medium leading-tight transition-colors ${cartSection === 'cart' ? 'border-black text-black' : 'border-transparent text-neutral-500 hover:text-black'}`}>{t('cart.currentItems')} <span className="text-neutral-400">{cartCount}</span></button>
                        {user && <button id="cart-tab-awaiting" type="button" role="tab" aria-selected={cartSection === 'awaitingPayment'} aria-controls="cart-panel" onClick={() => setCartSection('awaitingPayment')} className={`min-h-12 border-b-2 px-2 pb-2 text-center text-xs font-medium leading-tight transition-colors ${cartSection === 'awaitingPayment' ? 'border-black text-black' : 'border-transparent text-neutral-500 hover:text-black'}`}>{t('cart.awaitingPayment')} <span className="text-neutral-400">{cartOrders.awaitingPayment.length}</span></button>}
                        {user && <button id="cart-tab-paid" type="button" role="tab" aria-selected={cartSection === 'paid'} aria-controls="cart-panel" onClick={() => setCartSection('paid')} className={`min-h-12 border-b-2 px-2 pb-2 text-center text-xs font-medium leading-tight transition-colors ${cartSection === 'paid' ? 'border-black text-black' : 'border-transparent text-neutral-500 hover:text-black'}`}>{t('cart.purchaseHistory')} <span className="text-neutral-400">{cartOrders.paid.length}</span></button>}
                    </div>
                </div>
                <div id="cart-panel" role="tabpanel" aria-labelledby={cartSection === 'cart' ? 'cart-tab-items' : cartSection === 'awaitingPayment' ? 'cart-tab-awaiting' : 'cart-tab-paid'} className="flex-1 overflow-y-auto p-6 text-sm text-neutral-600">
                    {cartSection === 'cart' && <section className="space-y-4">
                        <h3 className="font-semibold text-black">{t('cart.currentItems')} ({cartCount})</h3>
                        {cart.length === 0 ? <p>{t('cart.empty')}</p> : cart.map((line) => <div key={line.variant.id} className="flex gap-4 border-b border-neutral-200 pb-5 last:border-b-0 last:pb-0"><img src={line.product.images[0] ?? '/storage/products/placeholder.svg'} alt="" className="h-24 w-20 bg-neutral-100 object-cover" /><div className="min-w-0 flex-1"><p className="font-medium text-black">{line.product.name}</p><p className="mt-1">{t('cart.size')} {line.variant.size}</p><p className="mt-1 text-black">{money(line.product.discounted_price * line.quantity)}</p><button onClick={() => setPendingCartRemoval(line)} className="mt-2 text-xs text-red-600 underline transition-colors hover:text-red-800">{t('cart.remove')}</button></div><span aria-label={`${t('cart.quantity')}: ${line.quantity}`} className="grid size-7 shrink-0 place-items-center rounded-full bg-black text-xs text-white">{line.quantity}</span></div>)}
                    </section>}
                    {user && cartSection === 'awaitingPayment' && <section className="space-y-4">
                        <h3 className="font-semibold text-black">{t('cart.awaitingPayment')} ({cartOrders.awaitingPayment.length})</h3>
                        {cartOrders.awaitingPayment.length === 0 ? <p>{t('cart.noAwaitingPayment')}</p> : cartOrders.awaitingPayment.map((order) => <div key={order.id} className="space-y-3 rounded border border-neutral-200 p-4">
                            <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-black">{order.orderNumber}</p><p className="mt-1 text-xs">{t('checkout.qrisStatus.unpaid')}</p></div><span className="shrink-0 font-medium text-black">{money(order.total)}</span></div>
                            <ul className="space-y-1 text-xs">{order.items.map((item, index) => <li key={`${order.id}-${index}`}>{item.productName} · {t('cart.size')} {item.size} · {t('cart.quantity')} {item.quantity}</li>)}</ul>
                            <Link onClick={() => setCartOpen(false)} href={checkoutShow.url({ query: { order: order.orderNumber } })} className="inline-flex bg-black px-3 py-2 text-xs font-medium text-white">{t('cart.resumePayment')}</Link>
                        </div>)}
                    </section>}
                    {user && cartSection === 'paid' && <section className="space-y-4">
                        <h3 className="font-semibold text-black">{t('cart.purchaseHistory')} ({cartOrders.paid.length})</h3>
                        {cartOrders.paid.length === 0 ? <p>{t('cart.noPurchaseHistory')}</p> : cartOrders.paid.map((order) => <div key={order.id} className="space-y-3 rounded border border-neutral-200 p-4">
                            <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-black">{order.orderNumber}</p><p className="mt-1 text-xs text-green-700">{t('cart.paymentReceived')}</p></div><span className="shrink-0 font-medium text-black">{money(order.total)}</span></div>
                            <ul className="space-y-3">{order.items.map((item, index) => <li key={`${order.id}-${index}`} className="flex items-center gap-3 text-xs"><img src={item.imageUrl ?? "/storage/products/placeholder.svg"} alt="" className="h-16 w-14 shrink-0 bg-neutral-100 object-cover" /><div className="min-w-0"><p className="font-medium text-black">{item.productName}</p><p className="mt-1">{t("cart.size")} {item.size} | {t("cart.quantity")} {item.quantity}</p></div></li>)}</ul>
                        </div>)}
                    </section>}
                </div>
                {cartSection === 'cart' && <button type="button" disabled={cartReady ? cart.length === 0 : undefined} onClick={() => { if (!cartReady || cart.length === 0) return; setCheckoutConfirmOpen(true); }} className="m-6 bg-black px-5 py-4 text-center text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{t('cart.checkout')}</button>}
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
            <AuthModal open={authOpen} onOpenChange={setAuthOpen} initialMode={authInitialMode} />
            <div
                className={`support-peek-wrap ${supportChatOpen ? 'support-peek-wrap-open' : ''}`}
            >
                {supportChatOpen && (
                    <section
                        aria-label={t('support.chatTitle')}
                        className="support-chatbox-enter absolute right-2 bottom-[119px] w-[min(17rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-xl max-[767px]:bottom-[81px]"
                    >
                        <div className="flex items-center justify-between bg-[#0b0b0d] px-3 py-2.5 text-white">
                            <div>
                                <p className="text-xs font-semibold">
                                    {t('support.chatTitle')}
                                </p>
                                <p className="mt-0.5 text-[11px] text-neutral-300">
                                    {t('support.chatGreeting')}
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label={t('support.closeChat')}
                                onClick={() => setSupportChatOpen(false)}
                                className="rounded-full p-1.5 transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3 p-3">
                            <p className="rounded-lg rounded-tl-sm bg-neutral-100 px-3 py-2 text-xs leading-5 text-neutral-700">
                                {t('support.chatDescription')}
                            </p>
                            <a
                                href="https://wa.me/6281330087106?text=Halo%20Admin%2C%20saya%20membutuhkan%20bantuan%20terkait%20pesanan."
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#e11d2e] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#bd1424] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e11d2e]"
                            >
                                <MessageCircle size={15} />
                                {t('support.whatsappCta')}
                            </a>
                        </div>
                    </section>
                )}
                <div className="support-peek-bubble">
                    <i aria-hidden="true" />
                    {t('support.peekPrompt')}
                </div>
                <div className="support-peek-window">
                    <button
                        type="button"
                        aria-label={
                            supportChatOpen
                                ? t('support.closeChat')
                                : t('support.openChat')
                        }
                        aria-expanded={supportChatOpen}
                        onClick={() => setSupportChatOpen((open) => !open)}
                        className="support-peek-trigger"
                    >
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 200 190"
                        className="support-peek-svg"
                    >
                        <defs>
                            <radialGradient id="support-skin" cx="35%" cy="28%" r="80%">
                                <stop offset="0%" stopColor="#ffe3cf" />
                                <stop offset="55%" stopColor="#f6c3a2" />
                                <stop offset="100%" stopColor="#d99874" />
                            </radialGradient>
                            <radialGradient id="support-hair" cx="40%" cy="25%" r="85%">
                                <stop offset="0%" stopColor="#3a3a40" />
                                <stop offset="100%" stopColor="#050506" />
                            </radialGradient>
                            <radialGradient id="support-shirt" cx="40%" cy="20%" r="90%">
                                <stop offset="0%" stopColor="#26262b" />
                                <stop offset="100%" stopColor="#08080a" />
                            </radialGradient>
                            <radialGradient id="support-cup" cx="35%" cy="30%" r="80%">
                                <stop offset="0%" stopColor="#ff4d5c" />
                                <stop offset="100%" stopColor="#a40f1d" />
                            </radialGradient>
                            <linearGradient id="support-neck" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#bb7f5b" />
                                <stop offset="50%" stopColor="#e2a883" />
                                <stop offset="100%" stopColor="#f3bf9b" />
                            </linearGradient>
                            <pattern id="support-pattern" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
                                <g fill="#e11d2e" opacity=".85">
                                    <circle cx="12" cy="8.2" r="1.8" />
                                    <circle cx="12" cy="15.8" r="1.8" />
                                    <circle cx="8.2" cy="12" r="1.8" />
                                    <circle cx="15.8" cy="12" r="1.8" />
                                </g>
                                <circle cx="12" cy="12" r="1.1" fill="#0a0a0c" />
                                <g fill="#e11d2e" opacity=".4">
                                    <circle cx="0" cy="0" r=".9" />
                                    <circle cx="24" cy="0" r=".9" />
                                    <circle cx="0" cy="24" r=".9" />
                                    <circle cx="24" cy="24" r=".9" />
                                </g>
                            </pattern>
                            <filter id="support-shadow" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="-3" dy="4" stdDeviation="4" floodColor="#000" floodOpacity=".4" />
                            </filter>
                        </defs>
                        <g className="support-character" filter="url(#support-shadow)">
                            <path d="M65 98H97L99 134L84 152L66 134Z" fill="url(#support-neck)" />
                            <ellipse cx="82" cy="134" rx="15" ry="6" fill="#7a4a30" opacity=".25" />
                            <path d="M44 152C44 141 56 134 66 129C70 134 76 146 84 146C92 146 97 136 100 129L126 129L126 192L94 192C86 174 58 168 44 152Z" className="support-partial-body" fill="url(#support-shirt)" stroke="#8f1220" strokeWidth="1" strokeLinejoin="round" />
                            <path d="M44 152C44 141 56 134 66 129C70 134 76 146 84 146C92 146 97 136 100 129L126 129L126 192L94 192C86 174 58 168 44 152Z" className="support-partial-body" fill="url(#support-pattern)" />
                            <g className="support-full-body">
                                <path d="M52 192C50 178 46 168 46 160C46 144 56 135 66 129C70 134 76 146 84 146C92 146 97 136 100 129C110 135 120 144 120 160C120 168 116 178 114 192Z" fill="url(#support-shirt)" />
                                <path d="M52 192C50 178 46 168 46 160C46 144 56 135 66 129C70 134 76 146 84 146C92 146 97 136 100 129C110 135 120 144 120 160C120 168 116 178 114 192Z" fill="url(#support-pattern)" />
                                <path d="M52 192C50 178 46 168 46 160C46 144 56 135 66 129M100 129C110 135 120 144 120 160C120 168 116 178 114 192" fill="none" stroke="#8f1220" />
                                <path d="M43 154L43 176" fill="none" stroke="#e11d2e" strokeWidth="15" strokeLinecap="round" />
                                <path d="M43 154L43 176" fill="none" stroke="#1a1a1e" strokeWidth="13.5" strokeLinecap="round" />
                                <path d="M43 154L43 176" fill="none" stroke="url(#support-pattern)" strokeWidth="13.5" strokeLinecap="round" />
                                <ellipse cx="43" cy="184" rx="6.5" ry="7.5" fill="url(#support-skin)" stroke="#c68a64" strokeWidth=".8" />
                                <path d="M42 80C34 106 36 140 42 160C52 156 58 144 60 124Z" fill="url(#support-hair)" />
                                <path d="M124 80C132 106 130 140 124 160C114 156 108 144 106 124Z" fill="url(#support-hair)" />
                            </g>
                            <path d="M66 129C70 134 76 146 84 146C92 146 97 136 100 129" fill="none" stroke="#e11d2e" strokeWidth="2.2" strokeLinecap="round" />
                            <path className="support-hair-peek" d="M26 72C14 112 20 150 36 170C46 160 46 150 52 140C52 120 56 100 62 90Z" fill="url(#support-hair)" />
                            <g className="support-grip">
                                <path d="M52 148Q64 160 74 168" fill="none" stroke="#e11d2e" strokeWidth="21" strokeLinecap="round" />
                                <path d="M52 148Q64 160 74 168" fill="none" stroke="#1a1a1e" strokeWidth="19" strokeLinecap="round" />
                                <path d="M52 148Q64 160 74 168" fill="none" stroke="url(#support-pattern)" strokeWidth="19" strokeLinecap="round" />
                                <path d="M74 168Q92 178 108 172" fill="none" stroke="#c68a64" strokeWidth="12" strokeLinecap="round" />
                                <path d="M74 168Q92 178 108 172" fill="none" stroke="#f1bb98" strokeWidth="10.6" strokeLinecap="round" />
                                <g stroke="#c68a64" strokeWidth=".8" fill="url(#support-skin)">
                                    <rect x="98" y="160" width="18" height="30" rx="8" />
                                    <rect x="102" y="160" width="26" height="7" rx="3.5" />
                                    <rect x="102" y="167" width="28" height="7" rx="3.5" />
                                    <rect x="102" y="174" width="26" height="7" rx="3.5" />
                                    <rect x="102" y="181" width="22" height="7" rx="3.5" />
                                </g>
                            </g>
                            <g className="support-rest-hand" transform="translate(-36 0)" stroke="#c68a64" strokeWidth=".8" fill="url(#support-skin)">
                                <ellipse cx="79" cy="182" rx="9" ry="10" />
                                <rect x="73" y="186" width="4.4" height="10" rx="2.2" />
                                <rect x="78" y="187" width="4.4" height="10" rx="2.2" />
                                <rect x="83" y="186" width="4.4" height="9" rx="2.2" />
                            </g>
                            <g transform="translate(-22 4)">
                                <g className="support-head">
                                    <circle cx="96" cy="82" r="44" fill="url(#support-skin)" />
                                    <path d="M52 78C50 44 74 30 98 32c24 2 42 18 40 44-10-8-22-22-30-26-14 12-34 18-56 28Z" fill="url(#support-hair)" />
                                    <ellipse cx="78" cy="48" rx="16" ry="6" fill="#fff" opacity=".18" transform="rotate(-20 78 48)" />
                                    <path d="M54 80C50 46 76 28 96 30C118 32 142 48 139 80" fill="none" stroke="#17171b" strokeWidth="5.5" strokeLinecap="round" />
                                    <path d="M54 80C50 46 76 28 96 30C118 32 142 48 139 80" fill="none" stroke="#e11d2e" strokeWidth="1.4" strokeLinecap="round" />
                                    <circle cx="139" cy="88" r="11" fill="#17171b" />
                                    <circle cx="139" cy="88" r="7" fill="url(#support-cup)" />
                                    <circle cx="53" cy="88" r="11" fill="#17171b" />
                                    <circle cx="53" cy="88" r="7" fill="url(#support-cup)" />
                                    <ellipse cx="50" cy="85" rx="2.6" ry="2" fill="#fff" opacity=".4" />
                                    <path d="M54 98C56 112 66 116 78 114" fill="none" stroke="#2b2b30" strokeWidth="3" strokeLinecap="round" />
                                    <circle cx="80" cy="114" r="4.5" fill="#17171b" stroke="#e11d2e" strokeWidth="1.2" />
                                    <g><circle cx="74" cy="86" r="10" fill="#fff" /><circle ref={supportPupilLeftRef} cx="74" cy="86" r="5.5" fill="#2a1a14" /><circle cx="72" cy="83.5" r="1.8" fill="#fff" /></g>
                                    <g><circle cx="104" cy="86" r="10" fill="#fff" /><circle ref={supportPupilRightRef} cx="104" cy="86" r="5.5" fill="#2a1a14" /><circle cx="102" cy="83.5" r="1.8" fill="#fff" /></g>
                                    <path d="M65 70q9-6 18-1M95 69q9-5 18 1" stroke="#3a261d" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                    <ellipse cx="66" cy="102" rx="6" ry="3.5" fill="#ff8f8f" opacity=".5" />
                                    <ellipse cx="114" cy="102" rx="6" ry="3.5" fill="#ff8f8f" opacity=".5" />
                                    <path d="M84 104q10 9 20 0" stroke="#8a3a2e" strokeWidth="2.8" fill="none" strokeLinecap="round" />
                                </g>
                            </g>
                            <g className="support-upper-grip" stroke="#c68a64" strokeWidth=".8" fill="url(#support-skin)">
                                <rect x="106" y="45" width="14" height="38" rx="7" />
                                <rect x="106" y="50" width="22" height="7" rx="3.5" />
                                <rect x="106" y="58" width="24" height="7" rx="3.5" />
                                <rect x="106" y="66" width="24" height="7" rx="3.5" />
                                <rect x="106" y="74" width="20" height="7" rx="3.5" />
                            </g>
                            <g className="support-wave">
                                <path d="M116 154Q166 158 166 126" fill="none" stroke="#e11d2e" strokeWidth="13" strokeLinecap="round" />
                                <path d="M116 154Q166 158 166 126" fill="none" stroke="#1a1a1e" strokeWidth="11.5" strokeLinecap="round" />
                                <path d="M116 154Q166 158 166 126" fill="none" stroke="url(#support-pattern)" strokeWidth="11.5" strokeLinecap="round" />
                                <g className="support-wave-hand" stroke="#c68a64" strokeWidth=".8" fill="url(#support-skin)">
                                    <rect x="161" y="108" width="10" height="14" rx="4" />
                                    <ellipse cx="166" cy="106" rx="10" ry="10" />
                                    <rect x="157" y="88" width="4.6" height="16" rx="2.3" />
                                    <rect x="162" y="85" width="4.6" height="18" rx="2.3" />
                                    <rect x="167" y="86" width="4.6" height="17" rx="2.3" />
                                    <rect x="172" y="90" width="4.2" height="14" rx="2.1" />
                                    <rect x="151" y="104" width="12" height="5" rx="2.5" transform="rotate(-35 158 106)" />
                                </g>
                            </g>
                        </g>
                    </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
