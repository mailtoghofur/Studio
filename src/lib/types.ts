// Definisi tipe data domain untuk akun pengguna, database per akun, jadwal, layanan, dan terapis.

export type ServiceCategory = 'PIJAT' | 'FACIAL';

export type LocationType = 'CLINIC' | 'HOME_SERVICE';

export type BookingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type TreatmentDiscountPercent = 0 | 10 | 20;

export type UserRole = 'ADMIN' | 'THERAPIST';

export interface UserAccount {
  account_id: string;
  username: string;
  display_name: string;
  role: UserRole;
  therapist_id?: string;
  /** ID akun Admin pemilik database yang dipakai akun ini (kosong berarti memakai database sendiri). */
  owner_account_id?: string;
  /** ID pemilik database pembuat akun untuk pelacakan akun cabang dengan database terpisah. */
  created_by_owner_id?: string;
  /** Penanda satu akun Admin Master utama. */
  is_master: boolean;
  salt: string;
  hash: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Therapist {
  therapist_id: string;
  name: string;
  is_active: boolean;
}

export interface Service {
  service_id: string;
  category: ServiceCategory;
  service_name: string;
  duration_minutes: number;
  price: number;
  allow_home_service: boolean;
}

export interface Product {
  product_id: string;
  product_name: string;
  price: number;
  is_active: boolean;
}

export type ProductSaleStatus = 'COMPLETED' | 'CANCELLED';

export interface ProductSale {
  sale_id: string;
  product_id: string;
  product_name: string;
  therapist_id: string;
  buyer_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  sale_date: string; // YYYY-MM-DD
  notes: string;
  status: ProductSaleStatus;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  booking_id: string;
  patient_name: string;
  patient_phone: string;
  service_id: string;
  therapist_id: string;
  booking_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  location_type: LocationType;
  patient_address: string;
  notes: string;
  status: BookingStatus;
  /** Penanda reservasi gratis hasil penukaran poin kesetiaan (10x pemesanan). */
  is_loyalty_reward?: boolean;
  /** Persentase diskon pilihan saat penyelesaian treatment (0, 10, atau 20). */
  discount_percent?: TreatmentDiscountPercent;
  /** Nominal potongan diskon dalam Rupiah bulat. */
  discount_amount?: number;
  /** Harga akhir transaksi (0 bila memakai hadiah gratis kesetiaan, atau harga setelah diskon). */
  final_price?: number;
  /** Waktu terakhir resi diperbaiki setelah reservasi selesai (ISO string). */
  receipt_revised_at?: string;
  /** Alasan perbaikan resi (opsional). */
  receipt_revision_reason?: string;
  /** Alasan pembatalan reservasi (wajib diisi saat membatalkan reservasi selesai). */
  cancellation_reason?: string;
  /** Waktu pembatalan reservasi (ISO string). */
  cancelled_at?: string;
  /** Status asal sebelum reservasi dibatalkan. */
  cancelled_from_status?: BookingStatus;
  created_at: string;
  updated_at: string;
}

export interface AccountDatabase {
  database_id: string;
  owner_account_id: string;
  owner_username: string;
  therapists: Therapist[];
  services: Service[];
  bookings: Booking[];
  products?: Product[];
  product_sales?: ProductSale[];
  updated_at: string;
}

export interface MasterBundlePayload {
  version: 1;
  exported_at: string;
  accounts: UserAccount[];
  databases: Record<string, AccountDatabase>;
}

export interface TherapistAvailability {
  therapist: Therapist;
  available: boolean;
  reason?: string;
  conflictingBooking?: Booking;
}

export interface BookingFormInput {
  patient_name: string;
  patient_phone: string;
  service_id: string;
  location_type: LocationType;
  patient_address: string;
  booking_date: string;
  start_time: string;
  therapist_id: string;
  notes: string;
}

export type BookingFieldName = keyof BookingFormInput;

export type BookingValidationErrors = Partial<Record<BookingFieldName, string>>;

export interface OperatingHoursCheck {
  valid: boolean;
  startTime: string;
  endTime: string;
  error?: string;
}

export interface BookingValidationResult {
  valid: boolean;
  errors: BookingValidationErrors;
  endTime: string;
  normalizedPhone: string | null;
  effectiveLocationType: LocationType;
}

export interface ConfirmDialogReasonField {
  label: string;
  placeholder: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  initialValue?: string;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  details?: string[];
  reasonField?: ConfirmDialogReasonField;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: (reason?: string) => Promise<void>;
}
