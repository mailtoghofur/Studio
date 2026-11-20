// Utilitas ekspor data Terapis, Layanan, Reservasi, dan Rekap Pendapatan ke file CSV.

import { CATEGORY_LABELS } from '../config';
import type { RevenueReport } from './revenue';
import type { Booking, Service, Therapist } from './types';

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsvFile(filename: string, headers: string[], rows: (string | number | boolean)[][]): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const csvContent = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportBookingsCsv(bookings: Booking[]): void {
  downloadCsvFile(
    'reservasi-klinik.csv',
    [
      'booking_id',
      'patient_name',
      'patient_phone',
      'service_id',
      'therapist_id',
      'booking_date',
      'start_time',
      'end_time',
      'location_type',
      'patient_address',
      'notes',
      'status',
      'created_at',
      'updated_at',
    ],
    bookings.map((b) => [
      b.booking_id,
      b.patient_name,
      b.patient_phone,
      b.service_id,
      b.therapist_id,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.location_type,
      b.patient_address,
      b.notes,
      b.status,
      b.created_at,
      b.updated_at,
    ])
  );
}

export function exportServicesCsv(services: Service[]): void {
  downloadCsvFile(
    'layanan-klinik.csv',
    ['service_id', 'category', 'service_name', 'duration_minutes', 'price', 'allow_home_service'],
    services.map((s) => [
      s.service_id,
      s.category,
      s.service_name,
      s.duration_minutes,
      s.price,
      s.allow_home_service ? 'TRUE' : 'FALSE',
    ])
  );
}

export function exportTherapistsCsv(therapists: Therapist[]): void {
  downloadCsvFile(
    'terapis-klinik.csv',
    ['therapist_id', 'name', 'is_active'],
    therapists.map((t) => [t.therapist_id, t.name, t.is_active ? 'TRUE' : 'FALSE'])
  );
}

export function exportRevenueCsv(report: RevenueReport): void {
  const periodSlug =
    report.range.periodType === 'DAILY'
      ? `harian-${report.range.startDate}`
      : report.range.periodType === 'WEEKLY'
        ? `mingguan-${report.range.startDate}_sd_${report.range.endDate}`
        : `bulanan-${report.range.startDate.slice(0, 7)}`;

  const rows: (string | number | boolean)[][] = report.byService.map((row) => [
    report.range.label,
    report.scope === 'COMPLETED_ONLY' ? 'Selesai Saja' : 'Selesai + Terjadwal',
    row.service_id,
    row.service_name,
    CATEGORY_LABELS[row.category],
    row.session_count,
    row.unit_price,
    row.total_revenue,
    `${row.share_percent}%`,
  ]);

  rows.push([
    report.range.label,
    report.scope === 'COMPLETED_ONLY' ? 'Selesai Saja' : 'Selesai + Terjadwal',
    '-',
    'TOTAL PENDAPATAN',
    '-',
    report.totalSessions,
    '-',
    report.totalRevenue,
    report.totalRevenue > 0 ? '100%' : '0%',
  ]);

  downloadCsvFile(
    `rekap-pendapatan-${periodSlug}.csv`,
    [
      'periode',
      'cakupan_status',
      'service_id',
      'nama_layanan',
      'kategori',
      'jumlah_sesi',
      'harga_satuan',
      'total_pendapatan',
      'porsi',
    ],
    rows
  );
}
