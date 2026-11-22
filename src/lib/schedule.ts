// Logika bisnis penjadwalan: jam operasional 10.00-21.00, anti-bentrok 3 terapis, jeda 0 menit, dan aturan lokasi.

import { CATEGORY_LABELS, CLINIC_HOURS } from '../config';
import { formatTimeDisplay, formatTimeRange, normalizeIndoPhone, parseDateParts } from './format';
import type {
  Booking,
  BookingFormInput,
  BookingValidationErrors,
  BookingValidationResult,
  LocationType,
  OperatingHoursCheck,
  Service,
  Therapist,
  TherapistAvailability,
} from './types';

export function isValidTimeFormat(hhmm: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
  if (!isValidTimeFormat(startTime)) return '';
  return minutesToTime(timeToMinutes(startTime) + durationMinutes);
}

/**
 * BL-01: Klinik beroperasi 10.00–21.00 (600–1260 menit).
 * Jadwal diterima jika T_start >= 10:00 dan T_end <= 21:00.
 */
export function validateOperatingHours(
  startTime: string,
  durationMinutes: number
): OperatingHoursCheck {
  if (!isValidTimeFormat(startTime)) {
    return {
      valid: false,
      startTime,
      endTime: '',
      error: 'Masukkan jam mulai dengan format HH:MM, contoh 10:00.',
    };
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  const endTime = minutesToTime(endMinutes);

  if (startMinutes < CLINIC_HOURS.openMinutes) {
    return {
      valid: false,
      startTime,
      endTime,
      error: `Jam mulai ${formatTimeDisplay(startTime)} lebih awal dari jam buka klinik (10.00–21.00).`,
    };
  }

  if (endMinutes > CLINIC_HOURS.closeMinutes) {
    return {
      valid: false,
      startTime,
      endTime,
      error: `Layanan selesai pukul ${formatTimeDisplay(endTime)}, melebihi jam operasional klinik (10.00–21.00).`,
    };
  }

  return {
    valid: true,
    startTime,
    endTime,
  };
}

/**
 * BL-02 & BL-03: Bentrok terjadi jika (T_start_baru < T_end_lama) && (T_end_baru > T_start_lama).
 * Jeda 0 menit (T_start_baru === T_end_lama) menghasilkan false (tidak bentrok).
 */
export function hasTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);
  return aStart < bEnd && aEnd > bStart;
}

export function getTherapistAvailabilities(params: {
  therapists: Therapist[];
  bookings: Booking[];
  bookingDate: string;
  startTime: string;
  durationMinutes: number;
  excludeBookingId?: string;
}): TherapistAvailability[] {
  const { therapists, bookings, bookingDate, startTime, durationMinutes, excludeBookingId } = params;
  const validStart = isValidTimeFormat(startTime) && durationMinutes > 0;
  const endTime = validStart ? calculateEndTime(startTime, durationMinutes) : '';

  return therapists.map((therapist) => {
    if (!therapist.is_active) {
      return {
        therapist,
        available: false,
        reason: 'Nonaktif',
      };
    }

    if (!validStart || !bookingDate) {
      return {
        therapist,
        available: true,
      };
    }

    const activeBookingsForTherapist = bookings.filter(
      (b) =>
        b.therapist_id === therapist.therapist_id &&
        b.booking_date === bookingDate &&
        b.status === 'SCHEDULED' &&
        b.booking_id !== excludeBookingId
    );

    const conflict = activeBookingsForTherapist.find((b) =>
      hasTimeOverlap(startTime, endTime, b.start_time, b.end_time)
    );

    if (conflict) {
      return {
        therapist,
        available: false,
        reason: `Bentrok ${formatTimeRange(conflict.start_time, conflict.end_time)}`,
        conflictingBooking: conflict,
      };
    }

    return {
      therapist,
      available: true,
    };
  });
}

export function generateTimeSlotOptions(): string[] {
  const options: string[] = [];
  for (
    let m = CLINIC_HOURS.openMinutes;
    m < CLINIC_HOURS.closeMinutes;
    m += CLINIC_HOURS.slotStepMinutes
  ) {
    options.push(minutesToTime(m));
  }
  return options;
}

export function getEffectiveLocationType(
  service: Service | undefined,
  requestedLocation: LocationType
): LocationType {
  if (!service) return requestedLocation;
  if (service.category === 'FACIAL' || !service.allow_home_service) {
    return 'CLINIC';
  }
  return requestedLocation;
}

export function validateBookingInput(
  input: BookingFormInput,
  context: {
    services: Service[];
    therapists: Therapist[];
    bookings: Booking[];
    excludeBookingId?: string;
  }
): BookingValidationResult {
  const errors: BookingValidationErrors = {};
  const trimmedName = input.patient_name.trim();
  const trimmedAddress = input.patient_address.trim();

  if (!trimmedName) {
    errors.patient_name = 'Isi nama pasien terlebih dahulu, contoh: Budi Santoso.';
  }

  const normalizedPhone = normalizeIndoPhone(input.patient_phone);
  if (!normalizedPhone) {
    errors.patient_phone =
      'Masukkan nomor WhatsApp/HP Indonesia yang valid, contoh: 081234567890 atau +6281234567890.';
  }

  const selectedService = context.services.find((s) => s.service_id === input.service_id);
  if (!selectedService) {
    errors.service_id = 'Pilih salah satu paket layanan Pijat atau Facial.';
  }

  const effectiveLocationType = getEffectiveLocationType(selectedService, input.location_type);

  if (selectedService && selectedService.category === 'PIJAT' && effectiveLocationType === 'HOME_SERVICE') {
    if (!trimmedAddress) {
      errors.patient_address =
        'Alamat lengkap pasien wajib diisi untuk layanan Pijat di tempat pasien, contoh: Jl. Melati No. 12, Jakarta Selatan.';
    }
  }

  if (!parseDateParts(input.booking_date)) {
    errors.booking_date = 'Pilih tanggal layanan yang valid, contoh: 2026-11-20.';
  }

  let computedEndTime = '';
  if (selectedService) {
    const hoursCheck = validateOperatingHours(input.start_time, selectedService.duration_minutes);
    computedEndTime = hoursCheck.endTime;
    if (!hoursCheck.valid && hoursCheck.error) {
      errors.start_time = hoursCheck.error;
    }
  } else if (!isValidTimeFormat(input.start_time)) {
    errors.start_time = 'Pilih jam mulai layanan antara 10.00 sampai 20.30.';
  }

  const availabilities = getTherapistAvailabilities({
    therapists: context.therapists,
    bookings: context.bookings,
    bookingDate: input.booking_date,
    startTime: input.start_time,
    durationMinutes: selectedService?.duration_minutes ?? 0,
    excludeBookingId: context.excludeBookingId,
  });

  const anyTherapistAvailable = availabilities.some((a) => a.available);

  if (!input.therapist_id) {
    errors.therapist_id = anyTherapistAvailable
      ? 'Pilih salah satu terapis yang berstatus Tersedia.'
      : 'Semua terapis aktif sudah terisi pada jam tersebut. Silakan pilih jam mulai lain.';
  } else {
    const selectedAvailability = availabilities.find(
      (a) => a.therapist.therapist_id === input.therapist_id
    );
    if (!selectedAvailability) {
      errors.therapist_id = 'Terapis tidak ditemukan. Silakan pilih ulang.';
    } else if (!selectedAvailability.available) {
      const otherAvailable = availabilities.filter((a) => a.available).map((a) => a.therapist.name);
      if (otherAvailable.length > 0) {
        errors.therapist_id = `${selectedAvailability.therapist.name} tidak tersedia (${selectedAvailability.reason}). Pilih terapis tersedia: ${otherAvailable.join(', ')}.`;
      } else {
        errors.therapist_id = `Semua terapis tidak tersedia pada jam ini (${selectedAvailability.reason}). Pilih waktu lain.`;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    endTime: computedEndTime,
    normalizedPhone,
    effectiveLocationType,
  };
}

export function matchesServiceSearch(
  service: Service | undefined,
  rawQuery: string,
  fallbackServiceId?: string
): boolean {
  const tokens = rawQuery
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = service
    ? `${service.service_name} ${CATEGORY_LABELS[service.category]} ${service.duration_minutes} menit ${service.service_id}`.toLowerCase()
    : (fallbackServiceId ?? '').toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

export function filterServicesByQuery(services: Service[], rawQuery: string): Service[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return services;
  return services.filter((service) => matchesServiceSearch(service, trimmed));
}

export const CANCELLATION_REASON_MIN_LENGTH = 3;
export const CANCELLATION_REASON_MAX_LENGTH = 200;

export function validateCancellationReason(
  rawReason: string,
  required: boolean
): { valid: boolean; trimmedReason: string; error?: string } {
  const trimmedReason = rawReason.trim();
  if (required && !trimmedReason) {
    return {
      valid: false,
      trimmedReason,
      error:
        'Isi alasan pembatalan reservasi selesai, contoh: Pasien membatalkan setelah pembayaran.',
    };
  }
  if (trimmedReason && trimmedReason.length < CANCELLATION_REASON_MIN_LENGTH) {
    return {
      valid: false,
      trimmedReason,
      error: `Alasan pembatalan minimal ${CANCELLATION_REASON_MIN_LENGTH} karakter, contoh: Salah input jadwal selesai.`,
    };
  }
  if (trimmedReason.length > CANCELLATION_REASON_MAX_LENGTH) {
    return {
      valid: false,
      trimmedReason,
      error: `Alasan pembatalan maksimal ${CANCELLATION_REASON_MAX_LENGTH} karakter.`,
    };
  }
  return { valid: true, trimmedReason };
}

export function validateAndCancelBooking(params: {
  booking: Booking;
  reason: string;
  nowIso?: string;
}): { valid: boolean; error?: string; updatedBooking?: Booking } {
  const { booking, reason, nowIso = new Date().toISOString() } = params;

  if (booking.status === 'CANCELLED') {
    return {
      valid: false,
      error: 'Reservasi ini sudah berstatus Dibatalkan.',
    };
  }

  const requiresReason = booking.status === 'COMPLETED';
  const check = validateCancellationReason(reason, requiresReason);
  if (!check.valid) {
    return {
      valid: false,
      error: check.error,
    };
  }

  const updatedBooking: Booking = {
    ...booking,
    status: 'CANCELLED',
    cancellation_reason: check.trimmedReason || undefined,
    cancelled_at: nowIso,
    cancelled_from_status: booking.status,
    updated_at: nowIso,
  };

  return {
    valid: true,
    updatedBooking,
  };
}
