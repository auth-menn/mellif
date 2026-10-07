import { Form, Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, Check, MapPin, UserRound } from 'lucide-react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/profile';
import { resetLink } from '@/routes/password';
import { index as shopIndex } from '@/routes/shop';
import type { Auth } from '@/types';
import { send } from '@/routes/verification';

type PageProps = {
    auth: Auth;
};

const inputClassName = 'mt-2 h-12 rounded-none border-neutral-300 bg-white px-4 text-sm shadow-none focus-visible:border-black focus-visible:ring-1 focus-visible:ring-black/20';

export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;
    const initials = user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');

    return (
        <>
            <Head title="Profil Saya" />

            <main className="min-h-screen bg-[#f7f6f3] px-4 pb-20 pt-24 text-[#171815] sm:px-7 sm:pt-28">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-neutral-300 pb-6 sm:mb-10">
                        <div>
                            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
                                Mellif Studio / Akun
                            </p>
                            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
                                Profil Saya
                            </h1>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
                                Simpan informasi kontak dan alamat pengiriman agar proses pesanan berikutnya lebih mudah.
                            </p>
                        </div>
                        <Link
                            href={shopIndex.url()}
                            className="inline-flex items-center gap-2 pb-1 text-sm font-medium transition-colors hover:text-neutral-500"
                        >
                            Lanjut belanja <ArrowRight size={16} />
                        </Link>
                    </div>

                    <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
                        <aside className="bg-black p-6 text-white sm:p-7">
                            <div className="grid size-14 place-items-center border border-white/30 text-lg font-medium tracking-wide">
                                {initials || <UserRound size={22} strokeWidth={1.5} />}
                            </div>
                            <p className="mt-5 text-lg font-medium">{user.name}</p>
                            <p className="mt-1 break-all text-sm text-white/65">{user.email}</p>
                            <div className="mt-7 border-t border-white/20 pt-5">
                                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/70">
                                    <MapPin size={14} /> Alamat pengiriman
                                </p>
                                <p className="mt-3 text-sm leading-6 text-white/90">
                                    {user.address || 'Tambahkan alamat agar siap digunakan saat checkout.'}
                                </p>
                            </div>
                            <div className="mt-6 flex items-center gap-2 text-xs text-white/65">
                                <span className="size-1.5 rounded-full bg-white/80" />
                                Akun Mellif Studio
                            </div>
                        </aside>

                        <section className="border border-neutral-300 bg-white p-5 sm:p-8 lg:p-10">
                            <div className="mb-7 border-b border-neutral-200 pb-5">
                                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                                    Informasi pribadi
                                </p>
                                <h2 className="mt-2 text-xl font-medium">Detail akun & alamat</h2>
                            </div>

                            <Form
                                {...ProfileController.update.form()}
                                options={{ preserveScroll: true }}
                                className="space-y-8"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                                            <div className="grid gap-1">
                                                <Label htmlFor="name" className="text-sm font-medium text-neutral-800">Nama lengkap</Label>
                                                <Input id="name" className={inputClassName} defaultValue={user.name} name="name" required autoComplete="name" placeholder="Nama lengkap" />
                                                <InputError message={errors.name} />
                                            </div>
                                            <div className="grid gap-1">
                                                <Label htmlFor="email" className="text-sm font-medium text-neutral-800">Alamat email</Label>
                                                <Input id="email" type="email" className={inputClassName} defaultValue={user.email} name="email" required autoComplete="username" placeholder="nama@email.com" />
                                                <InputError message={errors.email} />
                                            </div>
                                            <div className="grid gap-1 sm:col-span-2">
                                                <Label htmlFor="phone" className="text-sm font-medium text-neutral-800">Nomor telepon</Label>
                                                <Input id="phone" type="tel" className={inputClassName} defaultValue={user.phone ?? ''} name="phone" autoComplete="tel" placeholder="08xxxxxxxxxx" />
                                                <InputError message={errors.phone} />
                                            </div>
                                        </div>

                                        {mustVerifyEmail && user.email_verified_at === null && (
                                            <div className="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                                                <p>Email Anda belum terverifikasi.{' '}
                                                    <Link href={send()} as="button" className="font-medium underline underline-offset-4">Kirim ulang tautan verifikasi</Link>
                                                </p>
                                                {status === 'verification-link-sent' && <p className="mt-2">Tautan verifikasi baru telah dikirim ke email Anda.</p>}
                                            </div>
                                        )}

                                        {status === 'profile-updated' && (
                                            <div role="status" className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                                                <Check size={16} /> Profil berhasil diperbarui.
                                            </div>
                                        )}

                                        <div className="border-t border-neutral-200 pt-7">
                                            <div className="mb-5">
                                                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Untuk pengiriman</p>
                                                <h3 className="mt-2 text-lg font-medium">Alamat utama</h3>
                                            </div>
                                            <div className="grid gap-5">
                                                <div className="grid gap-1">
                                                    <Label htmlFor="address" className="text-sm font-medium text-neutral-800">Alamat lengkap</Label>
                                                    <textarea id="address" className="mt-2 min-h-32 w-full rounded-none border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black/20" defaultValue={user.address ?? ''} name="address" autoComplete="street-address" placeholder="Nama jalan, nomor rumah, kelurahan, kecamatan, kota, dan kode pos" />
                                                    <InputError message={errors.address} />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label htmlFor="address_detail" className="text-sm font-medium text-neutral-800">Detail alamat <span className="font-normal text-neutral-500">(opsional)</span></Label>
                                                    <textarea id="address_detail" className="mt-2 min-h-24 w-full rounded-none border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black/20" defaultValue={user.address_detail ?? ''} name="address_detail" autoComplete="address-line2" placeholder="Apartemen, lantai, patokan, atau catatan untuk kurir" />
                                                    <InputError message={errors.address_detail} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col-reverse gap-4 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-xs leading-5 text-neutral-500">Informasi ini digunakan untuk membantu pengiriman pesanan Anda.</p>
                                            <button type="submit" disabled={processing} data-test="update-profile-button" className="inline-flex h-12 items-center justify-center bg-black px-8 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60">
                                                {processing ? 'Menyimpan...' : 'Simpan perubahan'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </Form>
                        </section>
                    </div>

                    <section className="mt-8 border border-neutral-300 bg-white p-5 sm:p-8">
                        <div className="mb-7 flex flex-col gap-5 border-b border-neutral-200 pb-7 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Keamanan akun</p>
                                <h2 className="mt-2 text-lg font-medium">Ubah password</h2>
                                <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-600">Kami akan mengirim tautan aman untuk membuat password baru ke {user.email}.</p>
                                {status === 'password-reset-link-sent' && <p role="status" className="mt-3 text-sm text-emerald-700">Tautan ubah password telah dikirim. Periksa kotak masuk email Anda.</p>}
                            </div>
                            <Form {...resetLink.form()} className="shrink-0">
                                {({ processing, errors }) => (
                                    <>
                                        {errors.password_reset && <p role="alert" className="mb-2 max-w-64 text-sm text-red-700">{errors.password_reset}</p>}
                                        <button type="submit" disabled={processing} className="inline-flex h-11 items-center justify-center border border-black px-5 text-sm font-medium text-black transition-colors hover:bg-black hover:text-white disabled:cursor-wait disabled:opacity-60">
                                            {processing ? 'Mengirim email...' : 'Kirim tautan ke email'}
                                        </button>
                                    </>
                                )}
                            </Form>
                        </div>
                        <DeleteUser />
                    </section>
                </div>
            </main>
        </>
    );
}

Profile.layout = {
    breadcrumbs: [{ title: 'Profil Saya', href: edit() }],
};
