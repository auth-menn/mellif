const authChannelName = 'auth';
const authStorageKey = 'mellif-auth-state-changed';

export function announceAuthChange(): void {
    if (typeof window === 'undefined') return;

    try {
        const channel = new BroadcastChannel(authChannelName);
        channel.postMessage({ type: 'changed' });
        channel.close();
    } catch {
        // The storage event below remains available as a fallback.
    }

    try {
        window.localStorage.setItem(authStorageKey, String(Date.now()));
    } catch {
        // Storage may be disabled; focus refresh still keeps the current tab in sync.
    }
}

export function subscribeToAuthChanges(onChange: () => void): () => void {
    let channel: BroadcastChannel | undefined;

    try {
        channel = new BroadcastChannel(authChannelName);
        channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
            if (event.data?.type === 'changed') onChange();
        };
    } catch {
        channel = undefined;
    }

    const onStorage = (event: StorageEvent): void => {
        if (event.key === authStorageKey) onChange();
    };

    window.addEventListener('storage', onStorage);

    return () => {
        channel?.close();
        window.removeEventListener('storage', onStorage);
    };
}
