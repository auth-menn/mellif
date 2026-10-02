import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const messages = {
    ID: {
        'nav.home': 'Home', 'nav.shop': 'Shop', 'nav.about': 'About Us', 'nav.openMenu': 'Buka menu', 'nav.closeMenu': 'Tutup menu',
        'nav.search': 'Cari produk', 'nav.cart': 'Keranjang', 'nav.account': 'Akun', 'nav.login': 'Login', 'nav.myOrders': 'Pesanan Saya',
        'nav.logout': 'Logout', 'nav.viewStore': 'Lihat toko', 'nav.closePanel': 'Tutup panel', 'nav.language': 'Ganti bahasa',
        'auth.welcome': 'Selamat datang kembali', 'auth.createAccount': 'Buat akun Mellif', 'auth.description': 'Masuk atau daftar untuk melanjutkan pesanan Anda.',
        'auth.google': 'Lanjutkan dengan Google', 'auth.orEmail': 'atau dengan email', 'auth.login': 'Login', 'auth.register': 'Register',
        'auth.name': 'Nama', 'auth.email': 'Email', 'auth.password': 'Password', 'auth.confirmPassword': 'Konfirmasi password',
        'auth.invalid': 'Data tidak valid.', 'auth.failed': 'Autentikasi gagal. Periksa data lalu coba lagi.', 'auth.connectionFailed': 'Koneksi gagal. Coba lagi.',
        'auth.popupBlocked': 'Popup diblokir browser. Izinkan popup untuk melanjutkan.', 'auth.processing': 'Memproses…', 'auth.createButton': 'Buat akun',
        'cart.title': 'Keranjang', 'cart.empty': 'Keranjang Anda masih kosong.', 'cart.size': 'Ukuran', 'cart.quantity': 'Jumlah',
        'cart.remove': 'Hapus', 'cart.checkout': 'Lanjut ke checkout', 'cart.loadFailed': 'Keranjang gagal dimuat. Muat ulang halaman untuk mencoba lagi.',
        'cart.updateFailed': 'Keranjang gagal diperbarui.', 'cart.added': 'Ditambahkan ke keranjang', 'cart.addFailed': 'Keranjang gagal diperbarui.',
        'home.eyebrow': 'Independent local label', 'home.tagline': 'Made to move with your own rhythm.', 'home.shopNow': 'Shop Now', 'home.collection': 'Mellif / Collection 01',
        'home.title': 'Mellif — Local Goods',
        'about.eyebrow': 'Cerita kami', 'about.title': 'Akar lokal.\nRuang untuk menjadi diri sendiri.', 'about.body': 'Mellif adalah ruang untuk karya lokal dan keseharian yang lebih personal. Kami membuat pakaian dengan perhatian pada bentuk, fungsi, dan cerita di baliknya.',
        'shop.title': 'Semua Produk', 'shop.search': 'Cari produk', 'shop.filter': 'Filter', 'shop.sort': 'Urutan', 'shop.popular': 'Terpopuler',
        'shop.newest': 'Terbaru', 'shop.priceLow': 'Harga terendah', 'shop.priceHigh': 'Harga tertinggi', 'shop.category': 'Kategori',
        'shop.productType': 'Tipe Produk', 'shop.allProducts': 'Semua Produk', 'shop.featured': 'Produk Unggulan', 'shop.discount': 'Diskon',
        'shop.availability': 'Ketersediaan', 'shop.inStock': 'Ada stok', 'shop.price': 'Harga', 'shop.min': 'Min', 'shop.max': 'Maks', 'shop.apply': 'Terapkan',
        'shop.notFound': 'Produk tidak ditemukan.', 'shop.productCount': 'produk', 'shop.pageCount': 'halaman', 'shop.closeFilter': 'Tutup filter', 'shop.previous': 'Sebelumnya', 'shop.next': 'Berikutnya',
        'product.lowStock': 'STOK MENIPIS', 'product.soldOut': 'HABIS', 'product.buy': 'Beli', 'product.chooseSize': 'Pilih ukuran',
        'product.quantity': 'Jumlah', 'product.addToCart': 'Tambah ke Keranjang', 'product.buyNow': 'Beli Sekarang', 'product.available': 'item tersedia',
        'product.recommendations': 'Rekomendasi', 'product.close': 'Tutup', 'product.backToShop': 'Kembali ke katalog',
        'checkout.title': 'Checkout', 'checkout.recipient': 'Nama penerima', 'checkout.phone': 'Nomor HP', 'checkout.address': 'Alamat',
        'checkout.addressDetail': 'Detail alamat (opsional)', 'checkout.courier': 'Ekspedisi', 'checkout.payment': 'Metode pembayaran',
        'checkout.summary': 'Ringkasan pesanan', 'checkout.empty': 'Keranjang Anda kosong.', 'checkout.chooseProduct': 'Pilih produk',
        'checkout.subtotal': 'Subtotal', 'checkout.shipping': 'Pengiriman', 'checkout.total': 'Total', 'checkout.placeOrder': 'Order Sekarang',
        'checkout.accepted': 'Pesanan diterima', 'checkout.thanks': 'Terima kasih sudah berbelanja.', 'checkout.orderNumber': 'Nomor order Anda',
        'checkout.paymentLater': 'Pembayaran QRIS dan unggah bukti pembayaran akan tersedia pada fase berikutnya.', 'checkout.continueShopping': 'Lanjut belanja',
        'checkout.authRequired': 'Login diperlukan untuk melanjutkan pesanan.',
        'admin.label': 'CMS', 'admin.dashboard': 'Dashboard', 'admin.products': 'Produk', 'admin.categories': 'Kategori', 'admin.orders': 'Pesanan',
        'admin.shipping': 'Ekspedisi', 'admin.homeSettings': 'Pengaturan Beranda', 'admin.summary': 'Ringkasan', 'admin.ordersToday': 'Order hari ini',
        'admin.pendingOrders': 'Order pending', 'admin.totalProducts': 'Total produk', 'admin.lowStock': 'Varian stok menipis',
        'admin.recentOrders': 'Pesanan terbaru', 'admin.orderNumber': 'Nomor', 'admin.customer': 'Pelanggan', 'admin.status': 'Status',
        'admin.noOrders': 'Belum ada pesanan.', 'admin.catalog': 'Katalog', 'admin.addProduct': 'Tambah produk', 'admin.productSearch': 'Cari nama produk',
        'admin.search': 'Cari', 'admin.price': 'Harga', 'admin.stock': 'Stok', 'admin.action': 'Aksi', 'admin.active': 'Aktif',
        'admin.inactive': 'Nonaktif', 'admin.featured': 'Unggulan', 'admin.edit': 'Edit', 'admin.delete': 'Hapus', 'admin.noProducts': 'Tidak ada produk.',
        'admin.disableProductConfirm': 'Nonaktifkan produk ini?', 'admin.newProduct': 'Produk baru', 'admin.editProduct': 'Edit produk',
        'admin.back': 'Kembali', 'admin.category': 'Kategori', 'admin.productName': 'Nama produk', 'admin.priceRupiah': 'Harga (Rp)',
        'admin.discountPercent': 'Diskon (%)', 'admin.description': 'Deskripsi', 'admin.variants': 'Varian ukuran dan stok', 'admin.size': 'Ukuran',
        'admin.newSize': 'Ukuran baru', 'admin.openingStock': 'Stok awal', 'admin.addVariant': 'Tambah varian', 'admin.keepImage': 'Pertahankan',
        'admin.orderImage': 'Urutan gambar', 'admin.activeToggle': 'Aktif', 'admin.featuredToggle': 'Unggulan', 'admin.saveProduct': 'Simpan produk',
        'admin.saving': 'Menyimpan…', 'admin.uploadProductImages': 'Gambar produk (JPG, PNG, WebP · maks. 4 MB/file)',
        'admin.newCategory': 'Kategori baru', 'admin.name': 'Nama', 'admin.slug': 'Slug', 'admin.autoSlug': 'Otomatis dari nama', 'admin.order': 'Urutan',
        'admin.productCount': 'Produk', 'admin.save': 'Simpan', 'admin.deleteCategoryConfirm': 'Hapus kategori', 'admin.categoryInUse': 'Kategori masih digunakan produk.',
        'admin.newCourier': 'Ekspedisi baru', 'admin.editCourier': 'Edit ekspedisi', 'admin.code': 'Kode', 'admin.flatShipping': 'Ongkir flat (Rp)',
        'admin.deleteCourierConfirm': 'Hapus ekspedisi ini?', 'admin.filterStatus': 'Filter status', 'admin.all': 'Semua', 'admin.waitingPayment': 'Menunggu pembayaran',
        'admin.paid': 'Dibayar', 'admin.processing': 'Diproses', 'admin.rejected': 'Ditolak', 'admin.cancelled': 'Dibatalkan', 'admin.date': 'Tanggal',
        'admin.detail': 'Detail', 'admin.orderDetails': 'Detail pesanan', 'admin.recipientData': 'Data penerima', 'admin.phone': 'Telepon',
        'admin.address': 'Alamat', 'admin.account': 'Akun', 'admin.orderItems': 'Item pesanan', 'admin.sizeLabel': 'Ukuran', 'admin.qty': 'Qty',
        'admin.updateStatus': 'Ubah status', 'admin.rejectOrder': 'Tolak pesanan', 'admin.cancelOrder': 'Batalkan pesanan', 'admin.notes': 'Catatan',
        'admin.saveStatus': 'Simpan status', 'admin.terminalOrder': 'Status pesanan yang sudah ditutup tidak dapat diubah.',
        'admin.tagline': 'Tagline', 'admin.heroUpload': 'Gambar hero (JPG, PNG, WebP · maks. 5 MB)', 'admin.heroPreview': 'Preview hero',
        'admin.saveHome': 'Simpan pengaturan', 'admin.noCourier': 'Belum ada ekspedisi.', 'admin.allRights': 'Independent style. Made for every day.',
        'admin.orderPageTitle': 'Pesanan — CMS Mellif', 'admin.detailPageTitle': 'Detail pesanan',
        'admin.orderDate': 'Tanggal', 'admin.recipient': 'Nama penerima', 'admin.payment': 'Pembayaran', 'admin.subtotal': 'Subtotal',
        'admin.total': 'Total', 'admin.shippingCost': 'Ongkos kirim', 'admin.dashboardLink': 'Dashboard', 'admin.heroImageAlt': 'Preview gambar hero',
        'common.close': 'Tutup', 'common.error': 'Terjadi kesalahan. Coba lagi.', 'common.idr': 'IDR',
    },
    EN: {
        'nav.home': 'Home', 'nav.shop': 'Shop', 'nav.about': 'About Us', 'nav.openMenu': 'Open menu', 'nav.closeMenu': 'Close menu',
        'nav.search': 'Search products', 'nav.cart': 'Cart', 'nav.account': 'Account', 'nav.login': 'Log in', 'nav.myOrders': 'My orders',
        'nav.logout': 'Log out', 'nav.viewStore': 'View store', 'nav.closePanel': 'Close panel', 'nav.language': 'Change language',
        'auth.welcome': 'Welcome back', 'auth.createAccount': 'Create your Mellif account', 'auth.description': 'Log in or register to continue your order.',
        'auth.google': 'Continue with Google', 'auth.orEmail': 'or continue with email', 'auth.login': 'Log in', 'auth.register': 'Register',
        'auth.name': 'Name', 'auth.email': 'Email', 'auth.password': 'Password', 'auth.confirmPassword': 'Confirm password',
        'auth.invalid': 'Please check the submitted information.', 'auth.failed': 'Authentication failed. Check your details and try again.', 'auth.connectionFailed': 'Connection failed. Please try again.',
        'auth.popupBlocked': 'Your browser blocked the popup. Allow popups to continue.', 'auth.processing': 'Working…', 'auth.createButton': 'Create account',
        'cart.title': 'Cart', 'cart.empty': 'Your cart is empty.', 'cart.size': 'Size', 'cart.quantity': 'Qty', 'cart.remove': 'Remove',
        'cart.checkout': 'Continue to checkout', 'cart.loadFailed': 'Could not load your cart. Refresh the page to try again.',
        'cart.updateFailed': 'Could not update your cart.', 'cart.added': 'Added to cart', 'cart.addFailed': 'Could not update your cart.',
        'home.eyebrow': 'Independent local label', 'home.tagline': 'Made to move with your own rhythm.', 'home.shopNow': 'Shop now', 'home.collection': 'Mellif / Collection 01',
        'home.title': 'Mellif — Local Goods',
        'about.eyebrow': 'Our story', 'about.title': 'Local roots.\nRoom to be yourself.', 'about.body': 'Mellif is a home for local creativity and more personal everyday style. We make clothing with care for form, function, and the stories behind it.',
        'shop.title': 'All products', 'shop.search': 'Search products', 'shop.filter': 'Filters', 'shop.sort': 'Sort', 'shop.popular': 'Popular',
        'shop.newest': 'Newest', 'shop.priceLow': 'Lowest price', 'shop.priceHigh': 'Highest price', 'shop.category': 'Category',
        'shop.productType': 'Product type', 'shop.allProducts': 'All products', 'shop.featured': 'Featured', 'shop.discount': 'Sale',
        'shop.availability': 'Availability', 'shop.inStock': 'In stock', 'shop.price': 'Price', 'shop.min': 'Min', 'shop.max': 'Max', 'shop.apply': 'Apply',
        'shop.notFound': 'No products found.', 'shop.productCount': 'products', 'shop.pageCount': 'pages', 'shop.closeFilter': 'Close filters', 'shop.previous': 'Previous', 'shop.next': 'Next',
        'product.lowStock': 'LOW STOCK', 'product.soldOut': 'SOLD OUT', 'product.buy': 'Buy', 'product.chooseSize': 'Choose a size',
        'product.quantity': 'Quantity', 'product.addToCart': 'Add to cart', 'product.buyNow': 'Buy now', 'product.available': 'items available',
        'product.recommendations': 'You may also like', 'product.close': 'Close', 'product.backToShop': 'Back to shop',
        'checkout.title': 'Checkout', 'checkout.recipient': 'Recipient name', 'checkout.phone': 'Phone number', 'checkout.address': 'Address',
        'checkout.addressDetail': 'Address details (optional)', 'checkout.courier': 'Courier', 'checkout.payment': 'Payment method',
        'checkout.summary': 'Order summary', 'checkout.empty': 'Your cart is empty.', 'checkout.chooseProduct': 'Browse products',
        'checkout.subtotal': 'Subtotal', 'checkout.shipping': 'Shipping', 'checkout.total': 'Total', 'checkout.placeOrder': 'Place order',
        'checkout.accepted': 'Order received', 'checkout.thanks': 'Thank you for shopping with us.', 'checkout.orderNumber': 'Your order number',
        'checkout.paymentLater': 'QRIS payment and proof upload will be available in a later phase.', 'checkout.continueShopping': 'Continue shopping',
        'checkout.authRequired': 'Log in to continue with your order.',
        'admin.label': 'CMS', 'admin.dashboard': 'Dashboard', 'admin.products': 'Products', 'admin.categories': 'Categories', 'admin.orders': 'Orders',
        'admin.shipping': 'Shipping', 'admin.homeSettings': 'Home page settings', 'admin.summary': 'Overview', 'admin.ordersToday': 'Orders today',
        'admin.pendingOrders': 'Pending orders', 'admin.totalProducts': 'Total products', 'admin.lowStock': 'Low-stock variants',
        'admin.recentOrders': 'Recent orders', 'admin.orderNumber': 'Order number', 'admin.customer': 'Customer', 'admin.status': 'Status',
        'admin.noOrders': 'No orders yet.', 'admin.catalog': 'Catalog', 'admin.addProduct': 'Add product', 'admin.productSearch': 'Search products',
        'admin.search': 'Search', 'admin.price': 'Price', 'admin.stock': 'Stock', 'admin.action': 'Actions', 'admin.active': 'Active',
        'admin.inactive': 'Inactive', 'admin.featured': 'Featured', 'admin.edit': 'Edit', 'admin.delete': 'Delete', 'admin.noProducts': 'No products found.',
        'admin.disableProductConfirm': 'Deactivate this product?', 'admin.newProduct': 'New product', 'admin.editProduct': 'Edit product',
        'admin.back': 'Back', 'admin.category': 'Category', 'admin.productName': 'Product name', 'admin.priceRupiah': 'Price (IDR)',
        'admin.discountPercent': 'Discount (%)', 'admin.description': 'Description', 'admin.variants': 'Size and stock variants', 'admin.size': 'Size',
        'admin.newSize': 'New size', 'admin.openingStock': 'Initial stock', 'admin.addVariant': 'Add variant', 'admin.keepImage': 'Keep image',
        'admin.orderImage': 'Image order', 'admin.activeToggle': 'Active', 'admin.featuredToggle': 'Featured', 'admin.saveProduct': 'Save product',
        'admin.saving': 'Saving…', 'admin.uploadProductImages': 'Product images (JPG, PNG, WebP · max 4 MB/file)',
        'admin.newCategory': 'New category', 'admin.name': 'Name', 'admin.slug': 'Slug', 'admin.autoSlug': 'Generated from name', 'admin.order': 'Sort order',
        'admin.productCount': 'Products', 'admin.save': 'Save', 'admin.deleteCategoryConfirm': 'Delete category', 'admin.categoryInUse': 'This category is used by products.',
        'admin.newCourier': 'New courier', 'admin.editCourier': 'Edit courier', 'admin.code': 'Code', 'admin.flatShipping': 'Flat shipping cost (IDR)',
        'admin.deleteCourierConfirm': 'Delete this courier?', 'admin.filterStatus': 'Filter by status', 'admin.all': 'All', 'admin.waitingPayment': 'Awaiting payment',
        'admin.paid': 'Paid', 'admin.processing': 'Processing', 'admin.rejected': 'Rejected', 'admin.cancelled': 'Cancelled', 'admin.date': 'Date',
        'admin.detail': 'Details', 'admin.orderDetails': 'Order details', 'admin.recipientData': 'Recipient details', 'admin.phone': 'Phone',
        'admin.address': 'Address', 'admin.account': 'Account', 'admin.orderItems': 'Order items', 'admin.sizeLabel': 'Size', 'admin.qty': 'Qty',
        'admin.updateStatus': 'Update status', 'admin.rejectOrder': 'Reject order', 'admin.cancelOrder': 'Cancel order', 'admin.notes': 'Notes',
        'admin.saveStatus': 'Save status', 'admin.terminalOrder': 'A closed order status cannot be changed.',
        'admin.tagline': 'Tagline', 'admin.heroUpload': 'Hero image (JPG, PNG, WebP · max 5 MB)', 'admin.heroPreview': 'Hero preview',
        'admin.saveHome': 'Save home settings', 'admin.noCourier': 'No couriers yet.', 'admin.allRights': 'Independent style. Made for every day.',
        'admin.orderPageTitle': 'Orders — Mellif CMS', 'admin.detailPageTitle': 'Order details',
        'admin.orderDate': 'Date', 'admin.recipient': 'Recipient name', 'admin.payment': 'Payment', 'admin.subtotal': 'Subtotal',
        'admin.total': 'Total', 'admin.shippingCost': 'Shipping cost', 'admin.dashboardLink': 'Dashboard', 'admin.heroImageAlt': 'Hero image preview',
        'common.close': 'Close', 'common.error': 'Something went wrong. Please try again.', 'common.idr': 'IDR',
    },
} as const;

export type Language = keyof typeof messages;
export type TranslationKey = keyof typeof messages.ID;
type Locale = 'id' | 'en';

function languageForLocale(locale: Locale): Language {
    return locale === 'en' ? 'EN' : 'ID';
}

function localeForLanguage(language: Language): Locale {
    return language === 'EN' ? 'en' : 'id';
}

function readLocaleCookie(): string | null {
    return document.cookie.split('; ').find((item) => item.startsWith('locale='))?.split('=')[1] ?? null;
}

function writeLocaleCookie(locale: Locale): void {
    document.cookie = `locale=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

export function useTranslation(): { language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string } {
    const { props } = usePage<{ locale?: string }>();
    const locale: Locale = props.locale === 'en' ? 'en' : 'id';
    const [language, updateLanguage] = useState<Language>(() => languageForLocale(locale));

    useEffect(() => {
        const cookieLocale = readLocaleCookie();
        let initialLanguage = languageForLocale(locale);

        if (cookieLocale === null) {
            const legacyLanguage = localStorage.getItem('mellif-language');

            if (legacyLanguage === 'EN' || legacyLanguage === 'ID') {
                initialLanguage = legacyLanguage;
            }
        }

        localStorage.removeItem('mellif-language');
        writeLocaleCookie(localeForLanguage(initialLanguage));
        updateLanguage(initialLanguage);

        const refresh = (): void => {
            const currentLocale = readLocaleCookie();

            if (currentLocale === 'id' || currentLocale === 'en') {
                updateLanguage(languageForLocale(currentLocale));
            }
        };

        window.addEventListener('mellif-language-changed', refresh);
        return () => {
            window.removeEventListener('mellif-language-changed', refresh);
        };
    }, []);

    useEffect(() => {
        document.documentElement.lang = localeForLanguage(language);
    }, [language]);

    const setLanguage = (next: Language): void => {
        updateLanguage(next);
        writeLocaleCookie(localeForLanguage(next));
        window.dispatchEvent(new Event('mellif-language-changed'));
    };

    return { language, setLanguage, t: (key) => messages[language][key] };
}
