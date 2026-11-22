// Panel rincian reservasi untuk mengubah status (Selesai/Dibatalkan) dengan pilihan diskon 10% atau 20% serta penjadwalan ulang (FT-05).

import {
  CalendarClock,
  CheckCircle2,
  Clock,
  FilePenLine,
  Home,
  MapPin,
  Percent,
  Phone,
  Printer,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  LOCATION_LABELS,
  STATUS_LABELS,
  TREATMENT_DISCOUNT_LABELS,
  TREATMENT_DISCOUNT_OPTIONS,
} from '../config';
import { calculateTreatmentDiscount, normalizeTreatmentDiscountPercent } from '../lib/discount';
import {
  formatDateIndo,
  formatPhoneDisplay,
  formatRupiah,
  formatTimeRange,
} from '../lib/format';
import type {
  Booking,
  BookingStatus,
  Service,
  Therapist,
  TreatmentDiscountPercent,
  UserRole,
} from '../lib/types';

interface BookingDetailModalProps {
  booking: Booking | null;
  service?: Service;
  therapist?: Therapist;
  userRole: UserRole;
  onClose: () => void;
  onRequestStatusChange: (
    booking: Booking,
    nextStatus: BookingStatus,
    discountPercent?: TreatmentDiscountPercent
  ) => void;
  onStartReschedule: (booking: Booking) => void;
  onOpenReceipt: (booking: Booking) => void;
  onEditReceipt?: (booking: Booking) => void;
}

export function BookingDetailModal({
  booking,
  service,
  therapist,
  userRole,
  onClose,
  onRequestStatusChange,
  onStartReschedule,
  onOpenReceipt,
  onEditReceipt,
}: BookingDetailModalProps) {
  const [selectedDiscount, setSelectedDiscount] = useState<TreatmentDiscountPercent>(0);

  useEffect(() => {
    setSelectedDiscount(normalizeTreatmentDiscountPercent(booking?.discount_percent));
  }, [booking?.booking_id, booking?.discount_percent]);

  const basePrice = service ? Math.max(0, Math.round(service.price)) : 0;
  const discountPreview = useMemo(
    () =>
      calculateTreatmentDiscount({
        basePrice,
        discountPercent: selectedDiscount,
        isLoyaltyReward: Boolean(booking?.is_loyalty_reward),
      }),
    [basePrice, selectedDiscount, booking?.is_loyalty_reward]
  );

  if (!booking) return null;

  const isScheduled = booking.status === 'SCHEDULED';
  const isCompleted = booking.status === 'COMPLETED';
  const isCancelled = booking.status === 'CANCELLED';
  const isAdmin = userRole === 'ADMIN';
  const isLoyaltyReward = Boolean(booking.is_loyalty_reward);

  const completedDiscountPercent = normalizeTreatmentDiscountPercent(booking.discount_percent);
  const completedFinalPrice = isLoyaltyReward
    ? 0
    : typeof booking.final_price === 'number'
      ? Math.max(0, Math.round(booking.final_price))
      : basePrice;
  const completedDiscountAmount = isLoyaltyReward
    ? 0
    : typeof booking.discount_amount === 'number'
      ? Math.max(0, Math.round(booking.discount_amount))
      : completedDiscountPercent > 0
        ? Math.round(basePrice * (completedDiscountPercent / 100))
        : 0;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-neutral-900/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-detail-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <p className="text-sm text-neutral-600 tabular-nums">{booking.booking_id}</p>
            <h2 id="booking-detail-title" className="mt-0.5 text-xl font-semibold text-neutral-900">
              {booking.patient_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup rincian reservasi"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Status saat ini */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold ${
                isCompleted
                  ? 'bg-emerald-50 text-emerald-800'
                  : isCancelled
                    ? 'bg-red-50 text-red-800'
                    : 'bg-amber-50 text-amber-800'
              }`}
            >
              {isCompleted && <CheckCircle2 className="h-4 w-4" />}
              {isCancelled && <XCircle className="h-4 w-4" />}
              {isScheduled && <Clock className="h-4 w-4" />}
              <span>Status: {STATUS_LABELS[booking.status]}</span>
            </div>

            {isCompleted && !isLoyaltyReward && completedDiscountPercent > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <Percent className="h-3.5 w-3.5" />
                <span>{TREATMENT_DISCOUNT_LABELS[completedDiscountPercent]}</span>
              </span>
            )}
          </div>

          <dl className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-neutral-50 text-sm">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="flex items-center gap-2 text-neutral-600">
                <Phone className="h-4 w-4" />
                <span>Nomor HP</span>
              </dt>
              <dd className="font-medium text-neutral-900 tabular-nums">
                {formatPhoneDisplay(booking.patient_phone)}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-neutral-600">Layanan</dt>
              <dd className="text-right font-medium text-neutral-900">
                {service ? (
                  <>
                    <span>{service.service_name}</span>
                    <span className="block text-xs font-normal text-neutral-600 tabular-nums">
                      {service.duration_minutes} menit ·{' '}
                      {isLoyaltyReward
                        ? 'Rp0 (Gratis Kesetiaan)'
                        : formatRupiah(completedFinalPrice)}
                    </span>
                  </>
                ) : (
                  booking.service_id
                )}
              </dd>
            </div>

            {isCompleted && !isLoyaltyReward && (
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="flex items-center gap-2 text-neutral-600">
                  <Percent className="h-4 w-4" />
                  <span>Status Diskon</span>
                </dt>
                <dd className="text-right font-medium text-neutral-900 tabular-nums">
                  {completedDiscountPercent > 0 ? (
                    <>
                      <span>{TREATMENT_DISCOUNT_LABELS[completedDiscountPercent]}</span>
                      <span className="block text-xs font-normal text-emerald-800">
                        Potongan -{formatRupiah(completedDiscountAmount)}
                      </span>
                    </>
                  ) : (
                    <span>{TREATMENT_DISCOUNT_LABELS[0]}</span>
                  )}
                </dd>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="flex items-center gap-2 text-neutral-600">
                <CalendarClock className="h-4 w-4" />
                <span>Jadwal</span>
              </dt>
              <dd className="text-right font-medium text-neutral-900 tabular-nums">
                {formatDateIndo(booking.booking_date)} ·{' '}
                {formatTimeRange(booking.start_time, booking.end_time)} WIB
              </dd>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="flex items-center gap-2 text-neutral-600">
                <User className="h-4 w-4" />
                <span>Terapis</span>
              </dt>
              <dd className="font-medium text-neutral-900">
                {therapist?.name ?? booking.therapist_id}
              </dd>
            </div>

            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="flex items-center gap-2 text-neutral-600">
                {booking.location_type === 'HOME_SERVICE' ? (
                  <Home className="h-4 w-4" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                <span>Lokasi</span>
              </dt>
              <dd className="text-right font-medium text-neutral-900">
                <span>{LOCATION_LABELS[booking.location_type]}</span>
                {booking.location_type === 'HOME_SERVICE' && booking.patient_address && (
                  <span className="mt-1 block max-w-[260px] text-xs font-normal text-neutral-700">
                    {booking.patient_address}
                  </span>
                )}
              </dd>
            </div>

            {booking.notes && (
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <dt className="text-neutral-600">Catatan</dt>
                <dd className="max-w-[260px] text-right text-neutral-900">{booking.notes}</dd>
              </div>
            )}

            {booking.receipt_revised_at && (
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <dt className="text-neutral-600">Status Resi</dt>
                <dd className="max-w-[260px] text-right text-amber-800">
                  <span className="font-medium">Pernah diperbaiki</span>
                  {booking.receipt_revision_reason && (
                    <span className="mt-0.5 block text-xs text-neutral-700">
                      {booking.receipt_revision_reason}
                    </span>
                  )}
                </dd>
              </div>
            )}

            {isCancelled && (booking.cancellation_reason || booking.cancelled_from_status === 'COMPLETED') && (
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <dt className="text-neutral-600">Alasan Pembatalan</dt>
                <dd className="max-w-[260px] text-right text-red-800">
                  {booking.cancellation_reason && (
                    <span className="font-medium">{booking.cancellation_reason}</span>
                  )}
                  {booking.cancelled_from_status === 'COMPLETED' && (
                    <span className="mt-0.5 block text-xs text-neutral-600">
                      Dibatalkan dari status Selesai
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>

          {/* Pilihan Status Diskon saat Penyelesaian Treatment */}
          {isScheduled && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-neutral-900">
                  Pilihan Diskon Penyelesaian Treatment
                </p>
                {!isLoyaltyReward && (
                  <span className="text-xs font-medium text-neutral-600 tabular-nums">
                    Harga awal: {formatRupiah(basePrice)}
                  </span>
                )}
              </div>

              {isLoyaltyReward ? (
                <p className="mt-2 text-sm text-neutral-700">
                  Reservasi Gratis Kesetiaan (Rp0) tidak memakai potongan diskon.
                </p>
              ) : (
                <>
                  <div
                    role="radiogroup"
                    aria-label="Pilihan status diskon treatment"
                    className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
                  >
                    {TREATMENT_DISCOUNT_OPTIONS.map((pct) => {
                      const active = selectedDiscount === pct;
                      const calc = calculateTreatmentDiscount({
                        basePrice,
                        discountPercent: pct,
                      });
                      return (
                        <button
                          key={pct}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setSelectedDiscount(pct)}
                          className={`flex min-h-[48px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                            active
                              ? 'border-amber-700 bg-amber-50 text-amber-900'
                              : 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50'
                          }`}
                        >
                          <span className="text-sm font-semibold">
                            {TREATMENT_DISCOUNT_LABELS[pct]}
                          </span>
                          <span className="text-xs text-neutral-600 tabular-nums">
                            {pct === 0
                              ? formatRupiah(calc.finalPrice)
                              : `Hemat ${formatRupiah(calc.discountAmount)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3 text-sm">
                    <span className="text-neutral-700">
                      Total Bayar Akhir ({TREATMENT_DISCOUNT_LABELS[discountPreview.discountPercent]})
                    </span>
                    <span className="text-base font-bold text-neutral-900 tabular-nums">
                      {formatRupiah(discountPreview.finalPrice)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {isScheduled && (
          <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-neutral-200 pt-4">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => onRequestStatusChange(booking, 'CANCELLED')}
                className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                Batalkan Jadwal
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                Tutup
              </button>
            )}
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onStartReschedule(booking)}
                  className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                >
                  Jadwalkan Ulang
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  onRequestStatusChange(
                    booking,
                    'COMPLETED',
                    isLoyaltyReward ? 0 : selectedDiscount
                  )
                }
                className="min-h-[44px] rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                Tandai Selesai
              </button>
            </div>
          </div>
        )}

        {!isScheduled && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5 border-t border-neutral-200 pt-4">
            {isCompleted && isAdmin ? (
              <button
                type="button"
                onClick={() => onRequestStatusChange(booking, 'CANCELLED')}
                className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                Batalkan Reservasi
              </button>
            ) : (
              <div />
            )}
            <div className="flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                Tutup
              </button>
              {isCompleted && isAdmin && onEditReceipt && (
                <button
                  type="button"
                  onClick={() => onEditReceipt(booking)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                >
                  <FilePenLine className="h-4 w-4 text-amber-700" />
                  <span>Perbaiki Resi</span>
                </button>
              )}
              {isCompleted && (
                <button
                  type="button"
                  onClick={() => onOpenReceipt(booking)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak Resi</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

