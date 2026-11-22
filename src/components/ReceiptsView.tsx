// Halaman daftar dan perbaikan resi untuk seluruh reservasi berstatus Selesai (FT-05).

import { CheckCircle2, FilePenLine, Layers, Printer, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDateIndo, formatPhoneDisplay, formatRupiah, formatTimeRange } from '../lib/format';
import { findSameTimeCompletedBookings } from '../lib/receipt';
import { getBookingEffectivePrice } from '../lib/revenue';
import type { Booking, Service, Therapist } from '../lib/types';

interface ReceiptsViewProps {
  bookings: Booking[];
  services: Service[];
  therapists: Therapist[];
  onEditReceipt: (booking: Booking) => void;
  onPrintReceipt: (booking: Booking) => void;
}

export function ReceiptsView({
  bookings,
  services,
  therapists,
  onEditReceipt,
  onPrintReceipt,
}: ReceiptsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const serviceMap = useMemo(
    () => new Map(services.map((s) => [s.service_id, s])),
    [services]
  );
  const therapistMap = useMemo(
    () => new Map(therapists.map((t) => [t.therapist_id, t])),
    [therapists]
  );

  const completedBookings = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'COMPLETED')
      .slice()
      .sort((a, b) => {
        if (a.booking_date !== b.booking_date) {
          return b.booking_date.localeCompare(a.booking_date);
        }
        return b.start_time.localeCompare(a.start_time);
      });
  }, [bookings]);

  const summary = useMemo(() => {
    let revisedCount = 0;
    let totalAmount = 0;
    for (const b of completedBookings) {
      if (b.receipt_revised_at) revisedCount += 1;
      totalAmount += getBookingEffectivePrice(b, serviceMap.get(b.service_id));
    }
    return {
      totalCompleted: completedBookings.length,
      revisedCount,
      totalAmount,
    };
  }, [completedBookings, serviceMap]);

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return completedBookings.filter((b) => {
      if (filterDate && b.booking_date !== filterDate) return false;
      if (!q) return true;
      const receiptNo = `resi-${b.booking_id}`.toLowerCase();
      const therapistName = (therapistMap.get(b.therapist_id)?.name ?? '').toLowerCase();
      const serviceName = (serviceMap.get(b.service_id)?.service_name ?? '').toLowerCase();
      return (
        receiptNo.includes(q) ||
        b.booking_id.toLowerCase().includes(q) ||
        b.patient_name.toLowerCase().includes(q) ||
        b.patient_phone.includes(q) ||
        formatPhoneDisplay(b.patient_phone).toLowerCase().includes(q) ||
        therapistName.includes(q) ||
        serviceName.includes(q)
      );
    });
  }, [completedBookings, searchQuery, filterDate, therapistMap, serviceMap]);

  return (
    <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
          Perbaikan Resi Pemesanan
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Kelola, koreksi data, atau cetak ulang resi untuk reservasi yang telah selesai.
        </p>
      </div>

      {/* Ringkasan KPI */}
      <div className="grid grid-cols-1 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-neutral-50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <p className="text-sm text-neutral-600">Total Resi Selesai</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 tabular-nums">
            {summary.totalCompleted} resi
          </p>
        </div>
        <div className="p-4">
          <p className="text-sm text-neutral-600">Resi Pernah Diperbaiki</p>
          <p className="mt-1 text-2xl font-bold text-amber-800 tabular-nums">
            {summary.revisedCount} resi
          </p>
        </div>
        <div className="p-4">
          <p className="text-sm text-neutral-600">Total Nilai Resi</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 tabular-nums">
            {formatRupiah(summary.totalAmount)}
          </p>
        </div>
      </div>

      {/* Pencarian & Filter Tanggal */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          <label
            htmlFor="receipt-search-input"
            className="block text-sm font-medium text-neutral-800"
          >
            Cari No. Resi, Pasien, atau Terapis
          </label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              id="receipt-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Contoh: RESI- atau nama pasien"
              className="min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white pr-3.5 pl-9 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label
              htmlFor="receipt-date-filter"
              className="block text-sm font-medium text-neutral-800"
            >
              Filter Tanggal
            </label>
            <input
              id="receipt-date-filter"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="mt-1.5 min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            />
          </div>
          {filterDate && (
            <button
              type="button"
              onClick={() => setFilterDate('')}
              className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              Semua Tanggal
            </button>
          )}
        </div>
      </div>

      {/* Daftar Resi Selesai */}
      {filteredBookings.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-neutral-800">
            {completedBookings.length === 0
              ? 'Belum ada reservasi berstatus Selesai.'
              : 'Tidak ada resi yang cocok dengan pencarian Anda.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200">
          {filteredBookings.map((booking) => {
            const service = serviceMap.get(booking.service_id);
            const therapist = therapistMap.get(booking.therapist_id);
            const price = getBookingEffectivePrice(booking, service);
            const sameTimeCount = findSameTimeCompletedBookings(booking, completedBookings).length;

            return (
              <div
                key={booking.booking_id}
                className="flex flex-col justify-between gap-4 bg-white p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-600 tabular-nums">
                      RESI-{booking.booking_id}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Selesai</span>
                    </span>
                    {sameTimeCount > 1 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 tabular-nums">
                        <Layers className="h-3 w-3" />
                        <span>Resi Gabungan ({sameTimeCount} paket)</span>
                      </span>
                    )}
                    {!booking.is_loyalty_reward &&
                      booking.discount_percent &&
                      booking.discount_percent > 0 && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          Diskon {booking.discount_percent}%
                        </span>
                      )}
                    {booking.receipt_revised_at && (
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-800">
                        Diperbaiki
                      </span>
                    )}
                  </div>

                  <p className="truncate text-base font-semibold text-neutral-900">
                    {booking.patient_name}{' '}
                    <span className="text-sm font-normal text-neutral-600 tabular-nums">
                      ({formatPhoneDisplay(booking.patient_phone)})
                    </span>
                  </p>

                  <p className="text-sm text-neutral-700">
                    {service?.service_name ?? booking.service_id} · Terapis:{' '}
                    {therapist?.name ?? booking.therapist_id}
                  </p>

                  <p className="text-xs text-neutral-600 tabular-nums">
                    {formatDateIndo(booking.booking_date)} ·{' '}
                    {formatTimeRange(booking.start_time, booking.end_time)} WIB
                    {booking.receipt_revision_reason
                      ? ` · Alasan revisi: ${booking.receipt_revision_reason}`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <span className="text-base font-bold text-neutral-900 tabular-nums">
                    {booking.is_loyalty_reward ? 'Rp0 (Gratis Kesetiaan)' : formatRupiah(price)}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditReceipt(booking)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                    >
                      <FilePenLine className="h-4 w-4 text-amber-700" />
                      <span>Perbaiki Resi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onPrintReceipt(booking)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-amber-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Cetak Resi</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
