export type User = {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    address_detail?: string | null;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
};
