// Tampilan kalender harian berdampingan untuk seluruh terapis pada jam operasional 10.00-21.00 (FT-01).

import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  MapPin,
  Plus,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { CLINIC_HOURS, LOCATION_LABELS, STATUS_LABELS } from '../config';
import {
  addDaysYYYYMMDD,
  formatRupiah,
  formatTimeDisplay,
  formatTimeRange,
  formatWeekdayDateIndo,
  getTodayYYYYMMDD,
} from '../lib/format';
import {
  filterServicesByQuery,
  generateTimeSlotOptions,
  matchesServiceSearch,
  timeToMinutes,
} from '../lib/schedule';
import type { Booking, BookingStatus, Service, Therapist, UserRole } from '../lib/types';

interface DailyCalendarViewProps {
  selectedDate: string;
  onChangeDate: (date: string) => void;
  therapists: Therapist[];
  services: Service[];
  bookings: Booking[];
  userRole: UserRole;
  loggedInTherapistId?: string;
  onCreateAtSlot: (therapistId: string, startTime: string) => void;
  onCreateWithService?: (serviceId: string) => void;
  onSelectBooking: (booking: Booking) => void;
}

type FilterTab = 'ALL' | BookingStatus;

const SLOT_ROW_HEIGHT = 44; // px per 30 menit (memenuhi target sentuh minimal 44px)

export function DailyCalendarView({
  selectedDate,
  onChangeDate,
  therapists,
  services,
  bookings,
  userRole,
  loggedInTherapistId,
  onCreateAtSlot,
  onCreateWithService,
  onSelectBooking,
}: DailyCalendarViewProps) {
  const [statusFilter, setStatusFilter] = useState<FilterTab>('ALL');
  const [serviceQuery, setServiceQuery] = useState('');
  const timeSlots = useMemo(() => generateTimeSlotOptions(), []);
  const serviceMap = useMemo(
    () => new Map(services.map((s) => [s.service_id, s])),
    [services]
  );
  const therapistMap = useMemo(
    () => new Map(therapists.map((t) => [t.therapist_id, t])),
    [therapists]
  );

  const isTherapistRole = userRole === 'THERAPIST';
  const visibleTherapists = useMemo(() => {
    if (isTherapistRole && loggedInTherapistId) {
      const own = therapists.filter((t) => t.therapist_id === loggedInTherapistId);
      if (own.length > 0) return own;
    }
    return therapists;
  }, [therapists, isTherapistRole, loggedInTherapistId]);

  const dayBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        if (b.booking_date !== selectedDate) return false;
        if (isTherapistRole && loggedInTherapistId) {
          return b.therapist_id === loggedInTherapistId;
        }
        return true;
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [bookings, selectedDate, isTherapistRole, loggedInTherapistId]);

  const trimmedServiceQuery = serviceQuery.trim();
  const matchedCatalogServices = useMemo(
    () => (trimmedServiceQuery ? filterServicesByQuery(services, trimmedServiceQuery) : []),
    [services, trimmedServiceQuery]
  );

  const filteredDayBookings = useMemo(() => {
    if (!trimmedServiceQuery) return dayBookings;
    return dayBookings.filter((b) =>
      matchesServiceSearch(serviceMap.get(b.service_id), trimmedServiceQuery, b.service_id)
    );
  }, [dayBookings, serviceMap, trimmedServiceQuery]);

  const counts = useMemo(() => {
    let scheduled = 0;
    let completed = 0;
    let cancelled = 0;
    for (const b of dayBookings) {
      if (b.status === 'SCHEDULED') scheduled += 1;
      else if (b.status === 'COMPLETED') completed += 1;
      else if (b.status === 'CANCELLED') cancelled += 1;
    }
    return { scheduled, completed, cancelled };
  }, [dayBookings]);

  const gridBookings = useMemo(() => {
    return filteredDayBookings.filter((b) => {
      if (b.status === 'CANCELLED') return false;
      if (statusFilter === 'ALL') return true;
      return b.status === statusFilter;
    });
  }, [filteredDayBookings, statusFilter]);

  const cancelledBookings = useMemo(() => {
    if (statusFilter !== 'ALL' && statusFilter !== 'CANCELLED') return [];
    return filteredDayBookings.filter((b) => b.status === 'CANCELLED');
  }, [filteredDayBookings, statusFilter]);

  const totalGridHeight = timeSlots.length * SLOT_ROW_HEIGHT;
  const activeTherapistCount = visibleTherapists.filter((t) => t.is_active).length;
  const colCount = Math.max(1, visibleTherapists.length);
  const gridTemplateStyle = {
    gridTemplateColumns: `76px repeat(${colCount}, minmax(180px, 1fr))`,
  };
  const minGridWidthPx = 76 + colCount * 190;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
              {formatWeekdayDateIndo(selectedDate)}
            </h1>
            <p className="mt-1 text-sm text-neutral-600 tabular-nums">
              Jam Operasional 10.00–21.00 · {activeTherapistCount} Terapis Aktif ·{' '}
              {counts.scheduled} Terjadwal · {counts.completed} Selesai · {counts.cancelled} Dibatalkan
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeDate(addDaysYYYYMMDD(selectedDate, -1))}
              aria-label="Tanggal sebelumnya"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="relative flex items-center">
              <label htmlFor="calendar-date-picker" className="sr-only">
                Pilih tanggal jadwal
              </label>
              <input
                id="calendar-date-picker"
                name="calendarDate"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) onChangeDate(e.target.value);
                }}
                className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
            </div>
            <button
              type="button"
              onClick={() => onChangeDate(getTodayYYYYMMDD())}
              className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => onChangeDate(addDaysYYYYMMDD(selectedDate, 1))}
              aria-label="Tanggal berikutnya"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div
              role="tablist"
              aria-label="Filter status reservasi"
              className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-neutral-100 p-1"
            >
              {(
                [
                  { key: 'ALL', label: 'Semua' },
                  { key: 'SCHEDULED', label: 'Terjadwal' },
                  { key: 'COMPLETED', label: 'Selesai' },
                  { key: 'CANCELLED', label: 'Dibatalkan' },
                ] as const
              ).map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(tab.key)}
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

            <div className="w-full sm:w-auto sm:min-w-[280px]">
              <label
                htmlFor="calendar-service-search"
                className="block text-sm font-medium text-neutral-800"
              >
                Cari Layanan
              </label>
              <div className="relative mt-1 flex items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-500" />
                <input
                  id="calendar-service-search"
                  name="calendarServiceSearch"
                  type="search"
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  placeholder="Cari Pijat, Facial, atau durasi…"
                  className="min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white pr-10 pl-9 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                {serviceQuery && (
                  <button
                    type="button"
                    onClick={() => setServiceQuery('')}
                    aria-label="Hapus pencarian layanan"
                    className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-amber-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {trimmedServiceQuery ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-neutral-800 tabular-nums">
                  Menampilkan {filteredDayBookings.length} jadwal cocok ·{' '}
                  {matchedCatalogServices.length} layanan ditemukan
                </span>
                <button
                  type="button"
                  onClick={() => setServiceQuery('')}
                  className="text-sm font-medium text-amber-800 hover:underline focus-visible:outline-2 focus-visible:outline-amber-700"
                >
                  Reset Pencarian
                </button>
              </div>
              {matchedCatalogServices.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {matchedCatalogServices.map((svc) =>
                    !isTherapistRole && onCreateWithService ? (
                      <button
                        key={svc.service_id}
                        type="button"
                        onClick={() => onCreateWithService(svc.service_id)}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm text-neutral-900 hover:border-amber-700 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                        <span className="font-medium">{svc.service_name}</span>
                        <span className="text-xs text-neutral-600 tabular-nums">
                          {svc.duration_minutes} mnt · {formatRupiah(svc.price)}
                        </span>
                      </button>
                    ) : (
                      <span
                        key={svc.service_id}
                        className="inline-flex min-h-[36px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900"
                      >
                        <span className="font-medium">{svc.service_name}</span>
                        <span className="text-xs text-neutral-600 tabular-nums">
                          {svc.duration_minutes} mnt · {formatRupiah(svc.price)}
                        </span>
                      </span>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-neutral-600">
                  Tidak ada layanan di katalog yang cocok dengan kata kunci tersebut.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-600">
              {isTherapistRole
                ? 'Klik blok jadwal untuk melihat rincian layanan dan alamat pasien.'
                : 'Klik slot kosong untuk langsung menjadwalkan terapis.'}
            </p>
          )}
        </div>

        {statusFilter !== 'CANCELLED' && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
            <div style={{ minWidth: isTherapistRole ? '100%' : `${minGridWidthPx}px` }}>
              {/* Header kolom waktu + kolom terapis */}
              <div
                style={gridTemplateStyle}
                className="grid border-b border-neutral-200 bg-neutral-50"
              >
                <div className="sticky left-0 z-10 flex items-center justify-center border-r border-neutral-200 bg-neutral-50 px-2 py-3 text-sm font-semibold text-neutral-700">
                  Jam
                </div>
                {visibleTherapists.map((therapist) => (
                  <div
                    key={therapist.therapist_id}
                    className="border-r border-neutral-200 px-3 py-3 last:border-r-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-neutral-900">
                        {therapist.name}
                      </span>
                      <span
                        className={`text-xs font-medium whitespace-nowrap ${
                          therapist.is_active ? 'text-neutral-600' : 'text-red-700'
                        }`}
                      >
                        {therapist.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tubuh kalender 10.00-21.00 */}
              <div style={gridTemplateStyle} className="grid">
                {/* Kolom label jam */}
                <div className="sticky left-0 z-10 border-r border-neutral-200 bg-white">
                  {timeSlots.map((slot) => (
                    <div
                      key={slot}
                      style={{ height: SLOT_ROW_HEIGHT }}
                      className="flex items-start justify-center border-b border-neutral-200 pt-1.5 text-sm font-medium text-neutral-600 tabular-nums last:border-b-0"
                    >
                      {formatTimeDisplay(slot)}
                    </div>
                  ))}
                </div>

                {/* Kolom tiap terapis */}
                {visibleTherapists.map((therapist) => {
                  const therapistBookings = gridBookings.filter(
                    (b) => b.therapist_id === therapist.therapist_id
                  );

                  return (
                    <div
                      key={therapist.therapist_id}
                      style={{ height: totalGridHeight }}
                      className="relative border-r border-neutral-200 bg-white last:border-r-0"
                    >
                      {timeSlots.map((slot) => {
                        const slotMinutes = timeToMinutes(slot);
                        const isOccupiedByActive = therapistBookings.some((b) => {
                          if (b.status !== 'SCHEDULED') return false;
                          const s = timeToMinutes(b.start_time);
                          const e = timeToMinutes(b.end_time);
                          return slotMinutes >= s && slotMinutes < e;
                        });

                        const canClick =
                          !isTherapistRole && therapist.is_active && !isOccupiedByActive;

                        return (
                          <div
                            key={slot}
                            style={{ height: SLOT_ROW_HEIGHT }}
                            className="border-b border-neutral-200 last:border-b-0"
                          >
                            {canClick ? (
                              <button
                                type="button"
                                onClick={() => onCreateAtSlot(therapist.therapist_id, slot)}
                                aria-label={`Buat reservasi untuk ${therapist.name} pukul ${formatTimeDisplay(slot)}`}
                                className="group flex h-full w-full items-center justify-center text-transparent transition-colors hover:bg-amber-50/70 hover:text-amber-700 focus-visible:bg-amber-50 focus-visible:text-amber-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-700"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            ) : (
                              <div
                                className={`h-full w-full ${
                                  therapist.is_active ? '' : 'bg-neutral-100/70'
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}

                      {/* Blok reservasi */}
                      {therapistBookings.map((booking) => {
                        const startMin = Math.max(
                          CLINIC_HOURS.openMinutes,
                          timeToMinutes(booking.start_time)
                        );
                        const endMin = Math.min(
                          CLINIC_HOURS.closeMinutes,
                          timeToMinutes(booking.end_time)
                        );
                        const topPx =
                          ((startMin - CLINIC_HOURS.openMinutes) / CLINIC_HOURS.slotStepMinutes) *
                          SLOT_ROW_HEIGHT;
                        const heightPx = Math.max(
                          SLOT_ROW_HEIGHT,
                          ((endMin - startMin) / CLINIC_HOURS.slotStepMinutes) * SLOT_ROW_HEIGHT
                        );

                        const service = serviceMap.get(booking.service_id);
                        const isCompleted = booking.status === 'COMPLETED';
                        const isHome = booking.location_type === 'HOME_SERVICE';

                        return (
                          <button
                            key={booking.booking_id}
                            type="button"
                            onClick={() => onSelectBooking(booking)}
                            style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                            className={`absolute inset-x-1 z-20 flex flex-col justify-between overflow-hidden rounded-xl border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                              isCompleted
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100/80'
                                : 'border-amber-400 bg-amber-50 text-neutral-900 hover:bg-amber-100/70'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="truncate text-xs font-semibold tabular-nums text-neutral-800">
                                  {formatTimeRange(booking.start_time, booking.end_time)}
                                </span>
                                <span
                                  className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${
                                    isCompleted ? 'text-emerald-800' : 'text-amber-800'
                                  }`}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  ) : (
                                    <Clock className="h-3.5 w-3.5" />
                                  )}
                                  <span>{STATUS_LABELS[booking.status]}</span>
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">
                                {booking.patient_name}
                              </p>
                              {heightPx >= 64 && (
                                <p className="truncate text-xs text-neutral-700">
                                  {service?.service_name ?? booking.service_id}
                                </p>
                              )}
                            </div>

                            {heightPx >= 84 && (
                              <div className="flex items-center gap-1 text-xs text-neutral-700">
                                {isHome ? (
                                  <Home className="h-3.5 w-3.5 shrink-0 text-amber-800" />
                                ) : (
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                                )}
                                <span className="truncate">
                                  {LOCATION_LABELS[booking.location_type]}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {dayBookings.length === 0 && (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
            <Calendar className="h-6 w-6 text-neutral-400" />
            <p className="mt-2 text-base font-medium text-neutral-900">
              Belum ada reservasi pada tanggal ini
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              {isTherapistRole
                ? 'Anda belum memiliki jadwal penugasan pada tanggal ini.'
                : 'Klik salah satu slot kosong di kalender atau tekan tombol Buat Reservasi.'}
            </p>
          </div>
        )}

        {cancelledBookings.length > 0 && (
          <div className="mt-6">
            <h2 className="text-base font-semibold text-neutral-900">
              Jadwal Dibatalkan ({cancelledBookings.length})
            </h2>
            <p className="mt-0.5 text-sm text-neutral-600">
              Slot waktu dari jadwal berikut sudah dibebaskan dan dapat dipesan ulang.
            </p>
            <div className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
              {cancelledBookings.map((booking) => {
                const service = serviceMap.get(booking.service_id);
                const therapist = therapistMap.get(booking.therapist_id);
                return (
                  <button
                    key={booking.booking_id}
                    type="button"
                    onClick={() => onSelectBooking(booking)}
                    className="flex min-h-[48px] w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-700"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900">
                        {booking.patient_name}{' '}
                        <span className="font-normal text-neutral-600">
                          · {service?.service_name ?? booking.service_id}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm text-neutral-600 tabular-nums">
                        {formatTimeRange(booking.start_time, booking.end_time)} ·{' '}
                        {therapist?.name ?? booking.therapist_id} ·{' '}
                        {LOCATION_LABELS[booking.location_type]}
                      </p>
                      {booking.cancellation_reason && (
                        <p className="mt-0.5 text-xs text-red-800">
                          Alasan: {booking.cancellation_reason}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-800">
                      <XCircle className="h-4 w-4" />
                      <span>{STATUS_LABELS.CANCELLED}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
