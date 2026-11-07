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
    const supportGhostEyeRef = useRef<SVGGElement | null>(null);
    userRef.current = user;
    const { language, setLanguage, t } = useTranslation();

    useEffect(() => {
        const moveSupportEye = (pointerX: number, pointerY: number): void => {
            const svg = supportGhostEyeRef.current?.ownerSVGElement;
            if (!svg) return;

            const bounds = svg.getBoundingClientRect();
            const eyeX = bounds.left + (82 / 200) * bounds.width;
            const eyeY = bounds.top + (60 / 190) * bounds.height;
            const angle = Math.atan2(pointerY - eyeY, pointerX - eyeX);
            const distance = Math.min(
                4,
                Math.hypot(pointerX - eyeX, pointerY - eyeY) / 30,
            );

            supportGhostEyeRef.current?.setAttribute(
                'transform',
                `translate(${Math.cos(angle) * distance} ${Math.sin(angle) * distance})`,
            );
        };
        const handlePointerMove = (event: PointerEvent): void => {
            moveSupportEye(event.clientX, event.clientY);
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
                            <radialGradient id="support-ghost-sheet" cx="38%" cy="22%" r="85%">
                                <stop offset="0" stopColor="#fbf9f3" />
                                <stop offset=".5" stopColor="#d9d4c9" />
                                <stop offset="1" stopColor="#8f8a80" />
                            </radialGradient>
                            <linearGradient id="support-ghost-face" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0" stopColor="#d6d1c6" />
                                <stop offset="1" stopColor="#9e998f" />
                            </linearGradient>
                            <linearGradient id="support-ghost-dirt" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0" stopColor="#141414" stopOpacity="0" />
                                <stop offset="1" stopColor="#141414" stopOpacity=".75" />
                            </linearGradient>
                            <radialGradient id="support-ghost-sock" cx="50%" cy="40%" r="60%">
                                <stop offset="0" stopColor="#1a1a1c" />
                                <stop offset="1" stopColor="#000" />
                            </radialGradient>
                            <radialGradient id="support-ghost-iris" cx="40%" cy="35%" r="70%">
                                <stop offset="0" stopColor="#ff8a8a" />
                                <stop offset=".45" stopColor="#e11d2e" />
                                <stop offset="1" stopColor="#6b0711" />
                            </radialGradient>
                            <radialGradient id="support-ghost-hand" cx="35%" cy="30%" r="80%">
                                <stop offset="0" stopColor="#66666b" />
                                <stop offset="1" stopColor="#1c1c1f" />
                            </radialGradient>
                            <filter id="support-ghost-glow" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#e11d2e" floodOpacity=".4" />
                            </filter>
                            <filter id="support-ghost-rag" x="-10%" y="-10%" width="120%" height="120%">
                                <feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="4" result="noise" />
                                <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
                            </filter>
                            <filter id="support-ghost-hand-texture" x="-10%" y="-10%" width="120%" height="120%">
                                <feTurbulence type="fractalNoise" baseFrequency=".25" numOctaves="2" seed="2" result="noise" />
                                <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
                            </filter>
                            <filter id="support-ghost-grain" x="0" y="0" width="100%" height="100%">
                                <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="3" />
                                <feColorMatrix values="0 0 0 0 .08 0 0 0 0 .08 0 0 0 0 .08 2.6 0 0 0 -1.15" />
                            </filter>
                            <filter id="support-ghost-grime" x="0" y="0" width="100%" height="100%">
                                <feTurbulence type="fractalNoise" baseFrequency=".03 .055" numOctaves="4" seed="9" />
                                <feColorMatrix values="0 0 0 0 .07 0 0 0 0 .07 0 0 0 0 .07 3.4 0 0 0 -1.45" />
                            </filter>
                            <linearGradient id="support-ghost-mask-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset=".25" stopColor="#222" />
                                <stop offset=".6" stopColor="#bbb" />
                                <stop offset="1" stopColor="#fff" />
                            </linearGradient>
                            <mask id="support-ghost-grime-mask">
                                <rect x="0" y="0" width="200" height="190" fill="url(#support-ghost-mask-gradient)" />
                            </mask>
                            <clipPath id="support-ghost-face-clip">
                                <path d="M82 34C71 36 68 50 68 64C68 82 73 98 82 112C91 98 96 82 96 64C96 50 93 36 82 34Z" />
                            </clipPath>
                            <path id="support-ghost-body" d="M82 12C66 12 55 30 54 52C53 70 50 90 44 106C36 124 28 150 30 170L36 180L40 172L46 186L52 174L58 189L64 176L70 190L77 178L84 190L90 177L97 189L104 175L111 188L117 176L123 186L128 174L134 180C138 150 130 126 120 106C114 90 111 70 110 52C109 30 98 12 82 12Z" />
                            <clipPath id="support-ghost-body-clip">
                                <use href="#support-ghost-body" />
                            </clipPath>
                            <g id="support-ghost-hand-shape" filter="url(#support-ghost-hand-texture)" fill="url(#support-ghost-hand)" stroke="#0c0c0e" strokeWidth=".6">
                                <ellipse cx="0" cy="0" rx="8" ry="9" />
                                <rect x="5" y="-9" width="17" height="4.4" rx="2.2" transform="rotate(-14 5 -7)" />
                                <rect x="6" y="-3.8" width="19" height="4.4" rx="2.2" transform="rotate(-5 6 -2)" />
                                <rect x="6" y="1.6" width="18" height="4.4" rx="2.2" transform="rotate(5 6 3)" />
                                <rect x="5" y="7" width="15" height="4.4" rx="2.2" transform="rotate(16 5 9)" />
                                <rect x="-2" y="-14" width="12" height="4.4" rx="2.2" transform="rotate(-50 0 -8)" />
                                <path d="M4 -6L20 -9M5 -1L22 -3M5 4L21 4M3 8L17 12" fill="none" stroke="#9a9aa0" strokeWidth=".6" opacity=".45" />
                                <path d="M-4 -4Q0 -6 4 -4M-5 2Q0 0 5 2" fill="none" stroke="#0c0c0e" strokeWidth=".7" opacity=".5" />
                            </g>
                            <g id="support-ghost-arm-shape">
                                <path d="M58 110C42 116 26 128 16 140L10 150L18 150L14 162L24 156L28 168L38 152C48 146 56 136 62 126Z" fill="url(#support-ghost-sheet)" stroke="#6e6a62" strokeWidth=".6" />
                                <path d="M10 150L18 150L14 162L24 156L28 168" fill="none" stroke="#222" strokeWidth="1.6" opacity=".6" />
                                <use href="#support-ghost-hand-shape" transform="translate(15 160) rotate(125)" />
                            </g>
                        </defs>
                        <g className="support-ghost-character" filter="url(#support-ghost-glow)">
                            <g className="support-ghost-shift">
                                <g filter="url(#support-ghost-rag)">
                                    <use href="#support-ghost-body" fill="url(#support-ghost-sheet)" />
                                    <g clipPath="url(#support-ghost-body-clip)">
                                        <rect x="20" y="136" width="130" height="56" fill="url(#support-ghost-dirt)" />
                                        <ellipse cx="44" cy="132" rx="6" ry="15" fill="#161616" opacity=".4" transform="rotate(8 44 132)" />
                                        <ellipse cx="120" cy="140" rx="5" ry="14" fill="#161616" opacity=".4" transform="rotate(-8 120 140)" />
                                        <path d="M70 120C66 140 68 160 64 184M94 120C98 140 96 160 100 184M82 116C80 140 84 160 82 186M58 70C54 90 50 106 42 124M106 70C110 90 114 106 122 124M56 130C52 146 52 160 54 176M108 130C112 146 112 160 110 176" fill="none" stroke="#5a564e" strokeWidth="1.6" opacity=".5" />
                                        <path d="M74 120C70 140 72 160 68 184M98 120C102 140 100 160 104 184M62 70C58 90 54 106 46 124M102 70C106 90 110 106 118 124" fill="none" stroke="#fff" strokeWidth="1.8" opacity=".55" />
                                        <path d="M54 52C60 44 70 38 82 36M110 52C104 44 94 38 82 36" fill="none" stroke="#5a564e" strokeWidth="1.4" opacity=".4" />
                                        <rect x="20" y="10" width="130" height="182" fill="#000" filter="url(#support-ghost-grime)" mask="url(#support-ghost-grime-mask)" opacity=".85" />
                                        <rect x="20" y="10" width="130" height="182" fill="#000" filter="url(#support-ghost-grain)" opacity=".45" />
                                        <ellipse cx="66" cy="32" rx="9" ry="14" fill="#fff" opacity=".45" transform="rotate(20 66 32)" />
                                    </g>
                                </g>
                                <path d="M82 34C71 36 68 50 68 64C68 82 73 98 82 112C91 98 96 82 96 64C96 50 93 36 82 34Z" fill="url(#support-ghost-face)" stroke="#8a857b" strokeWidth=".8" />
                                <path d="M76 92C72 84 70 76 70 70M88 92C92 84 94 76 94 70M72 52C75 46 78 44 82 43M92 52C89 46 86 44 82 43M72 62C70 70 71 80 75 90M92 62C94 70 93 80 89 90M78 104C74 100 72 96 72 92M86 104C90 100 92 96 92 92M70 76C74 74 78 76 80 78M94 76C90 74 86 76 84 78M69 86C72 88 75 92 76 96M95 86C92 88 89 92 88 96" fill="none" stroke="#6e6a62" strokeWidth=".7" opacity=".75" />
                                <g clipPath="url(#support-ghost-face-clip)">
                                    <rect x="60" y="30" width="44" height="86" fill="#000" filter="url(#support-ghost-grain)" opacity=".55" />
                                    <path d="M82 34C71 36 68 50 68 64C68 82 73 98 82 112C91 98 96 82 96 64C96 50 93 36 82 34Z" fill="none" stroke="#3a3730" strokeWidth="5" opacity=".35" />
                                </g>
                                <ellipse cx="82" cy="60" rx="14.5" ry="15.5" fill="none" stroke="#6e6a62" strokeWidth="2" opacity=".5" />
                                <ellipse cx="82" cy="60" rx="13" ry="14" fill="url(#support-ghost-sock)" />
                                <circle cx="82" cy="60" r="11" fill="#e11d2e" opacity=".18" />
                                <g ref={supportGhostEyeRef}>
                                    <circle cx="82" cy="60" r="7" fill="url(#support-ghost-iris)" />
                                    <circle cx="82" cy="60" r="2.8" fill="#000" />
                                    <circle cx="79.8" cy="57.6" r="1.4" fill="#fff" opacity=".9" />
                                </g>
                                <path d="M79 81L82 74L85 81Z" fill="#26262a" opacity=".85" />
                                <ellipse cx="82" cy="99" rx="6.5" ry="10" fill="#000" />
                                <ellipse cx="82" cy="104" rx="3.5" ry="4.5" fill="#2a0508" />
                                <g className="support-ghost-arms">
                                    <g className="support-ghost-float-left"><use href="#support-ghost-hand-shape" transform="translate(26 132) scale(1.1) rotate(200)" /></g>
                                    <g className="support-ghost-float-right"><use href="#support-ghost-hand-shape" transform="translate(138 132) scale(-1.1 1.1) rotate(200)" /></g>
                                </g>
                                <g className="support-ghost-grip" filter="url(#support-ghost-hand-texture)" fill="url(#support-ghost-hand)" stroke="#0c0c0e" strokeWidth=".6">
                                    <rect x="96" y="96" width="16" height="32" rx="8" />
                                    <rect x="104" y="96" width="24" height="7" rx="3.5" />
                                    <rect x="104" y="104" width="26" height="7" rx="3.5" />
                                    <rect x="104" y="112" width="24" height="7" rx="3.5" />
                                    <rect x="104" y="120" width="20" height="7" rx="3.5" />
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
