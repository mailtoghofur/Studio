// Konfigurasi utama aturan bisnis PRD, data awal terapis dan layanan, serta awalan penyimpanan database per akun.

import type { BookingStatus, LocationType, Service, ServiceCategory, Therapist } from './lib/types';

export const CLINIC_NAME = 'Naomi Beauty & Wellness';
export const CLINIC_LOGO_SRC = '/assets/aistudio/WhatsApp_Image_2026-11-20_at_13.29.01_0e292a8c.jpeg';

export const CLINIC_HOURS = {
  openTime: '10:00',
  closeTime: '21:00',
  openMinutes: 10 * 60, // 600
  closeMinutes: 21 * 60, // 1260
  slotStepMinutes: 30,
  bufferMinutes: 0,
} as const;

export const MAX_THERAPISTS = 3;
export const THERAPIST_COMMISSION_RATE = 0.1;

export const DEFAULT_THERAPISTS: Therapist[] = [
  { therapist_id: 'T-01', name: 'Sari Wulandari', is_active: true },
  { therapist_id: 'T-02', name: 'Dewi Kartika', is_active: true },
  { therapist_id: 'T-03', name: 'Rina Permata', is_active: true },
];

export const DEFAULT_SERVICES: Service[] = [
  {
    service_id: 'S-01',
    category: 'PIJAT',
    service_name: 'Pijat Relaksasi 60 Menit',
    duration_minutes: 60,
    price: 150000,
    allow_home_service: true,
  },
  {
    service_id: 'S-02',
    category: 'PIJAT',
    service_name: 'Pijat Refleksi 90 Menit',
    duration_minutes: 90,
    price: 210000,
    allow_home_service: true,
  },
  {
    service_id: 'S-03',
    category: 'PIJAT',
    service_name: 'Pijat Tradisional Lengkap 120 Menit',
    duration_minutes: 120,
    price: 280000,
    allow_home_service: true,
  },
  {
    service_id: 'S-04',
    category: 'FACIAL',
    service_name: 'Basic Facial 60 Menit',
    duration_minutes: 60,
    price: 175000,
    allow_home_service: false,
  },
  {
    service_id: 'S-05',
    category: 'FACIAL',
    service_name: 'Facial Detoksifikasi 90 Menit',
    duration_minutes: 90,
    price: 250000,
    allow_home_service: false,
  },
];

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  PIJAT: 'Pijat',
  FACIAL: 'Facial',
};

export const LOCATION_LABELS: Record<LocationType, string> = {
  CLINIC: 'Di Klinik',
  HOME_SERVICE: 'Di Tempat Pasien',
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  SCHEDULED: 'Terjadwal',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const STORAGE_KEY = 'klinik_penjadwalan_v1';
export const DB_KEY_PREFIX = 'klinik_db_';
