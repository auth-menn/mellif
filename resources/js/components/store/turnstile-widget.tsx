import { useEffect, useRef, useState } from 'react';

type TurnstileOptions = {
    sitekey: string;
    action: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
};

declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: TurnstileOptions) => string;
            remove: (widgetId: string) => void;
        };
    }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
    if (window.turnstile) {
        return Promise.resolve();
    }

    if (!turnstileScriptPromise) {
        turnstileScriptPromise = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src =
                'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (window.turnstile) {
                    resolve();
                } else {
                    reject(new Error('Turnstile did not initialize.'));
                }
            };
            script.onerror = () => reject(new Error('Turnstile failed to load.'));
            document.head.appendChild(script);
        }).catch((error: unknown) => {
            turnstileScriptPromise = null;
            throw error;
        });
    }

    return turnstileScriptPromise ?? Promise.reject(new Error('Turnstile failed to load.'));
}

export default function TurnstileWidget({
    siteKey,
    onTokenChange,
    instruction,
    errorMessage,
}: {
    siteKey: string;
    onTokenChange: (token: string | null) => void;
    instruction: string;
    errorMessage: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [widgetError, setWidgetError] = useState(false);

    useEffect(() => {
        let active = true;
        let widgetId: string | null = null;

        void loadTurnstileScript()
            .then(() => {
                if (!active || !containerRef.current || !window.turnstile) {
                    return;
                }

                widgetId = window.turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    action: 'checkout',
                    callback: (token) => {
                        setWidgetError(false);
                        onTokenChange(token);
                    },
                    'expired-callback': () => {
                        onTokenChange(null);
                    },
                    'error-callback': () => {
                        setWidgetError(true);
                        onTokenChange(null);
                    },
                });
            })
            .catch(() => {
                if (active) {
                    setWidgetError(true);
                    onTokenChange(null);
                }
            });

        return () => {
            active = false;
            if (widgetId && window.turnstile) {
                window.turnstile.remove(widgetId);
            }
        };
    }, [onTokenChange, siteKey]);

    return (
        <div className="space-y-2">
            <div ref={containerRef} className="min-h-[65px]" />
            <p
                aria-live="polite"
                className={`text-xs ${widgetError ? 'text-red-700' : 'text-neutral-600'}`}
            >
                {widgetError ? errorMessage : instruction}
            </p>
        </div>
    );
}
