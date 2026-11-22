// Utilitas ekspor data Terapis, Layanan, Reservasi, dan Rekap Pendapatan ke file CSV.

import { CATEGORY_LABELS } from '../config';
import type { CustomerLoyaltySummary } from './loyalty';
import type { RevenueReport } from './revenue';
import type { Booking, ProductSale, Service, Therapist } from './types';

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

  const scopeLabel =
    report.scope === 'COMPLETED_ONLY' ? 'Selesai Saja' : 'Selesai + Terjadwal';

  const rows: (string | number | boolean)[][] = report.byService.map((row) => [
    'Layanan',
    report.range.label,
    scopeLabel,
    row.service_id,
    row.service_name,
    CATEGORY_LABELS[row.category],
    row.session_count,
    row.unit_price,
    row.total_revenue,
    Math.round(row.total_revenue * report.commissionRate),
    `${row.share_percent}%`,
  ]);

  for (const row of report.byProduct) {
    rows.push([
      'Penjualan Produk',
      report.range.label,
      scopeLabel,
      row.product_id,
      row.product_name,
      'Produk',
      row.unit_count,
      '-',
      row.total_revenue,
      row.total_commission,
      `${row.share_percent}%`,
    ]);
  }

  rows.push([
    'Ringkasan',
    report.range.label,
    scopeLabel,
    '-',
    'TOTAL OMZET (LAYANAN + PRODUK)',
    '-',
    report.totalSessions + report.totalProductTransactions,
    '-',
    report.totalRevenue,
    report.totalCommission,
    report.totalRevenue > 0 ? '100%' : '0%',
  ]);

  for (const t of report.byTherapist) {
    rows.push([
      'Komisi Terapis',
      report.range.label,
      scopeLabel,
      t.therapist_id,
      t.therapist_name,
      'Terapis',
      t.session_count + t.product_count,
      '-',
      t.total_revenue,
      t.total_commission,
      `${t.share_percent}%`,
    ]);
  }

  downloadCsvFile(
    `rekap-pendapatan-${periodSlug}.csv`,
    [
      'bagian',
      'periode',
      'cakupan_status',
      'kode',
      'nama_layanan_atau_terapis',
      'kategori',
      'jumlah_sesi',
      'harga_satuan',
      'total_pendapatan',
      'komisi_10_persen',
      'porsi',
    ],
    rows
  );
}

export function exportLoyaltyCsv(customers: CustomerLoyaltySummary[]): void {
  downloadCsvFile(
    'kesetiaan-pelanggan.csv',
    [
      'nama_pelanggan',
      'nomor_hp',
      'pemesanan_pijat',
      'pemesanan_facial',
      'total_pemesanan_terhitung',
      'progres_siklus_10',
      'hak_gratis_tersedia',
      'hadiah_sudah_dipakai',
      'kunjungan_terakhir',
    ],
    customers.map((c) => [
      c.customer_name,
      c.customer_phone,
      c.pijat_count,
      c.facial_count,
      c.paid_bookings_count,
      `${c.cycle_progress}/10`,
      c.available_rewards_count,
      c.redeemed_rewards_count,
      c.last_booking_date,
    ])
  );
}

export function exportProductSalesCsv(
  sales: ProductSale[],
  therapists: Therapist[]
): void {
  const therapistMap = new Map(therapists.map((t) => [t.therapist_id, t.name]));
  downloadCsvFile(
    'penjualan-produk-klinik.csv',
    [
      'sale_id',
      'sale_date',
      'product_name',
      'therapist_name',
      'buyer_name',
      'quantity',
      'unit_price',
      'total_amount',
      'commission_10_persen',
      'status',
    ],
    sales.map((s) => [
      s.sale_id,
      s.sale_date,
      s.product_name,
      therapistMap.get(s.therapist_id) ?? s.therapist_id,
      s.buyer_name || '-',
      s.quantity,
      s.unit_price,
      s.total_amount,
      s.status === 'CANCELLED' ? 0 : Math.round(s.total_amount * 0.1),
      s.status,
    ])
  );
}
