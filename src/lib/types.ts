// Definisi tipe data domain untuk akun pengguna, database per akun, jadwal, layanan, dan terapis.

export type ServiceCategory = 'PIJAT' | 'FACIAL';

export type LocationType = 'CLINIC' | 'HOME_SERVICE';

export type BookingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type UserRole = 'ADMIN' | 'THERAPIST';

export interface UserAccount {
  account_id: string;
  uid: string;
  username: string;
  display_name: string;
  role: UserRole;
  therapist_id?: string;
  /** ID workspace database Firestore yang diakses akun ini. */
  workspace_id: string;
  /** ID akun Admin pemilik database yang dipakai bersama dalam satu cabang/klinik. */
  owner_account_id?: string;
  /** UID pembuat akun untuk akun yang memiliki database terpisah. */
  created_by_uid?: string;
  created_by_owner_id?: string;
  is_master: boolean;
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
  updated_at: string;
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

export interface ConfirmDialogState {
  title: string;
  message: string;
  details?: string[];
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => Promise<void>;
}
