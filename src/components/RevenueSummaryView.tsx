// Tampilan rekapitulasi pendapatan harian, mingguan, dan bulanan atas layanan yang dihasilkan (FT-08).

import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CATEGORY_LABELS, STATUS_LABELS } from '../config';
import { exportRevenueCsv } from '../lib/csvExport';
import {
  addDaysYYYYMMDD,
  formatRupiah,
  formatTimeRange,
  formatWeekdayDateIndo,
  getTodayYYYYMMDD,
} from '../lib/format';
import {
  addMonthsYYYYMM,
  calculateRevenueReport,
  getMonthKeyFromDate,
  type RevenuePeriodType,
  type RevenueStatusScope,
} from '../lib/revenue';
import type { Booking, ProductSale, Service, Therapist } from '../lib/types';

interface RevenueSummaryViewProps {
  bookings: Booking[];
  services: Service[];
  therapists: Therapist[];
  productSales?: ProductSale[];
  defaultDate: string;
}

export function RevenueSummaryView({
  bookings,
  services,
  therapists,
  productSales = [],
  defaultDate,
}: RevenueSummaryViewProps) {
  const [periodType, setPeriodType] = useState<RevenuePeriodType>('DAILY');
  const [referenceDate, setReferenceDate] = useState<string>(defaultDate || getTodayYYYYMMDD());
  const [referenceMonth, setReferenceMonth] = useState<string>(() =>
    getMonthKeyFromDate(defaultDate || getTodayYYYYMMDD())
  );
  const [scope, setScope] = useState<RevenueStatusScope>('COMPLETED_ONLY');

  const report = useMemo(
    () =>
      calculateRevenueReport({
        periodType,
        referenceDate,
        referenceMonth,
        scope,
        bookings,
        services,
        therapists,
        productSales,
      }),
    [periodType, referenceDate, referenceMonth, scope, bookings, services, therapists, productSales]
  );

  const commissionPercent = Math.round(report.commissionRate * 100);

  const handlePrevPeriod = () => {
    if (periodType === 'DAILY') {
      setReferenceDate((d) => addDaysYYYYMMDD(d, -1));
    } else if (periodType === 'WEEKLY') {
      setReferenceDate((d) => addDaysYYYYMMDD(d, -7));
    } else {
      setReferenceMonth((m) => addMonthsYYYYMM(m, -1));
    }
  };

  const handleNextPeriod = () => {
    if (periodType === 'DAILY') {
      setReferenceDate((d) => addDaysYYYYMMDD(d, 1));
    } else if (periodType === 'WEEKLY') {
      setReferenceDate((d) => addDaysYYYYMMDD(d, 7));
    } else {
      setReferenceMonth((m) => addMonthsYYYYMM(m, 1));
    }
  };

  const handleResetCurrentPeriod = () => {
    const today = getTodayYYYYMMDD();
    if (periodType === 'MONTHLY') {
      setReferenceMonth(getMonthKeyFromDate(today));
    } else {
      setReferenceDate(today);
    }
  };

  return (
    <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
      {/* Header & Tombol Ekspor */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
            Rekapitulasi Pendapatan
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Ringkasan pemasukan layanan harian, mingguan, bulanan, dan komisi terapis {commissionPercent}%.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportRevenueCsv(report)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
        >
          <Download className="h-4 w-4 text-amber-700" />
          <span>Unduh CSV</span>
        </button>
      </div>

      {/* Kontrol Periode & Cakupan Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 pt-4">
        <div
          role="tablist"
          aria-label="Pilih rentang rekapitulasi"
          className="inline-flex items-center gap-1 rounded-xl bg-neutral-100 p-1"
        >
          {(
            [
              { key: 'DAILY', label: 'Harian' },
              { key: 'WEEKLY', label: 'Mingguan' },
              { key: 'MONTHLY', label: 'Bulanan' },
            ] as const
          ).map((tab) => {
            const active = periodType === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriodType(tab.key)}
                className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                  active
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrevPeriod}
            aria-label="Periode sebelumnya"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {periodType === 'MONTHLY' ? (
            <input
              type="month"
              aria-label="Pilih bulan rekapitulasi"
              value={referenceMonth}
              onChange={(e) => {
                if (e.target.value) setReferenceMonth(e.target.value);
              }}
              className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            />
          ) : (
            <input
              type="date"
              aria-label="Pilih tanggal acuan"
              value={referenceDate}
              onChange={(e) => {
                if (e.target.value) setReferenceDate(e.target.value);
              }}
              className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            />
          )}

          <button
            type="button"
            onClick={handleNextPeriod}
            aria-label="Periode berikutnya"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleResetCurrentPeriod}
            className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            {periodType === 'DAILY'
              ? 'Hari Ini'
              : periodType === 'WEEKLY'
                ? 'Minggu Ini'
                : 'Bulan Ini'}
          </button>
        </div>
      </div>

      {/* Info Rentang Aktif & Cakupan Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-neutral-800">
          Periode:{' '}
          <span className="font-semibold text-neutral-900">
            {periodType === 'DAILY' ? formatWeekdayDateIndo(report.range.startDate) : report.range.label}
          </span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-600">Hitung status:</span>
          <div className="inline-flex items-center gap-1 rounded-xl bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => setScope('COMPLETED_ONLY')}
              className={`min-h-[36px] rounded-lg px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap ${
                scope === 'COMPLETED_ONLY'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Selesai Saja
            </button>
            <button
              type="button"
              onClick={() => setScope('INCLUDE_SCHEDULED')}
              className={`min-h-[36px] rounded-lg px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap ${
                scope === 'INCLUDE_SCHEDULED'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Selesai + Terjadwal
            </button>
          </div>
        </div>
      </div>

      {/* Strip KPI Ringkasan Utama */}
      <div className="grid grid-cols-1 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-neutral-50 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <div className="p-4">
          <p className="text-sm font-medium text-neutral-600">
            {scope === 'COMPLETED_ONLY' ? 'Pendapatan Terealisasi' : 'Proyeksi Total Pendapatan'}
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-amber-800 tabular-nums">
            {formatRupiah(report.totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-neutral-600 tabular-nums">
            Dari {report.totalSessions} sesi & {report.totalProductTransactions} penjualan produk
          </p>
        </div>

        <div className="p-4">
          <p className="text-sm font-medium text-neutral-600">
            Komisi Terapis ({commissionPercent}%)
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900 tabular-nums">
            {formatRupiah(report.totalCommission)}
          </p>
          <p className="mt-1 text-xs text-neutral-600 tabular-nums">
            Bersih klinik: {formatRupiah(report.netClinicRevenue)}
          </p>
        </div>

        <div className="p-4">
          <p className="text-sm font-medium text-neutral-600">Per Kategori Omzet</p>
          <div className="mt-1.5 space-y-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-700">
                Pijat ({report.byCategory.PIJAT.session_count} sesi)
              </span>
              <span className="font-semibold text-neutral-900 tabular-nums">
                {formatRupiah(report.byCategory.PIJAT.total_revenue)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-700">
                Facial ({report.byCategory.FACIAL.session_count} sesi)
              </span>
              <span className="font-semibold text-neutral-900 tabular-nums">
                {formatRupiah(report.byCategory.FACIAL.total_revenue)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-700">
                Produk ({report.productSummary.unit_count} item)
              </span>
              <span className="font-semibold text-neutral-900 tabular-nums">
                {formatRupiah(report.productSummary.total_revenue)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4">
          <p className="text-sm font-medium text-neutral-600">Status Jadwal Lainnya</p>
          <div className="mt-1.5 space-y-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-700">Terjadwal ({report.scheduledCount} sesi)</span>
              <span className="font-semibold text-neutral-900 tabular-nums">
                {formatRupiah(report.scheduledPotentialRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-700">Dibatalkan</span>
              <span className="font-medium text-neutral-600 tabular-nums">
                {report.cancelledCount} sesi (tidak dihitung)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabel 1: Pendapatan per Layanan */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">Pendapatan per Layanan</h2>
          <span className="text-sm text-neutral-600 tabular-nums">
            {report.byService.length} jenis layanan menghasilkan pendapatan
          </span>
        </div>

        {report.byService.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center">
            <p className="text-base font-medium text-neutral-900">
              Belum ada pendapatan pada periode ini
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              {scope === 'COMPLETED_ONLY' && report.scheduledCount > 0
                ? 'Terdapat jadwal berstatus Terjadwal. Ubah status reservasi menjadi Selesai atau pilih "Selesai + Terjadwal".'
                : 'Belum ada reservasi terhitung pada rentang waktu yang dipilih.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                  <th className="px-4 py-3 font-semibold">Nama Layanan</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 text-right font-semibold">Jumlah Sesi</th>
                  <th className="px-4 py-3 text-right font-semibold">Harga Satuan</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Pendapatan</th>
                  <th className="px-4 py-3 text-right font-semibold">Porsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {report.byService.map((row) => (
                  <tr key={row.service_id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 font-medium text-neutral-900">{row.service_name}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {CATEGORY_LABELS[row.category]}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-900 tabular-nums">
                      {row.session_count}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-700 tabular-nums">
                      {formatRupiah(row.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900 tabular-nums">
                      {formatRupiah(row.total_revenue)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="inline-flex items-center justify-end gap-2">
                        <div
                          aria-hidden="true"
                          className="h-2 w-16 overflow-hidden rounded-full bg-neutral-200"
                        >
                          <div
                            className="h-full rounded-full bg-amber-700"
                            style={{ width: `${Math.min(100, row.share_percent)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-neutral-700">
                          {row.share_percent}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabel Tambahan: Omzet Penjualan Produk */}
      {report.byProduct.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Pendapatan Penjualan Produk</h2>
            <span className="text-sm text-neutral-600 tabular-nums">
              {report.productSummary.transaction_count} transaksi ({report.productSummary.unit_count}{' '}
              item)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                  <th className="px-4 py-3 font-semibold">Nama Produk</th>
                  <th className="px-4 py-3 text-right font-semibold">Transaksi</th>
                  <th className="px-4 py-3 text-right font-semibold">Terjual</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Omzet</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Komisi {commissionPercent}%
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Porsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {report.byProduct.map((row) => (
                  <tr key={row.product_id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 font-medium text-neutral-900">{row.product_name}</td>
                    <td className="px-4 py-3 text-right text-neutral-900 tabular-nums">
                      {row.transaction_count}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-700 tabular-nums">
                      {row.unit_count} item
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900 tabular-nums">
                      {formatRupiah(row.total_revenue)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-800 tabular-nums">
                      {formatRupiah(row.total_commission)}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-700 tabular-nums">
                      {row.share_percent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabel 2 & 3: Rincian Timeline/Sesi & Kontribusi per Terapis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Rincian Periode */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">
            {periodType === 'DAILY'
              ? 'Daftar Sesi Hari Ini'
              : periodType === 'WEEKLY'
                ? 'Rincian per Hari'
                : 'Rincian per Minggu'}
          </h2>

          {periodType === 'DAILY' ? (
            <div className="space-y-4">
              {report.dailySessions.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
                  Tidak ada reservasi pada tanggal ini.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-neutral-200">
                  <table className="w-full min-w-[540px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                        <th className="px-3.5 py-2.5 font-semibold">Jam</th>
                        <th className="px-3.5 py-2.5 font-semibold">Pasien & Layanan</th>
                        <th className="px-3.5 py-2.5 font-semibold">Status</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold">Nominal</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold">
                          Komisi {commissionPercent}%
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {report.dailySessions.map((item) => (
                        <tr key={item.booking.booking_id} className="hover:bg-neutral-50/80">
                          <td className="px-3.5 py-2.5 text-neutral-800 tabular-nums whitespace-nowrap">
                            {formatTimeRange(item.booking.start_time, item.booking.end_time)}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <p className="font-medium text-neutral-900">
                              {item.booking.patient_name}
                            </p>
                            <p className="text-xs text-neutral-600">
                              {item.service_name} · {item.therapist_name}
                              {!item.booking.is_loyalty_reward &&
                              item.booking.discount_percent &&
                              item.booking.discount_percent > 0
                                ? ` · Diskon ${item.booking.discount_percent}%`
                                : ''}
                            </p>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                item.booking.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : item.booking.status === 'SCHEDULED'
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              {STATUS_LABELS[item.booking.status]}
                            </span>
                          </td>
                          <td
                            className={`px-3.5 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${
                              item.counted
                                ? 'text-neutral-900'
                                : 'text-neutral-400 line-through'
                            }`}
                          >
                            {formatRupiah(item.amount)}
                          </td>
                          <td
                            className={`px-3.5 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${
                              item.counted
                                ? 'text-amber-800'
                                : 'text-neutral-400 line-through'
                            }`}
                          >
                            {formatRupiah(item.commission)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {report.dailyProductSales.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-neutral-200">
                  <table className="w-full min-w-[460px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                        <th className="px-3.5 py-2.5 font-semibold">Penjualan Produk Hari Ini</th>
                        <th className="px-3.5 py-2.5 font-semibold">Terapis</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold">Qty</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold">Omzet</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold">
                          Komisi {commissionPercent}%
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {report.dailyProductSales.map((item) => (
                        <tr key={item.sale.sale_id} className="hover:bg-neutral-50/80">
                          <td className="px-3.5 py-2.5">
                            <p className="font-medium text-neutral-900">{item.sale.product_name}</p>
                            {item.sale.buyer_name && (
                              <p className="text-xs text-neutral-600">
                                Pembeli: {item.sale.buyer_name}
                              </p>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-neutral-800">{item.therapist_name}</td>
                          <td className="px-3.5 py-2.5 text-right text-neutral-800 tabular-nums">
                            {item.sale.quantity}
                          </td>
                          <td
                            className={`px-3.5 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${
                              item.counted ? 'text-neutral-900' : 'text-neutral-400 line-through'
                            }`}
                          >
                            {formatRupiah(item.sale.total_amount)}
                          </td>
                          <td
                            className={`px-3.5 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${
                              item.counted ? 'text-amber-800' : 'text-neutral-400 line-through'
                            }`}
                          >
                            {formatRupiah(item.counted ? item.commission : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full min-w-[460px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                    <th className="px-3.5 py-2.5 font-semibold">
                      {periodType === 'WEEKLY' ? 'Hari & Tanggal' : 'Pekan'}
                    </th>
                    <th className="px-3.5 py-2.5 text-right font-semibold">Sesi / Produk</th>
                    <th className="px-3.5 py-2.5 text-right font-semibold">Pendapatan</th>
                    <th className="px-3.5 py-2.5 text-right font-semibold">
                      Komisi {commissionPercent}%
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {report.timelineBuckets.map((bucket) => (
                    <tr key={bucket.key} className="hover:bg-neutral-50/80">
                      <td className="px-3.5 py-2.5">
                        <p className="font-medium text-neutral-900">{bucket.label}</p>
                        {bucket.sublabel && (
                          <p className="text-xs text-neutral-600">{bucket.sublabel}</p>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-neutral-800 tabular-nums whitespace-nowrap">
                        {bucket.session_count} sesi
                        {bucket.product_count > 0 ? `, ${bucket.product_count} produk` : ''}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-semibold text-neutral-900 tabular-nums">
                        {formatRupiah(bucket.total_revenue)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-semibold text-amber-800 tabular-nums">
                        {formatRupiah(bucket.total_commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pendapatan & Komisi per Terapis */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">
            Pendapatan & Komisi per Terapis
          </h2>
          {report.byTherapist.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
              Belum ada kontribusi terapis yang dihitung pada periode ini.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full min-w-[460px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                    <th className="px-3.5 py-2.5 font-semibold">Nama Terapis</th>
                    <th className="px-3.5 py-2.5 text-right font-semibold">Sesi / Produk</th>
                    <th className="px-3.5 py-2.5 text-right font-semibold">Omzet Total</th>
                    <th className="px-3.5 py-2.5 text-right font-semibold">
                      Komisi {commissionPercent}%
                    </th>
                    <th className="px-3.5 py-2.5 text-right font-semibold">Porsi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {report.byTherapist.map((row) => (
                    <tr key={row.therapist_id} className="hover:bg-neutral-50/80">
                      <td className="px-3.5 py-2.5 font-medium text-neutral-900">
                        <p>{row.therapist_name}</p>
                        {row.product_revenue > 0 && (
                          <p className="text-xs font-normal text-neutral-600 tabular-nums">
                            Jasa {formatRupiah(row.service_revenue)} · Produk{' '}
                            {formatRupiah(row.product_revenue)}
                          </p>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-neutral-800 tabular-nums whitespace-nowrap">
                        {row.session_count} sesi
                        {row.product_count > 0 ? ` + ${row.product_count} produk` : ''}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-semibold text-neutral-900 tabular-nums">
                        {formatRupiah(row.total_revenue)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-semibold text-amber-800 tabular-nums">
                        {formatRupiah(row.total_commission)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-neutral-700 tabular-nums">
                        {row.share_percent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-neutral-200 bg-neutral-50 font-semibold text-neutral-900">
                    <td className="px-3.5 py-2.5">Total</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {report.totalSessions} sesi
                      {report.totalProductTransactions > 0
                        ? ` + ${report.totalProductTransactions} produk`
                        : ''}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">
                      {formatRupiah(report.totalRevenue)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-amber-800 tabular-nums">
                      {formatRupiah(report.totalCommission)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">
                      {report.totalRevenue > 0 ? '100%' : '0%'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
