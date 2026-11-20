# Daftar Fitur Produk - Aplikasi Penjadwalan Klinik Kesehatan (Pijat & Facial)

Dokumen ini merangkum fitur dari PRD v1.0 beserta keputusan hasil klarifikasi pengguna.

## Keputusan Teknis & Produk
- **Penyimpanan Data**: Menggunakan penyimpanan lokal browser (`localStorage`) dengan database sederhana yang tersimpan terpisah sesuai akun pemilik (`klinik_db_<owner_account_id>`), dilengkapi cadangan/pulihkan JSON, Paket Master (`.json`) untuk pindah browser, dan ekspor CSV (Reservasi, Layanan, Terapis, Pendapatan).
- **Keamanan Akses**: Login menggunakan username dan kata sandi dengan hash SHA-256 ber-salt di browser (tidak tersambung ke akun Google maupun Firebase). Tersedia satu akun **Admin Master** tunggal serta pembuatan akun Terapis atau Admin tambahan hanya melalui menu **Manajemen Akun**.
- **Operasional**: 7 hari seminggu (Senin sampai Minggu), pukul 10.00 sampai 21.00, jeda antarsesi 0 menit, kapasitas mengikuti jumlah terapis aktif.

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
