# Daftar Fitur Produk — Aplikasi Penjadwalan Klinik Kesehatan (Pijat & Facial)

Dokumen ini merangkum fitur dari PRD v1.0 beserta keputusan hasil klarifikasi pengguna.

## Keputusan Teknis & Produk
- **Penyimpanan Data**: Menggunakan database cloud Firestore (`workspaces/<workspaceId>`) yang tersinkron otomatis lintas browser dan perangkat serta mendukung ruang kerja terpisah sesuai akun Admin pemilik, dilengkapi cadangan/pulihkan JSON dan ekspor CSV (Reservasi, Layanan, Terapis, Pendapatan).
- **Keamanan Akses**: Login menggunakan username dan kata sandi melalui Firebase Authentication (Email/Password dengan format internal `@naomi.klinik`, tidak tersambung ke akun Google). Tersedia satu akun **Admin Master** yang dapat diakses dari berbagai browser, serta pembuatan akun Terapis atau Admin tambahan hanya melalui menu **Manajemen Akun**.
- **Operasional**: 7 hari seminggu (Senin–Minggu), pukul 10.00–21.00, jeda antarsesi 0 menit, kapasitas mengikuti jumlah terapis aktif.

## Daftar Fitur

| Kode | Nama Fitur | Prioritas | Ketergantungan | Status |
| :--- | :--- | :--- | :--- | :--- |
| FT-01 | Tampilan Kalender & Slot Harian Terapis | Must Have | FT-02, FT-06 | Selesai |
| FT-02 | Manajemen Katalog Layanan | Must Have | - | Selesai |
| FT-03 | Formulir Pembuatan Reservasi | Must Have | FT-02, FT-04, FT-06 | Selesai |
| FT-04 | Validasi Slot Otomatis | Must Have | FT-01, FT-03 | Selesai |
| FT-05 | Pengelolaan Status & Pembatalan Jadwal | Must Have | FT-01, FT-03, FT-04 | Selesai |
| FT-06 | Manajemen Data Terapis (Tambah & Kelola Staf) | Should Have | - | Selesai |
| FT-07 | Manajemen Akun & Kunci Akses Lokal | Should Have | FT-06 | Selesai |
| FT-08 | Rekapitulasi Pendapatan Harian, Mingguan, dan Bulanan | Should Have | FT-02, FT-03, FT-05, FT-06 | Selesai |
