# Keputusan Desain - Aplikasi Penjadwalan Naomi Beauty & Wellness

Dokumen ini mencatat seluruh keputusan desain yang telah disetujui pengguna.

## Keputusan Pengguna
- **Identitas & Logo**: Nama klinik menggunakan **Naomi Beauty & Wellness** dengan logo lingkaran resmi (`/assets/aistudio/WhatsApp_Image_2026-11-20_at_13.29.01_0e292a8c.jpeg`) pada layar masuk, bilah navigasi atas, dan ikon tab browser.
- **Kesan Visual & Tipografi**: Ramah dan hangat menggunakan **Plus Jakarta Sans** (ketebalan 400, 500, 600, 700), dipasang lokal via npm (`@fontsource/plus-jakarta-sans`).
- **Warna Aksen**: Emas matang (*Gold* / `amber-700` `#B45309` untuk tombol utama dan teks aksen dengan kontras >= 4,5:1; `amber-50` untuk penanda terpilih).
- **Sapaan**: Anda.
- **Susunan Halaman**: Satu halaman dasbor dengan navigasi tab ringkas (Jadwal Harian, Layanan, Terapis, Pendapatan, Database), tombol aksi utama **Buat Reservasi**, serta modul akun dropdown di pojok kanan atas.
- **Penyimpanan**: Database lokal sederhana di browser yang tersimpan terpisah per akun pemilik (`klinik_db_<owner_account_id>`), dilengkapi ekspor/impor cadangan JSON dan ekspor tabel CSV.

## Token Visual
- **Latar Halaman**: `bg-neutral-50` (`#FAFAFA`)
- **Permukaan Kartu/Panel**: `bg-white` (`#FFFFFF`) dengan garis tepi `border-neutral-200` (`1px`)
- **Teks Utama**: `text-neutral-900` (`#171717`)
- **Teks Pendukung**: `text-neutral-600` (`#525252`)
- **Aksen Utama**: `bg-amber-700 hover:bg-amber-800 text-white`, cincin fokus `focus-visible:outline-amber-700`
- **Angka & Jam**: Menggunakan `tabular-nums` dan pemisah titik (`10.00–21.00`) serta format Rupiah tanpa spasi/desimal (`Rp150.000`).
