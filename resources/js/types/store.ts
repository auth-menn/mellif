export type StoreVariant = { id: number; size: string; stock: number };

export type Product = {
    id: number;
    name: string;
    slug: string;
    description: string;
    price: number;
    weight: number;
    discount_percent: number | null;
    discounted_price: number;
    is_featured: boolean;
    category: string | null;
    images: string[];
    variants: StoreVariant[];
    stock: number;
};

export type CartLine = {
    product: Product;
    variant: StoreVariant;
    quantity: number;
};

export const money = (amount: number): string =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);
