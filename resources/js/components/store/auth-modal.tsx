import { router } from '@inertiajs/react';
import { useEffect, useState, type FormEvent } from 'react';
import { store as loginStore } from '@/routes/login';
import { store as registerStore } from '@/routes/register';
import { redirect as googleRedirect } from '@/routes/google';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type AuthMode = 'login' | 'register';
type AuthResponse = { message?: string; errors?: Record<string, string[]> };

function readXsrfCookie(): string | undefined {
    const cookie = document.cookie.split('; ').find((item) => item.startsWith('XSRF-TOKEN='));
    return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : undefined;
}

export default function AuthModal({ open, onOpenChange, onAuthenticated }: { open: boolean; onOpenChange: (open: boolean) => void; onAuthenticated?: () => void }) {
    const [mode, setMode] = useState<AuthMode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const handlePopupAuth = (event: MessageEvent<unknown>): void => {
            if (event.origin !== window.location.origin || !event.data || typeof event.data !== 'object' || !('type' in event.data) || event.data.type !== 'mellif-auth-complete') return;
            router.reload({ only: ['auth'], onSuccess: () => { onOpenChange(false); onAuthenticated?.(); } });
        };
        window.addEventListener('message', handlePopupAuth);
        return () => window.removeEventListener('message', handlePopupAuth);
    }, [onAuthenticated, onOpenChange]);

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
                if (result.errors) {
                    setErrors(Object.fromEntries(Object.entries(result.errors).map(([key, value]) => [key, value[0] ?? 'Data tidak valid.'])));
                } else {
                    setMessage(result.message ?? 'Autentikasi gagal. Periksa data lalu coba lagi.');
                }
                return;
            }
            router.reload({ only: ['auth'], onSuccess: () => { onOpenChange(false); onAuthenticated?.(); } });
        } catch {
            setMessage('Koneksi gagal. Coba lagi.');
        } finally {
            setProcessing(false);
        }
    };

    const openGooglePopup = (): void => {
        const popup = window.open(googleRedirect.url(), 'mellif-google-auth', 'popup,width=520,height=680');
        if (!popup) setMessage('Popup diblokir browser. Izinkan popup untuk melanjutkan.');
    };

    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90svh] overflow-y-auto bg-white text-black"><DialogHeader><DialogTitle>{mode === 'login' ? 'Selamat datang kembali' : 'Buat akun Mellif'}</DialogTitle><DialogDescription>Masuk atau daftar untuk melanjutkan pesanan Anda.</DialogDescription></DialogHeader><button type="button" onClick={openGooglePopup} className="flex w-full items-center justify-center gap-3 border border-neutral-300 px-4 py-3 text-sm font-medium"><span aria-hidden="true" className="font-bold text-blue-600">G</span>Lanjutkan dengan Google</button><div className="flex items-center gap-3 text-xs text-neutral-400"><span className="h-px flex-1 bg-neutral-200" />atau dengan email<span className="h-px flex-1 bg-neutral-200" /></div><div role="tablist" aria-label="Metode akun" className="grid grid-cols-2 border-b"><button role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setErrors({}); setMessage(''); }} className={`py-3 text-sm ${mode === 'login' ? 'border-b-2 border-black font-medium' : 'text-neutral-500'}`}>Login</button><button role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setErrors({}); setMessage(''); }} className={`py-3 text-sm ${mode === 'register' ? 'border-b-2 border-black font-medium' : 'text-neutral-500'}`}>Register</button></div><form onSubmit={submit} className="space-y-4">{mode === 'register' && <label className="block text-sm">Nama<input autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2.5" />{errors.name && <span className="text-xs text-red-600">{errors.name}</span>}</label>}<label className="block text-sm">Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2.5" />{errors.email && <span className="text-xs text-red-600">{errors.email}</span>}</label><label className="block text-sm">Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2.5" />{errors.password && <span className="text-xs text-red-600">{errors.password}</span>}</label>{mode === 'register' && <label className="block text-sm">Konfirmasi password<input type="password" autoComplete="new-password" required value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2.5" />{errors.password_confirmation && <span className="text-xs text-red-600">{errors.password_confirmation}</span>}</label>}{message && <p role="alert" className="text-sm text-red-700">{message}</p>}<button disabled={processing} className="w-full bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{processing ? 'Memproses…' : mode === 'login' ? 'Login' : 'Buat akun'}</button></form></DialogContent></Dialog>;
}
