# Spesifikasi Keamanan Firestore (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Master Source of Truth (`workspaces/{workspaceId}`)**: Setiap dokumen pada subkoleksi `therapists`, `services`, `products`, `bookings`, dan `product_sales` tidak dapat dibuat tanpa dokumen induk `workspaces/{workspaceId}` yang memiliki `ownerId == request.auth.uid`.
2. **Identity & Verification Integrity**: Seluruh operasi tulis wajib berasal dari pengguna terautentikasi dengan `request.auth.token.email_verified == true`. Field `ownerId` dan `workspaceId` wajib sama persis dengan `request.auth.uid` dan parameter path `workspaceId`, serta bersifat abadi (immutable) setelah dibuat.
3. **Referential Integrity**: Setiap `Booking` wajib merujuk ke `service_id` dan `therapist_id` yang ada di ruang kerja yang sama (`existsAfter`). Setiap `ProductSale` wajib merujuk ke `product_id` dan `therapist_id` yang ada di ruang kerja yang sama.
4. **PII Isolation**: Data `ownerEmail`, `patient_name`, `patient_phone`, dan `patient_address` hanya dapat dibaca (`get` maupun `list`) oleh pemilik dokumen (`resource.data.ownerId == request.auth.uid`) atau admin terverifikasi (`mailtoghofur@gmail.com` dengan `email_verified == true`).
5. **Temporal Integrity**: `createdAt` wajib sama dengan `request.time` saat dibuat dan tetap tidak berubah pada pembaruan; `updatedAt` wajib sama dengan `request.time` saat dibuat maupun diperbarui.
6. **Terminal State Locking**:
   - `Booking` berstatus `CANCELLED` terkunci dari pembaruan berikutnya (kecuali oleh admin sistem).
   - `Booking` berstatus `COMPLETED` tidak boleh dijadwalkan ulang atau diubah statusnya secara bebas; pembaruan hanya diperbolehkan khusus untuk aksi **Perbaikan Resi** yang mempertahankan `status == 'COMPLETED'` dan mengisi `receipt_revised_at` serta `updatedAt == request.time` (atau override admin).
   - `ProductSale` berstatus `CANCELLED` terkunci dari pembaruan berikutnya (kecuali oleh admin sistem).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing (Create Booking for Another User)**:
   - Payload: `bookings/B-ATK-01` dengan `ownerId: "victim-uid"` saat `request.auth.uid == "attacker-uid"`.
   - Harapan: `PERMISSION_DENIED`.
2. **Shadow / Ghost Field Injection (Create Service with Extra Flag)**:
   - Payload: `services/S-ATK-01` dengan semua field valid ditambah `isVerified: true` atau `role: "admin"`.
   - Harapan: `PERMISSION_DENIED` (`hasOnly` menolak field bayangan).
3. **Unverified Email Write Bypass**:
   - Token dengan `email: "mailtoghofur@gmail.com"`, `email_verified: false` mencoba menulis ke `/workspaces/uid-1`.
   - Harapan: `PERMISSION_DENIED`.
4. **Email Spoofing Admin Bypass**:
   - Token dengan `email: "mailtoghofur@gmail.com"`, `email_verified: false` mencoba `get` pada `/workspaces/other-uid/bookings/B-01`.
   - Harapan: `PERMISSION_DENIED`.
5. **PII Blanket Read Attack (`get` Cross-Tenant)**:
   - User terautentikasi `attacker-uid` memanggil `getDoc` ke `/workspaces/victim-uid/bookings/B-01`.
   - Harapan: `PERMISSION_DENIED`.
6. **Query Trust / Unscoped List Attack**:
   - User `attacker-uid` memanggil `getDocs(collection(db, 'workspaces/victim-uid/bookings'))` tanpa filter atau dengan filter UID korban.
   - Harapan: `PERMISSION_DENIED` karena `allow list` mengevaluasi `resource.data.ownerId == request.auth.uid`.
7. **Path / ID Poisoning Attack (Oversized or Invalid ID)**:
   - Menulis ke `/workspaces/uid-1/bookings/B$$INVALID..` atau ID sepanjang 200 karakter.
   - Harapan: `PERMISSION_DENIED` oleh `isValidId()`.
8. **Value Poisoning on Update (Invalid Discount / Price Type)**:
   - Update `bookings/B-01` dengan `discount_percent: 99` atau `patient_name: true` atau string 5000 karakter.
   - Harapan: `PERMISSION_DENIED` karena `isValidBooking()` membungkus seluruh blok `allow update`.
9. **Client Timestamp Forgery**:
   - Create `bookings/B-01` dengan `createdAt: Timestamp.fromDate(new Date('2020-01-01'))` alih-alih `serverTimestamp()`.
   - Harapan: `PERMISSION_DENIED`.
10. **Immutable Field Mutation (`ownerId` / `createdAt` Hijack)**:
    - Update `bookings/B-01` mencoba mengubah `ownerId` atau `createdAt`.
    - Harapan: `PERMISSION_DENIED`.
11. **Terminal State Violation (Reactivating Cancelled Sale or Booking)**:
    - Update `product_sales/SALE-01` dari `status: "CANCELLED"` kembali menjadi `"COMPLETED"`, atau mengubah `bookings/B-01` dari `"CANCELLED"` menjadi `"SCHEDULED"` oleh user biasa.
    - Harapan: `PERMISSION_DENIED`.
12. **Orphaned Booking Write (Missing Parent Workspace or Therapist)**:
    - Menulis `bookings/B-ORPHAN` ke `/workspaces/uid-1/bookings` tanpa dokumen induk `workspaces/uid-1` atau dengan `therapist_id: "T-NONEXISTENT"`.
    - Harapan: `PERMISSION_DENIED` oleh `existsAfter` / `getAfter`.
