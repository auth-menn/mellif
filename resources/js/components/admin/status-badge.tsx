import type { ReactNode } from 'react';

export type AdminStatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const tones: Record<AdminStatusTone, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    neutral: 'border-neutral-300 bg-neutral-100 text-neutral-800',
};

export function AdminStatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: AdminStatusTone }) {
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-4 ${tones[tone]}`}>{children}</span>;
}

export function orderStatusTone(status: string): AdminStatusTone {
    switch (status) {
        case 'pending_payment':
            return 'warning';
        case 'paid':
            return 'success';
        case 'processing':
            return 'info';
        case 'rejected':
            return 'danger';
        default:
            return 'neutral';
    }
}
