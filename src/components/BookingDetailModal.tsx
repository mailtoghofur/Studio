// Panel rincian reservasi untuk mengubah status (Selesai/Dibatalkan) atau menjadwalkan ulang (FT-05).

import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Home,
  MapPin,
  Phone,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { LOCATION_LABELS, STATUS_LABELS } from '../config';
import {
  formatDateIndo,
  formatPhoneDisplay,
  formatRupiah,
  formatTimeRange,
} from '../lib/format';
import type { Booking, BookingStatus, Service, Therapist, UserRole } from '../lib/types';

interface BookingDetailModalProps {
  booking: Booking | null;
  service?: Service;
  therapist?: Therapist;
  userRole: UserRole;
  onClose: () => void;
  onRequestStatusChange: (booking: Booking, nextStatus: BookingStatus) => void;
  onStartReschedule: (booking: Booking) => void;
}

export function BookingDetailModal({
  booking,
  service,
  therapist,
  userRole,
  onClose,
  onRequestStatusChange,
  onStartReschedule,
}: BookingDetailModalProps) {
  if (!booking) return null;

  const isScheduled = booking.status === 'SCHEDULED';
  const isCompleted = booking.status === 'COMPLETED';
  const isCancelled = booking.status === 'CANCELLED';
  const isAdmin = userRole === 'ADMIN';

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
                      {service.duration_minutes} menit · {formatRupiah(service.price)}
                    </span>
                  </>
                ) : (
                  booking.service_id
                )}
              </dd>
            </div>

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
          </dl>
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
                onClick={() => onRequestStatusChange(booking, 'COMPLETED')}
                className="min-h-[44px] rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                Tandai Selesai
              </button>
            </div>
          </div>
        )}

        {!isScheduled && (
          <div className="mt-6 flex justify-end border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
