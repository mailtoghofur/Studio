# Security Specification — Naomi Beauty & Wellness Firestore

## 1. Data Invariants
1. **Master Initialization**: Dokumen `system/meta` hanya dapat dibuat satu kali saat aplikasi belum diinisialisasi (`!exists(/system/meta)`) oleh pengguna terautentikasi yang menjadi `masterUid`, dan tidak dapat diubah atau dihapus sesudahnya.
2. **Verified Admin Gate**: Hak akses Admin diverifikasi dari dokumen server-trusted `/admins/{uid}` serta status aktif di `/users/{uid}` (`is_active == true`), bukan dari klaim klien.
3. **Workspace Isolation**: Setiap database klinik (`workspaces/{workspaceId}`) memiliki `ownerUid` dan daftar `adminUids` terbatas (`<= 10`). Data katalog (`therapists`, `services`) dan `bookings` hanya dapat dibaca/ditulis oleh anggota aktif workspace tersebut.
4. **PII Protection**: Data pribadi pasien (`patient_name`, `patient_phone`, `patient_address`) hanya ada di `/workspaces/{workspaceId}/bookings/{bookingId}` dan hanya boleh diakses oleh Admin workspace atau Terapis yang ditugaskan (`therapist_uid == request.auth.uid`).
5. **Therapist Least Privilege**: Terapis tidak dapat mengubah katalog layanan, daftar terapis, akun pengguna lain, atau menghapus/membuat reservasi; Terapis hanya dapat memperbarui status jadwal miliknya dari `SCHEDULED` menjadi `COMPLETED`.
6. **Temporal & ID Integrity**: Seluruh ID path divalidasi `^[a-zA-Z0-9_\-]+$` (`<= 128` karakter) dan timestamp `createdAt` bersifat immutable dengan `request.time`.

## 2. Dirty Dozen Attack Payloads
1. **Overwrite `system/meta`**: User kedua mencoba `create` atau `update` `system/meta` untuk membajak `masterUid`. -> `PERMISSION_DENIED`.
2. **Self-Assigned Admin Role**: User terapis membuat/mengubah `users/{uid}` dengan `role: 'ADMIN'` atau `is_master: true`. -> `PERMISSION_DENIED`.
3. **Self-Reactivation**: Akun nonaktif (`is_active: false`) mencoba mengubah `is_active: true` pada dokumen dirinya. -> `PERMISSION_DENIED`.
4. **Shadow Field Injection**: Mengirim field liar seperti `isVerified: true` atau `extraRole: 'SUPER'` saat membuat/mengubah `booking` atau `user`. -> `PERMISSION_DENIED` (`hasOnly()`).
5. **Cross-Workspace Booking Read/Write**: Terapis atau Admin Workspace B mencoba membaca atau menulis `workspaces/{workspaceA}/bookings/{id}`. -> `PERMISSION_DENIED`.
6. **Blanket List Query Scraping**: Klien melakukan `getDocs(collection(db, 'users'))` atau `bookings` tanpa filter `owner_uid`/`therapist_uid`/`admin_uids`. -> `PERMISSION_DENIED`.
7. **Therapist Creating/Deleting Booking**: Terapis mencoba `create` atau `delete` pada `bookings/{id}`. -> `PERMISSION_DENIED`.
8. **Terminal State Bypass**: Terapis mencoba mengubah booking yang sudah `COMPLETED` atau `CANCELLED` kembali ke `SCHEDULED`. -> `PERMISSION_DENIED`.
9. **ID Poisoning**: Mengirim `bookingId` atau `workspaceId` sepanjang 500 karakter atau mengandung karakter `/../$`. -> `PERMISSION_DENIED` (`isValidId()`).
10. **Payload Bloat (Denial of Wallet)**: Mengirim `patient_name` 10.000 karakter atau `adminUids` berisi 50 item. -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Mengirim `createdAt` atau `updatedAt` palsu yang tidak sama dengan `request.time`, atau mengubah `createdAt` saat `update`. -> `PERMISSION_DENIED`.
12. **Orphaned Subcollection Write**: Menulis ke `workspaces/WS-FAKE/bookings/B-1` saat dokumen induk `WS-FAKE` tidak ada. -> `PERMISSION_DENIED`.
