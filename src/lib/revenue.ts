// Logika perhitungan rekapitulasi pendapatan harian, mingguan, dan bulanan beserta komisi terapis 10% per transaksi (FT-08).

import { THERAPIST_COMMISSION_RATE } from '../config';
import { addDaysYYYYMMDD, formatDateIndo, getTodayYYYYMMDD, parseDateParts } from './format';
import type { Booking, Service, ServiceCategory, Therapist } from './types';

export type RevenuePeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type RevenueStatusScope = 'COMPLETED_ONLY' | 'INCLUDE_SCHEDULED';

export interface PeriodRange {
  periodType: RevenuePeriodType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;
}

export interface ServiceRevenueRow {
  service_id: string;
  service_name: string;
  category: ServiceCategory;
  unit_price: number;
  session_count: number;
  total_revenue: number;
  share_percent: number;
}

export interface TherapistRevenueRow {
  therapist_id: string;
  therapist_name: string;
  session_count: number;
  total_revenue: number;
  total_commission: number;
  share_percent: number;
}

export interface CategoryRevenueSummary {
  category: ServiceCategory;
  session_count: number;
  total_revenue: number;
}

export interface TimelineBucketRow {
  key: string;
  label: string;
  sublabel?: string;
  session_count: number;
  total_revenue: number;
  total_commission: number;
}

export interface DailySessionDetailRow {
  booking: Booking;
  service_name: string;
  category: ServiceCategory | null;
  therapist_name: string;
  amount: number;
  commission: number;
  counted: boolean;
}

export interface RevenueReport {
  range: PeriodRange;
  scope: RevenueStatusScope;
  commissionRate: number;
  totalRevenue: number;
  totalCommission: number;
  netClinicRevenue: number;
  totalSessions: number;
  scheduledPotentialRevenue: number;
  scheduledCount: number;
  cancelledCount: number;
  byCategory: Record<ServiceCategory, CategoryRevenueSummary>;
  byService: ServiceRevenueRow[];
  byTherapist: TherapistRevenueRow[];
  timelineBuckets: TimelineBucketRow[];
  dailySessions: DailySessionDetailRow[];
}

const BULAN_INDO = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function toYYYYMMDD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function calculateTransactionCommission(amount: number): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return Math.round(safeAmount * THERAPIST_COMMISSION_RATE);
}

export function getMonthKeyFromDate(dateStr: string): string {
  const parts = parseDateParts(dateStr);
  if (!parts) {
    return getTodayYYYYMMDD().slice(0, 7);
  }
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

export function addMonthsYYYYMM(monthKey: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  const today = getTodayYYYYMMDD();
  const baseYear = match ? Number(match[1]) : Number(today.slice(0, 4));
  const baseMonth = match ? Number(match[2]) : Number(today.slice(5, 7));

  const shifted = new Date(baseYear, baseMonth - 1 + deltaMonths, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthYearIndo(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) return monthKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return monthKey;
  return `${BULAN_INDO[month - 1]} ${year}`;
}

/**
 * Mengembalikan batas tanggal Senin-Minggu untuk pekan yang memuat `referenceDate`.
 */
export function getWeekRange(referenceDate: string): PeriodRange {
  const parts = parseDateParts(referenceDate);
  const safeDate = parts ? referenceDate : getTodayYYYYMMDD();
  const p = parseDateParts(safeDate)!;
  const dt = new Date(p.year, p.month - 1, p.day);
  // getDay(): 0 = Minggu, 1 = Senin, ..., 6 = Sabtu -> geser agar Senin = 0
  const dayFromMonday = (dt.getDay() + 6) % 7;
  const startDate = addDaysYYYYMMDD(safeDate, -dayFromMonday);
  const endDate = addDaysYYYYMMDD(startDate, 6);

  return {
    periodType: 'WEEKLY',
    startDate,
    endDate,
    label: `${formatDateIndo(startDate)} - ${formatDateIndo(endDate)}`,
  };
}

export function getMonthRange(monthKey: string): PeriodRange {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  const today = getTodayYYYYMMDD();
  const year = match ? Number(match[1]) : Number(today.slice(0, 4));
  const month = match ? Number(match[2]) : Number(today.slice(5, 7));
  const safeMonth = month >= 1 && month <= 12 ? month : Number(today.slice(5, 7));
  const lastDay = new Date(year, safeMonth, 0).getDate();
  const normalizedKey = `${year}-${String(safeMonth).padStart(2, '0')}`;

  return {
    periodType: 'MONTHLY',
    startDate: toYYYYMMDD(year, safeMonth, 1),
    endDate: toYYYYMMDD(year, safeMonth, lastDay),
    label: formatMonthYearIndo(normalizedKey),
  };
}

export function getPeriodRange(
  periodType: RevenuePeriodType,
  referenceDate: string,
  referenceMonth: string
): PeriodRange {
  if (periodType === 'DAILY') {
    const safeDate = parseDateParts(referenceDate) ? referenceDate : getTodayYYYYMMDD();
    return {
      periodType: 'DAILY',
      startDate: safeDate,
      endDate: safeDate,
      label: formatDateIndo(safeDate),
    };
  }
  if (periodType === 'WEEKLY') {
    return getWeekRange(referenceDate);
  }
  return getMonthRange(referenceMonth);
}

function isCountedBooking(booking: Booking, scope: RevenueStatusScope): boolean {
  if (booking.status === 'CANCELLED') return false;
  if (scope === 'COMPLETED_ONLY') {
    return booking.status === 'COMPLETED';
  }
  return booking.status === 'COMPLETED' || booking.status === 'SCHEDULED';
}

export function calculateRevenueReport(params: {
  periodType: RevenuePeriodType;
  referenceDate: string;
  referenceMonth: string;
  scope: RevenueStatusScope;
  bookings: Booking[];
  services: Service[];
  therapists: Therapist[];
}): RevenueReport {
  const { periodType, referenceDate, referenceMonth, scope, bookings, services, therapists } =
    params;

  const range = getPeriodRange(periodType, referenceDate, referenceMonth);
  const serviceMap = new Map(services.map((s) => [s.service_id, s]));
  const therapistMap = new Map(therapists.map((t) => [t.therapist_id, t]));

  const inRangeBookings = bookings.filter(
    (b) => b.booking_date >= range.startDate && b.booking_date <= range.endDate
  );

  let totalRevenue = 0;
  let totalCommission = 0;
  let totalSessions = 0;
  let scheduledPotentialRevenue = 0;
  let scheduledCount = 0;
  let cancelledCount = 0;

  const byCategory: Record<ServiceCategory, CategoryRevenueSummary> = {
    PIJAT: { category: 'PIJAT', session_count: 0, total_revenue: 0 },
    FACIAL: { category: 'FACIAL', session_count: 0, total_revenue: 0 },
  };

  const serviceAgg = new Map<string, Omit<ServiceRevenueRow, 'share_percent'>>();
  const therapistAgg = new Map<string, Omit<TherapistRevenueRow, 'share_percent'>>();

  for (const booking of inRangeBookings) {
    const service = serviceMap.get(booking.service_id);
    const price = service ? Math.round(service.price) : 0;

    if (booking.status === 'CANCELLED') {
      cancelledCount += 1;
      continue;
    }

    if (booking.status === 'SCHEDULED') {
      scheduledCount += 1;
      scheduledPotentialRevenue += price;
    }

    if (!isCountedBooking(booking, scope)) {
      continue;
    }

    const txCommission = calculateTransactionCommission(price);

    totalRevenue += price;
    totalCommission += txCommission;
    totalSessions += 1;

    if (service) {
      byCategory[service.category].session_count += 1;
      byCategory[service.category].total_revenue += price;
    }

    const existingService = serviceAgg.get(booking.service_id);
    if (existingService) {
      existingService.session_count += 1;
      existingService.total_revenue += price;
    } else {
      serviceAgg.set(booking.service_id, {
        service_id: booking.service_id,
        service_name: service?.service_name ?? `Layanan (${booking.service_id})`,
        category: service?.category ?? 'PIJAT',
        unit_price: price,
        session_count: 1,
        total_revenue: price,
      });
    }

    const therapist = therapistMap.get(booking.therapist_id);
    const existingTherapist = therapistAgg.get(booking.therapist_id);
    if (existingTherapist) {
      existingTherapist.session_count += 1;
      existingTherapist.total_revenue += price;
      existingTherapist.total_commission += txCommission;
    } else {
      therapistAgg.set(booking.therapist_id, {
        therapist_id: booking.therapist_id,
        therapist_name: therapist?.name ?? `Terapis (${booking.therapist_id})`,
        session_count: 1,
        total_revenue: price,
        total_commission: txCommission,
      });
    }
  }

  const byService: ServiceRevenueRow[] = Array.from(serviceAgg.values())
    .map((row) => ({
      ...row,
      share_percent: totalRevenue > 0 ? Math.round((row.total_revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.total_revenue !== a.total_revenue) return b.total_revenue - a.total_revenue;
      return a.service_name.localeCompare(b.service_name, 'id');
    });

  const byTherapist: TherapistRevenueRow[] = Array.from(therapistAgg.values())
    .map((row) => ({
      ...row,
      share_percent: totalRevenue > 0 ? Math.round((row.total_revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.total_revenue !== a.total_revenue) return b.total_revenue - a.total_revenue;
      return a.therapist_name.localeCompare(b.therapist_name, 'id');
    });

  // Rincian timeline untuk Mingguan (7 hari Senin-Minggu) dan Bulanan (per minggu kalender)
  const timelineBuckets: TimelineBucketRow[] = [];

  if (periodType === 'WEEKLY') {
    for (let i = 0; i < 7; i += 1) {
      const dateStr = addDaysYYYYMMDD(range.startDate, i);
      const parts = parseDateParts(dateStr)!;
      const dt = new Date(parts.year, parts.month - 1, parts.day);
      const dayBookings = inRangeBookings.filter(
        (b) => b.booking_date === dateStr && isCountedBooking(b, scope)
      );
      let dayRevenue = 0;
      let dayCommission = 0;
      for (const b of dayBookings) {
        const s = serviceMap.get(b.service_id);
        const price = s ? Math.round(s.price) : 0;
        dayRevenue += price;
        dayCommission += calculateTransactionCommission(price);
      }

      timelineBuckets.push({
        key: dateStr,
        label: `${HARI_SINGKAT[dt.getDay()]}, ${formatDateIndo(dateStr)}`,
        session_count: dayBookings.length,
        total_revenue: dayRevenue,
        total_commission: dayCommission,
      });
    }
  } else if (periodType === 'MONTHLY') {
    const startParts = parseDateParts(range.startDate)!;
    const endParts = parseDateParts(range.endDate)!;
    const totalDays = endParts.day;
    let weekNum = 1;

    for (let dayStart = 1; dayStart <= totalDays; dayStart += 7) {
      const dayEnd = Math.min(dayStart + 6, totalDays);
      const bucketStart = toYYYYMMDD(startParts.year, startParts.month, dayStart);
      const bucketEnd = toYYYYMMDD(startParts.year, startParts.month, dayEnd);
      const bucketBookings = inRangeBookings.filter(
        (b) =>
          b.booking_date >= bucketStart &&
          b.booking_date <= bucketEnd &&
          isCountedBooking(b, scope)
      );
      let bucketRevenue = 0;
      let bucketCommission = 0;
      for (const b of bucketBookings) {
        const s = serviceMap.get(b.service_id);
        const price = s ? Math.round(s.price) : 0;
        bucketRevenue += price;
        bucketCommission += calculateTransactionCommission(price);
      }

      timelineBuckets.push({
        key: `${bucketStart}_${bucketEnd}`,
        label: `Minggu ${weekNum}`,
        sublabel: `${dayStart} - ${dayEnd} ${BULAN_INDO[startParts.month - 1]}`,
        session_count: bucketBookings.length,
        total_revenue: bucketRevenue,
        total_commission: bucketCommission,
      });
      weekNum += 1;
    }
  }

  const dailySessions: DailySessionDetailRow[] =
    periodType === 'DAILY'
      ? inRangeBookings
          .slice()
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
          .map((booking) => {
            const service = serviceMap.get(booking.service_id);
            const therapist = therapistMap.get(booking.therapist_id);
            const amount = service ? Math.round(service.price) : 0;
            return {
              booking,
              service_name: service?.service_name ?? `Layanan (${booking.service_id})`,
              category: service?.category ?? null,
              therapist_name: therapist?.name ?? `Terapis (${booking.therapist_id})`,
              amount,
              commission: calculateTransactionCommission(amount),
              counted: isCountedBooking(booking, scope),
            };
          })
      : [];

  return {
    range,
    scope,
    commissionRate: THERAPIST_COMMISSION_RATE,
    totalRevenue,
    totalCommission,
    netClinicRevenue: Math.max(0, totalRevenue - totalCommission),
    totalSessions,
    scheduledPotentialRevenue,
    scheduledCount,
    cancelledCount,
    byCategory,
    byService,
    byTherapist,
    timelineBuckets,
    dailySessions,
  };
}
