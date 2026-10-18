import { router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef } from 'react';
import { announceAuthChange, subscribeToAuthChanges } from '@/lib/auth-sync';

type AuthPageProps = { auth?: { user?: { id: number } | null } };

export default function AuthStateSync() {
    const { props } = usePage<AuthPageProps>();
    const isGuest = !props.auth?.user;
    const isReloading = useRef(false);

    const reloadAuth = useCallback((): void => {
        if (isReloading.current) return;

        isReloading.current = true;
        router.reload({
            only: ['auth'],
            onFinish: () => {
                isReloading.current = false;
            },
        });
    }, []);

    useEffect(() => subscribeToAuthChanges(reloadAuth), [reloadAuth]);

    useEffect(() => {
        const refreshWhenVisible = (): void => {
            if (isGuest && document.visibilityState === 'visible') reloadAuth();
        };

        window.addEventListener('focus', refreshWhenVisible);
        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            window.removeEventListener('focus', refreshWhenVisible);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
        };
    }, [isGuest, reloadAuth]);

    useEffect(() => {
        if (!isGuest && window.sessionStorage.getItem('mellif-google-auth-fallback') === '1') {
            window.sessionStorage.removeItem('mellif-google-auth-fallback');
            announceAuthChange();
        }
    }, [isGuest]);

    return null;
}
