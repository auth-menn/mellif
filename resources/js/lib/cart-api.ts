import type { CartLine, Product, StoreVariant } from '@/types/store';
import cartRoutes from '@/routes/cart';

export type CartOrderSummary = {
    id: number;
    orderNumber: string;
    total: number;
    status: string;
    paymentStatus: string | null;
    createdAt: string | null;
    items: {
        productName: string;
        size: string;
        quantity: number;
        unitPrice: number;
    }[];
};

export type ServerCartOverview = {
    items: CartLine[];
    orders: {
        awaitingPayment: CartOrderSummary[];
        paid: CartOrderSummary[];
    };
};

function xsrfHeaders(): Record<string, string> {
    const cookie = document.cookie.split('; ').find((item) => item.startsWith('XSRF-TOKEN='));
    return cookie ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) } : {};
}

async function cartRequest<T>(url: string, method: string, payload?: unknown): Promise<T> {
    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...xsrfHeaders(),
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(response.status === 422 ? 'Stok produk tidak mencukupi.' : 'Keranjang gagal diperbarui.');
    }
    return data as T;
}

export async function loadServerCart(): Promise<CartLine[]> {
    return (await loadServerCartOverview()).items;
}

export async function loadServerCartOverview(): Promise<ServerCartOverview> {
    const response = await fetch(cartRoutes.index.url(), { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Keranjang gagal dimuat.');
    return await response.json() as ServerCartOverview;
}

export async function saveCartLine(product: Product, variant: StoreVariant, quantity: number, isAuthenticated: boolean): Promise<void> {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99 || quantity > variant.stock) {
        throw new Error('Jumlah produk tidak valid.');
    }

    if (isAuthenticated) {
        await cartRequest(cartRoutes.items.store.url(), 'POST', { variant_id: variant.id, quantity });
        window.dispatchEvent(new Event('mellif-cart-updated'));
        return;
    }

    const cart = readGuestCart();
    const existing = cart.find((line) => line.variant.id === variant.id);
    if (existing && existing.quantity + quantity > variant.stock) throw new Error('Stok produk tidak mencukupi.');
    if (existing) existing.quantity += quantity;
    else cart.push({ product, variant, quantity });
    localStorage.setItem('mellif-cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('mellif-cart-updated'));
}

export async function setServerCart(items: CartLine[]): Promise<void> {
    const currentItems = await loadServerCart();
    const nextIds = new Set(items.map((line) => line.variant.id));
    const previousIds = new Set(currentItems.map((line) => line.variant.id));
    const operations: Promise<unknown>[] = [];

    for (const previous of currentItems) {
        if (!nextIds.has(previous.variant.id)) {
            operations.push(cartRequest(cartRoutes.items.destroy.url({ variant: previous.variant.id }), 'DELETE'));
        }
    }
    for (const line of items) {
        if (previousIds.has(line.variant.id)) {
            operations.push(cartRequest(cartRoutes.items.update.url({ variant: line.variant.id }), 'PUT', { quantity: line.quantity }));
        } else {
            operations.push(cartRequest(cartRoutes.items.store.url(), 'POST', { variant_id: line.variant.id, quantity: line.quantity }));
        }
    }

    await Promise.all(operations);
    window.dispatchEvent(new Event('mellif-cart-updated'));
}

export async function removeServerCartLine(variantId: number): Promise<void> {
    await cartRequest(cartRoutes.items.destroy.url({ variant: variantId }), 'DELETE');
    window.dispatchEvent(new Event('mellif-cart-updated'));
}

export async function mergeGuestCart(): Promise<void> {
    const guestItems = readGuestCart();
    if (guestItems.length === 0) return;

    await cartRequest(cartRoutes.sync.url(), 'POST', {
        items: guestItems.map((line) => ({ variant_id: line.variant.id, quantity: line.quantity })),
    });
    localStorage.removeItem('mellif-cart');
}

export function readGuestCart(): CartLine[] {
    try {
        const value: unknown = JSON.parse(localStorage.getItem('mellif-cart') ?? '[]');
        return Array.isArray(value) ? value as CartLine[] : [];
    } catch {
        return [];
    }
}
