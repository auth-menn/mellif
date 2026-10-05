import type { Product } from '@/types/store';

const storageKey = 'mellif-recently-viewed';

export function readRecentlyViewed(): Product[] {
    try {
        const storedProducts: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');

        if (!Array.isArray(storedProducts)) {
            return [];
        }

        return storedProducts.filter((product): product is Product =>
            typeof product === 'object'
            && product !== null
            && 'id' in product
            && typeof product.id === 'number'
            && 'slug' in product
            && typeof product.slug === 'string'
            && 'name' in product
            && typeof product.name === 'string'
            && 'price' in product
            && typeof product.price === 'number'
            && 'discounted_price' in product
            && typeof product.discounted_price === 'number'
            && 'discount_percent' in product
            && (typeof product.discount_percent === 'number' || product.discount_percent === null)
            && 'images' in product
            && Array.isArray(product.images)
            && product.images.every((image: unknown) => typeof image === 'string'),
        ).slice(0, 4);
    } catch {
        return [];
    }
}

export function recordRecentlyViewed(product: Product): void {
    try {
        const updatedProducts = [product, ...readRecentlyViewed().filter((recentProduct) => recentProduct.id !== product.id)].slice(0, 4);
        localStorage.setItem(storageKey, JSON.stringify(updatedProducts));
        window.dispatchEvent(new Event('mellif-recently-viewed-updated'));
    } catch {
        // Ignore storage failures so product navigation still works.
    }
}
