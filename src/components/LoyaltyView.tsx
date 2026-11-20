// Tampilan program kesetiaan pelanggan: 10 pemesanan Pijat atau Facial berhak gratis 1x paket standar (FT-09).

import { Award, Download, Gift, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LOYALTY_MILESTONE_COUNT } from '../config';
import { exportLoyaltyCsv } from '../lib/csvExport';
import { formatDateIndo, formatPhoneDisplay, formatRupiah } from '../lib/format';
import { calculateCustomerLoyalty } from '../lib/loyalty';
import type { Booking, Service } from '../lib/types';

interface LoyaltyViewProps {
  bookings: Booking[];
  services: Service[];
  onBookWithCustomer: (prefill: {
    patientName: string;
    patientPhone: string;
    useLoyaltyReward: boolean;
  }) => void;
}

type LoyaltyFilter = 'ALL' | 'ELIGIBLE' | 'COLLECTING';

export function LoyaltyView({
  bookings,
  services,
  onBookWithCustomer,
}: LoyaltyViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<LoyaltyFilter>('ALL');

  const overview = useMemo(
    () => calculateCustomerLoyalty(bookings, services),
    [bookings, services]
  );

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return overview.customers.filter((c) => {
      if (filterMode === 'ELIGIBLE' && c.available_rewards_count === 0) return false;
      if (filterMode === 'COLLECTING' && c.available_rewards_count > 0) return false;
      if (!q) return true;
      return (
        c.customer_name.toLowerCase().includes(q) ||
        c.customer_phone.includes(q) ||
        formatPhoneDisplay(c.customer_phone).toLowerCase().includes(q)
      );
    });
  }, [overview.customers, searchQuery, filterMode]);

  const stdPijat = overview.standardServices.PIJAT;
  const stdFacial = overview.standardServices.FACIAL;

  return (
    <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
      {/* Header & Ekspor CSV */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
            Kesetiaan Pelanggan
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Catatan kunjungan pelanggan untuk hadiah gratis setelah {LOYALTY_MILESTONE_COUNT}{' '}
            pemesanan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportLoyaltyCsv(overview.customers)}
          disabled={overview.customers.length === 0}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
        >
          <Download className="h-4 w-4 text-amber-700" />
          <span>Unduh CSV</span>
        </button>
      </div>

      {/* Ringkasan KPI */}
      <div className="grid grid-cols-1 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-neutral-50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <p className="text-sm font-medium text-neutral-600">Total Pelanggan Terdaftar</p>
          <p className="mt-1 text-3xl font-semibold text-neutral-900 tabular-nums">
            {overview.totalCustomers}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Dikelompokkan berdasarkan nomor HP
          </p>
        </div>

        <div className="p-4">
          <p className="text-sm font-medium text-neutral-600">Siap Klaim Gratis</p>
          <p className="mt-1 text-3xl font-semibold text-amber-800 tabular-nums">
            {overview.eligibleCustomersCount}
          </p>
          <p className="mt-1 text-xs text-neutral-600 tabular-nums">
            {overview.totalAvailableRewards} hak gratis 1x paket standar tersedia
          </p>
        </div>

        <div className="p-4">
          <p className="text-sm font-medium text-neutral-600">Hadiah Sudah Dipakai</p>
          <p className="mt-1 text-3xl font-semibold text-neutral-900 tabular-nums">
            {overview.totalRedeemedRewards}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Gratis Pijat atau Facial paket standar
          </p>
        </div>
      </div>

      {/* Info Aturan & Paket Standar Aktif */}
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="space-y-1">
          <p className="font-semibold text-neutral-900">
            Aturan: {LOYALTY_MILESTONE_COUNT}x Pemesanan Pijat atau Facial = Gratis 1x Paket Standar
          </p>
          <p className="text-xs text-neutral-600">
            Paket standar yang berlaku saat ini:{' '}
            <strong>
              {stdPijat
                ? `${stdPijat.service_name} (${formatRupiah(stdPijat.price)})`
                : 'Belum ada paket Pijat'}
            </strong>{' '}
            atau{' '}
            <strong>
              {stdFacial
                ? `${stdFacial.service_name} (${formatRupiah(stdFacial.price)})`
                : 'Belum ada paket Facial'}
            </strong>
            . Jadwal yang dibatalkan tidak dihitung.
          </p>
        </div>
      </div>

      {/* Pencarian & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="loyalty-search" className="sr-only">
            Cari nama atau nomor HP pelanggan
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            id="loyalty-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau nomor HP..."
            className="min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white py-2 pl-10 pr-3.5 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          />
        </div>

        <div
          role="tablist"
          aria-label="Filter status kesetiaan pelanggan"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-neutral-100 p-1"
        >
          {(
            [
              { key: 'ALL', label: 'Semua' },
              { key: 'ELIGIBLE', label: 'Siap Klaim' },
              { key: 'COLLECTING', label: 'Mengumpulkan' },
            ] as const
          ).map((tab) => {
            const active = filterMode === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterMode(tab.key)}
                className={`min-h-[36px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
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
      </div>

      {/* Tabel Pelanggan */}
      {filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-10 text-center">
          <Award className="h-6 w-6 text-neutral-400" />
          <p className="mt-2 text-base font-medium text-neutral-900">
            {overview.customers.length === 0
              ? 'Belum ada data pemesanan pelanggan'
              : 'Tidak ada pelanggan yang sesuai pencarian'}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {overview.customers.length === 0
              ? 'Jumlah kunjungan Pijat dan Facial tiap pelanggan akan tercatat otomatis saat reservasi dibuat.'
              : 'Coba ubah kata kunci pencarian atau pilih filter Semua.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[740px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                <th className="px-4 py-3 font-semibold">Pelanggan</th>
                <th className="px-4 py-3 text-right font-semibold">Total Pesan</th>
                <th className="px-4 py-3 font-semibold">Rincian Layanan</th>
                <th className="px-4 py-3 font-semibold">Progres Siklus 10x</th>
                <th className="px-4 py-3 font-semibold">Hak Gratis</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredCustomers.map((customer) => {
                const hasReward = customer.available_rewards_count > 0;
                const progressPct = Math.min(
                  100,
                  Math.round((customer.cycle_progress / LOYALTY_MILESTONE_COUNT) * 100)
                );

                return (
                  <tr key={customer.customer_phone} className="hover:bg-neutral-50/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-neutral-900">{customer.customer_name}</p>
                      <p className="text-xs text-neutral-600 tabular-nums">
                        {formatPhoneDisplay(customer.customer_phone)} · Terakhir{' '}
                        {formatDateIndo(customer.last_booking_date)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900 tabular-nums">
                      {customer.paid_bookings_count}x
                    </td>
                    <td className="px-4 py-3 text-neutral-700 tabular-nums">
                      {customer.pijat_count} Pijat · {customer.facial_count} Facial
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <div className="flex items-center gap-2.5">
                        <div
                          aria-hidden="true"
                          className="h-2 w-24 overflow-hidden rounded-full bg-neutral-200"
                        >
                          <div
                            className="h-full rounded-full bg-amber-700"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-neutral-700">
                          {customer.cycle_progress}/{LOYALTY_MILESTONE_COUNT} (kurang{' '}
                          {customer.remaining_to_next_reward})
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {hasReward ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 tabular-nums">
                          <Gift className="h-3.5 w-3.5" />
                          <span>Tersedia {customer.available_rewards_count}x</span>
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-600 tabular-nums">
                          Dipakai {customer.redeemed_rewards_count}x
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasReward ? (
                        <button
                          type="button"
                          onClick={() =>
                            onBookWithCustomer({
                              patientName: customer.customer_name,
                              patientPhone: customer.customer_phone,
                              useLoyaltyReward: true,
                            })
                          }
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-amber-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                        >
                          <Gift className="h-4 w-4" />
                          <span>Klaim Gratis</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onBookWithCustomer({
                              patientName: customer.customer_name,
                              patientPhone: customer.customer_phone,
                              useLoyaltyReward: false,
                            })
                          }
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Pesan Lagi</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
