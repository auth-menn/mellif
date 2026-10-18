import { router, usePage } from '@inertiajs/react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { store as loginStore } from '@/routes/login';
import { store as registerStore } from '@/routes/register';
import { redirect as googleRedirect } from '@/routes/google';
import { request as passwordRequest } from '@/routes/password';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { mergeGuestCart } from '@/lib/cart-api';
import { announceAuthChange } from '@/lib/auth-sync';
import { useTranslation } from '@/hooks/use-translation';

type AuthMode = 'login' | 'register';
type AuthResponse = { message?: string; errors?: Record<string, string[]>; redirect?: string | null };
type AuthPageProps = { auth?: { user?: { id: number } | null } };

function PasswordField({ label, value, onChange, autoComplete, error }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string; error?: string }) {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);

    return <label className="block text-sm">{label}<span className="relative mt-1 block"><input type={isVisible ? 'text' : 'password'} autoComplete={autoComplete} required value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-neutral-300 px-3 py-2.5 pr-11" /><button type="button" aria-label={isVisible ? t('auth.hidePassword') : t('auth.showPassword')} aria-pressed={isVisible} onClick={() => setIsVisible((visible) => !visible)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-neutral-600 hover:text-black"><span aria-hidden="true">{isVisible ? <EyeOff size={18} /> : <Eye size={18} />}</span></button></span>{error && <span className="text-xs text-red-600">{error}</span>}</label>;
}

function readXsrfCookie(): string | undefined {
    const cookie = document.cookie.split('; ').find((item) => item.startsWith('XSRF-TOKEN='));
    return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : undefined;
}

export default function AuthModal({ open, onOpenChange, onAuthenticated, initialMode = 'login' }: { open: boolean; onOpenChange: (open: boolean) => void; onAuthenticated?: () => void; initialMode?: AuthMode }) {
    const { t } = useTranslation();
    const { props } = usePage<AuthPageProps>();
    const user = props.auth?.user;
    const [mode, setMode] = useState<AuthMode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');
    const [processing, setProcessing] = useState(false);

    const finishAuthentication = useCallback(async (redirectTo?: string | null): Promise<void> => {
        let guestCartSyncFailed = false;
        try {
            await mergeGuestCart();
        } catch {
            guestCartSyncFailed = true;
        }
        await new Promise<void>((resolve) => {
            router.reload({
                only: ['auth'],
                onSuccess: () => {
                    announceAuthChange();
                    window.dispatchEvent(new Event('mellif-cart-updated'));
                    if (mode === 'login') {
                        const successMessage = guestCartSyncFailed ? t('auth.loginSuccessCartWarning') : t('auth.loginSuccess');
                        window.dispatchEvent(new CustomEvent('mellif-notification', { detail: successMessage }));
                    }
                    onOpenChange(false);
                    onAuthenticated?.();
                },
                onFinish: () => resolve(),
            });
        });
        const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (redirectTo?.startsWith('/') && !redirectTo.startsWith('//') && !redirectTo.includes('\\') && redirectTo !== currentPath) {
            router.visit(redirectTo);
        }
    }, [mode, onAuthenticated, onOpenChange, t]);

    useEffect(() => {
        if (open) {
            setMode(initialMode);
            setErrors({});
            setMessage('');
        }
    }, [initialMode, open]);

    useEffect(() => {
        if (!user) return;

        setName('');
        setEmail('');
        setPassword('');
        setPasswordConfirmation('');
        setErrors({});
        setMessage('');
        setProcessing(false);
        onOpenChange(false);
    }, [onOpenChange, user]);

    useEffect(() => {
        const handlePopupAuth = (event: MessageEvent<unknown>): void => {
            if (event.origin !== window.location.origin || !event.data || typeof event.data !== 'object' || !('type' in event.data)) return;
            if (event.data.type === 'mellif-auth-google-error') {
                setProcessing(false);
                setMessage(t('auth.googleSessionExpired'));
                window.dispatchEvent(new CustomEvent('mellif-notification', { detail: t('auth.googleSessionExpired') }));
                return;
            }
            if (event.data.type !== 'mellif-auth-complete') return;
            setProcessing(true);
            const redirectTo = 'returnTo' in event.data && typeof event.data.returnTo === 'string' ? event.data.returnTo : null;
            void finishAuthentication(redirectTo).finally(() => setProcessing(false));
        };
        window.addEventListener('message', handlePopupAuth);
        return () => window.removeEventListener('message', handlePopupAuth);
    }, [finishAuthentication, t]);

    const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setErrors({});
        setMessage('');
        setProcessing(true);
        try {
            const body = mode === 'login'
                ? { email, password }
                : { name, email, password, password_confirmation: passwordConfirmation };
            const response = await fetch(mode === 'login' ? loginStore.url() : registerStore.url(), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(readXsrfCookie() ? { 'X-XSRF-TOKEN': readXsrfCookie() as string } : {}),
                },
                body: JSON.stringify(body),
            });
            const result: AuthResponse = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 419) {
                    const errorMessage = t('auth.sessionExpired');
                    window.dispatchEvent(new CustomEvent('mellif-notification', { detail: errorMessage }));
                    router.reload({ only: ['auth'] });
                    return;
                }
                if ([401, 403].includes(response.status)) {
                    const errorMessage = t('auth.failed');
                    window.dispatchEvent(new CustomEvent('mellif-notification', { detail: errorMessage }));
                    return;
                }
                if (result.errors) {
                    setErrors(Object.fromEntries(Object.entries(result.errors).map(([key, value]) => [key, value[0] ?? t('auth.invalid')])));
                } else {
                    setMessage(result.message ?? t('auth.failed'));
                }
                return;
            }
            await finishAuthentication(result.redirect);
        } catch {
            setMessage(t('auth.connectionFailed'));
        } finally {
            setProcessing(false);
        }
    };

    const openGooglePopup = (): void => {
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const popupUrl = googleRedirect.url({ query: { popup: '1', return: returnTo } });
        const popup = window.open(popupUrl, 'mellif-google-auth', 'popup,width=520,height=680');
        if (!popup) {
            window.sessionStorage.setItem('mellif-google-auth-fallback', '1');
            window.location.assign(googleRedirect.url({ query: { return: returnTo } }));
        }
    };

    if (user) return null;

    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90svh] overflow-y-auto bg-white text-black"><DialogHeader><DialogTitle>{mode === 'login' ? t('auth.welcome') : t('auth.createAccount')}</DialogTitle><DialogDescription>{mode === 'login' ? t('auth.loginDescription') : t('auth.registerDescription')}</DialogDescription></DialogHeader><button type="button" onClick={openGooglePopup} disabled={processing} className="flex w-full items-center justify-center gap-3 border border-neutral-300 px-4 py-3 text-sm font-medium disabled:opacity-50"><svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0"><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6c4.51-4.17 7.07-10.35 7.07-17.65z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.15 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.95 23.95 0 0 0 0 24c0 3.88.93 7.56 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/></svg>{mode === 'login' ? t('auth.loginWithGoogle') : t('auth.registerWithGoogle')}</button><div className="flex items-center gap-3 text-xs text-neutral-400"><span className="h-px flex-1 bg-neutral-200" />{t('auth.orEmail')}<span className="h-px flex-1 bg-neutral-200" /></div><div role="tablist" aria-label={t('nav.account')} className="grid grid-cols-2 border-b"><button role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setErrors({}); setMessage(''); }} className={`py-3 text-sm ${mode === 'login' ? 'border-b-2 border-black font-medium' : 'text-neutral-500'}`}>{t('auth.login')}</button><button role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setErrors({}); setMessage(''); }} className={`py-3 text-sm ${mode === 'register' ? 'border-b-2 border-black font-medium' : 'text-neutral-500'}`}>{t('auth.register')}</button></div><form onSubmit={submit} className="space-y-4">{mode === 'register' && <label className="block text-sm">{t('auth.name')}<input autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2.5" />{errors.name && <span className="text-xs text-red-600">{errors.name}</span>}</label>}<label className="block text-sm">{t('auth.email')}<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2.5" />{errors.email && <span className="text-xs text-red-600">{errors.email}</span>}</label><PasswordField label={t('auth.password')} value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} error={errors.password} />{mode === 'login' && <button type="button" onClick={() => { onOpenChange(false); router.visit(passwordRequest.url()); }} className="-mt-2 block text-left text-xs underline underline-offset-4 hover:text-neutral-500">{t('auth.forgotPassword')}</button>}{mode === 'register' && <PasswordField label={t('auth.confirmPassword')} value={passwordConfirmation} onChange={setPasswordConfirmation} autoComplete="new-password" error={errors.password_confirmation} />}{message && <p role="alert" className="text-sm text-red-700">{message}</p>}<button disabled={processing} className="flex w-full items-center justify-center gap-2 bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{processing ? <><LoaderCircle size={16} className="animate-spin" />{t('auth.processing')}</> : mode === 'login' ? t('auth.login') : t('auth.createButton')}</button></form></DialogContent></Dialog>;
}
