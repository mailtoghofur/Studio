// Formulir pembuatan dan penjadwalan ulang reservasi dengan validasi slot real-time (FT-03 dan FT-04).

import { AlertCircle, CheckCircle2, Gift, Home, Lock, MapPin, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_LABELS, LOCATION_LABELS, LOYALTY_MILESTONE_COUNT } from '../config';
import { formatDateIndo, formatRupiah, formatTimeDisplay } from '../lib/format';
import {
  findCustomerLoyaltyByPhone,
  getStandardRewardServices,
  isStandardRewardService,
} from '../lib/loyalty';
import {
  filterServicesByQuery,
  generateTimeSlotOptions,
  getEffectiveLocationType,
  getTherapistAvailabilities,
  validateBookingInput,
  validateOperatingHours,
} from '../lib/schedule';
import type {
  Booking,
  BookingFieldName,
  BookingFormInput,
  BookingValidationErrors,
  LocationType,
  Service,
  Therapist,
} from '../lib/types';

interface BookingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
  therapists: Therapist[];
  bookings: Booking[];
  initialDate: string;
  initialStartTime?: string;
  initialTherapistId?: string;
  initialServiceId?: string;
  initialCustomer?: {
    patientName: string;
    patientPhone: string;
    useLoyaltyReward?: boolean;
  } | null;
  editingBooking?: Booking | null;
  onRequestSave: (payload: {
    mode: 'create' | 'reschedule';
    booking: Booking;
    serviceName: string;
    therapistName: string;
  }) => void;
}

export function BookingFormModal({
  isOpen,
  onClose,
  services,
  therapists,
  bookings,
  initialDate,
  initialStartTime = '10:00',
  initialTherapistId = '',
  initialServiceId = '',
  initialCustomer = null,
  editingBooking = null,
  onRequestSave,
}: BookingFormModalProps) {
  const defaultServiceId = services[0]?.service_id ?? '';
  const [form, setForm] = useState<BookingFormInput>({
    patient_name: '',
    patient_phone: '',
    service_id: defaultServiceId,
    location_type: 'CLINIC',
    patient_address: '',
    booking_date: initialDate,
    start_time: initialStartTime,
    therapist_id: initialTherapistId,
    notes: '',
  });
  const [useLoyaltyReward, setUseLoyaltyReward] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [errors, setErrors] = useState<BookingValidationErrors>({});

  const patientNameRef = useRef<HTMLInputElement>(null);
  const patientPhoneRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<HTMLSelectElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLSelectElement>(null);
  const therapistSectionRef = useRef<HTMLDivElement>(null);

  const standardServices = useMemo(() => getStandardRewardServices(services), [services]);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setServiceSearch('');
    if (editingBooking) {
      setForm({
        patient_name: editingBooking.patient_name,
        patient_phone: editingBooking.patient_phone,
        service_id: editingBooking.service_id,
        location_type: editingBooking.location_type,
        patient_address: editingBooking.patient_address,
        booking_date: editingBooking.booking_date,
        start_time: editingBooking.start_time,
        therapist_id: editingBooking.therapist_id,
        notes: editingBooking.notes,
      });
      setUseLoyaltyReward(Boolean(editingBooking.is_loyalty_reward));
    } else {
      const wantReward = Boolean(initialCustomer?.useLoyaltyReward);
      const stdDefaultId =
        standardServices.PIJAT?.service_id ??
        standardServices.FACIAL?.service_id ??
        services[0]?.service_id ??
        '';
      const preferredServiceId =
        !wantReward && initialServiceId && services.some((s) => s.service_id === initialServiceId)
          ? initialServiceId
          : wantReward
            ? stdDefaultId
            : (services[0]?.service_id ?? '');
      setForm({
        patient_name: initialCustomer?.patientName ?? '',
        patient_phone: initialCustomer?.patientPhone ?? '',
        service_id: preferredServiceId,
        location_type: 'CLINIC',
        patient_address: '',
        booking_date: initialDate,
        start_time: initialStartTime || '10:00',
        therapist_id: initialTherapistId || '',
        notes: '',
      });
      setUseLoyaltyReward(wantReward);
    }
  }, [
    isOpen,
    editingBooking,
    initialDate,
    initialStartTime,
    initialTherapistId,
    initialServiceId,
    initialCustomer,
    services,
    standardServices,
  ]);

  const customerLoyalty = useMemo(
    () =>
      findCustomerLoyaltyByPhone(
        form.patient_phone,
        bookings,
        services,
        editingBooking?.booking_id
      ),
    [form.patient_phone, bookings, services, editingBooking]
  );

  const canUseLoyaltyReward = Boolean(
    (customerLoyalty && customerLoyalty.available_rewards_count > 0) ||
      editingBooking?.is_loyalty_reward
  );

  const effectiveRewardMode = useLoyaltyReward && canUseLoyaltyReward;

  useEffect(() => {
    if (!canUseLoyaltyReward && useLoyaltyReward) {
      setUseLoyaltyReward(false);
    }
  }, [canUseLoyaltyReward, useLoyaltyReward]);

  const baseServicesForDropdown = useMemo(() => {
    if (!effectiveRewardMode) return services;
    return services.filter((s) => isStandardRewardService(s.service_id, services));
  }, [effectiveRewardMode, services]);

  const availableServicesForDropdown = useMemo(
    () => filterServicesByQuery(baseServicesForDropdown, serviceSearch),
    [baseServicesForDropdown, serviceSearch]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (availableServicesForDropdown.length === 0) return;
    const stillVisible = availableServicesForDropdown.some(
      (s) => s.service_id === form.service_id
    );
    if (!stillVisible) {
      const firstMatch = availableServicesForDropdown[0];
      setForm((prev) => ({
        ...prev,
        service_id: firstMatch.service_id,
        location_type: firstMatch.category === 'FACIAL' ? 'CLINIC' : prev.location_type,
      }));
    }
  }, [isOpen, availableServicesForDropdown, form.service_id]);

  const selectedService = useMemo(
    () => services.find((s) => s.service_id === form.service_id),
    [services, form.service_id]
  );

  const isFacial = selectedService?.category === 'FACIAL';
  const effectiveLocation: LocationType = getEffectiveLocationType(
    selectedService,
    form.location_type
  );

  const timeOptions = useMemo(() => generateTimeSlotOptions(), []);

  const hoursCheck = useMemo(
    () =>
      validateOperatingHours(
        form.start_time,
        selectedService?.duration_minutes ?? 60
      ),
    [form.start_time, selectedService]
  );

  const availabilities = useMemo(
    () =>
      getTherapistAvailabilities({
        therapists,
        bookings,
        bookingDate: form.booking_date,
        startTime: form.start_time,
        durationMinutes: selectedService?.duration_minutes ?? 60,
        excludeBookingId: editingBooking?.booking_id,
      }),
    [
      therapists,
      bookings,
      form.booking_date,
      form.start_time,
      selectedService,
      editingBooking,
    ]
  );

  const anyTherapistAvailable = availabilities.some((a) => a.available);

  if (!isOpen) return null;

  const focusFirstError = (nextErrors: BookingValidationErrors) => {
    const order: BookingFieldName[] = [
      'patient_name',
      'patient_phone',
      'service_id',
      'patient_address',
      'booking_date',
      'start_time',
      'therapist_id',
    ];
    for (const key of order) {
      if (!nextErrors[key]) continue;
      if (key === 'patient_name') patientNameRef.current?.focus();
      else if (key === 'patient_phone') patientPhoneRef.current?.focus();
      else if (key === 'service_id') serviceRef.current?.focus();
      else if (key === 'patient_address') addressRef.current?.focus();
      else if (key === 'booking_date') dateRef.current?.focus();
      else if (key === 'start_time') startTimeRef.current?.focus();
      else if (key === 'therapist_id') {
        const firstRadio = therapistSectionRef.current?.querySelector<HTMLInputElement>(
          'input[type="radio"]'
        );
        firstRadio?.focus();
      }
      break;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateBookingInput(
      {
        ...form,
        location_type: effectiveLocation,
      },
      {
        services,
        therapists,
        bookings,
        excludeBookingId: editingBooking?.booking_id,
      }
    );

    if (!validation.valid || !validation.normalizedPhone || !selectedService) {
      setErrors(validation.errors);
      focusFirstError(validation.errors);
      return;
    }

    const nowIso = new Date().toISOString();
    const chosenTherapist = therapists.find((t) => t.therapist_id === form.therapist_id);
    const nextBooking: Booking = {
      booking_id:
        editingBooking?.booking_id ??
        `RSV-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      patient_name: form.patient_name.trim(),
      patient_phone: validation.normalizedPhone,
      service_id: selectedService.service_id,
      therapist_id: form.therapist_id,
      booking_date: form.booking_date,
      start_time: form.start_time,
      end_time: validation.endTime,
      location_type: validation.effectiveLocationType,
      patient_address:
        validation.effectiveLocationType === 'HOME_SERVICE'
          ? form.patient_address.trim()
          : '',
      notes: form.notes.trim(),
      status: editingBooking ? editingBooking.status : 'SCHEDULED',
      is_loyalty_reward: effectiveRewardMode,
      final_price: effectiveRewardMode ? 0 : selectedService.price,
      created_at: editingBooking?.created_at ?? nowIso,
      updated_at: nowIso,
    };

    setErrors({});
    onRequestSave({
      mode: editingBooking ? 'reschedule' : 'create',
      booking: nextBooking,
      serviceName: selectedService.service_name,
      therapistName: chosenTherapist?.name ?? form.therapist_id,
    });
  };

  const massageServices = availableServicesForDropdown.filter((s) => s.category === 'PIJAT');
  const facialServices = availableServicesForDropdown.filter((s) => s.category === 'FACIAL');

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-neutral-900/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-form-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <h2 id="booking-form-title" className="text-xl font-semibold text-neutral-900">
              {editingBooking ? 'Jadwalkan Ulang Reservasi' : 'Buat Reservasi Baru'}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Validasi jam tutup 21.00 dan ketersediaan terapis berjalan otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir reservasi"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
          {/* Data Pasien */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="patient_name" className="block text-sm font-medium text-neutral-800">
                Nama Pasien <span className="text-red-700">*</span>
              </label>
              <input
                ref={patientNameRef}
                id="patient_name"
                name="patient_name"
                type="text"
                autoComplete="name"
                value={form.patient_name}
                onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
                placeholder="Contoh: Budi Santoso"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {errors.patient_name && (
                <p className="mt-1.5 text-sm text-red-700">{errors.patient_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="patient_phone" className="block text-sm font-medium text-neutral-800">
                Nomor HP / WhatsApp <span className="text-red-700">*</span>
              </label>
              <input
                ref={patientPhoneRef}
                id="patient_phone"
                name="patient_phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.patient_phone}
                onChange={(e) => setForm({ ...form, patient_phone: e.target.value })}
                placeholder="Contoh: 081234567890"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {errors.patient_phone ? (
                <p className="mt-1.5 text-sm text-red-700">{errors.patient_phone}</p>
              ) : (
                <p className="mt-1 text-sm text-neutral-600">Terima format 08xxx, +62xxx, atau 62xxx.</p>
              )}
            </div>
          </div>

          {/* Status Kesetiaan Pelanggan (FT-09) */}
          {(customerLoyalty || editingBooking?.is_loyalty_reward) && (
            <div
              className={`rounded-xl border p-3.5 text-sm ${
                canUseLoyaltyReward
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-800'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Gift className="h-4 w-4 text-amber-700" />
                  <span>
                    {customerLoyalty
                      ? `Kesetiaan Pelanggan: ${customerLoyalty.paid_bookings_count}x pemesanan`
                      : 'Reservasi Hadiah Kesetiaan'}
                  </span>
                </div>
                {customerLoyalty && (
                  <span className="text-xs font-medium tabular-nums">
                    {customerLoyalty.pijat_count} Pijat · {customerLoyalty.facial_count} Facial
                  </span>
                )}
              </div>

              {canUseLoyaltyReward ? (
                <div className="mt-2.5 space-y-2">
                  <p className="text-xs text-emerald-900">
                    {customerLoyalty && customerLoyalty.available_rewards_count > 0
                      ? `Pelanggan memiliki ${customerLoyalty.available_rewards_count}x hak gratis Pijat atau Facial paket standar.`
                      : 'Reservasi ini menggunakan hadiah gratis paket standar.'}
                  </p>
                  <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900">
                    <input
                      type="checkbox"
                      checked={effectiveRewardMode}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseLoyaltyReward(checked);
                        if (
                          checked &&
                          !isStandardRewardService(form.service_id, services)
                        ) {
                          const nextStdId =
                            selectedService?.category === 'FACIAL'
                              ? standardServices.FACIAL?.service_id
                              : standardServices.PIJAT?.service_id;
                          const fallbackId =
                            nextStdId ??
                            standardServices.PIJAT?.service_id ??
                            standardServices.FACIAL?.service_id;
                          if (fallbackId) {
                            const nextSvc = services.find((s) => s.service_id === fallbackId);
                            setForm((prev) => ({
                              ...prev,
                              service_id: fallbackId,
                              location_type:
                                nextSvc?.category === 'FACIAL' ? 'CLINIC' : prev.location_type,
                            }));
                          }
                        }
                      }}
                      className="h-4 w-4 accent-amber-700"
                    />
                    <span>Gunakan Hadiah Gratis 1x Paket Standar (Rp0)</span>
                  </label>
                </div>
              ) : (
                customerLoyalty && (
                  <p className="mt-1 text-xs text-neutral-600 tabular-nums">
                    Progres ke hadiah gratis berikutnya: {customerLoyalty.cycle_progress}/
                    {LOYALTY_MILESTONE_COUNT} (kurang {customerLoyalty.remaining_to_next_reward}{' '}
                    pemesanan lagi).
                  </p>
                )
              )}
            </div>
          )}

          {/* Pencarian & Pilihan Layanan */}
          <div className="space-y-3">
            <div>
              <label
                htmlFor="booking-service-search"
                className="block text-sm font-medium text-neutral-800"
              >
                Cari Layanan
              </label>
              <div className="relative mt-1.5 flex items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-500" />
                <input
                  id="booking-service-search"
                  name="bookingServiceSearch"
                  type="search"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Ketik nama paket, Pijat, Facial, atau durasi…"
                  className="min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white pr-10 pl-9 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                {serviceSearch && (
                  <button
                    type="button"
                    onClick={() => setServiceSearch('')}
                    aria-label="Hapus pencarian layanan"
                    className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-amber-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {serviceSearch.trim() && (
                <p className="mt-1 text-xs text-neutral-600 tabular-nums">
                  {availableServicesForDropdown.length > 0
                    ? `Menampilkan ${availableServicesForDropdown.length} dari ${baseServicesForDropdown.length} layanan.`
                    : 'Tidak ada layanan yang cocok dengan kata kunci tersebut.'}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="service_id" className="block text-sm font-medium text-neutral-800">
                {effectiveRewardMode ? 'Paket Standar Gratis' : 'Paket Layanan'}{' '}
                <span className="text-red-700">*</span>
              </label>
              <select
                ref={serviceRef}
                id="service_id"
                name="service_id"
                value={form.service_id}
                onChange={(e) => {
                  const nextSvc = services.find((s) => s.service_id === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    service_id: e.target.value,
                    location_type:
                      nextSvc?.category === 'FACIAL' ? 'CLINIC' : prev.location_type,
                  }));
                }}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                {availableServicesForDropdown.length === 0 && (
                  <option value="">
                    {serviceSearch.trim() ? 'Tidak ada layanan cocok' : 'Belum ada layanan'}
                  </option>
                )}
                {massageServices.length > 0 && (
                  <optgroup label={CATEGORY_LABELS.PIJAT}>
                    {massageServices.map((s) => (
                      <option key={s.service_id} value={s.service_id}>
                        {s.service_name} ({s.duration_minutes} menit ·{' '}
                        {effectiveRewardMode ? 'Rp0 Gratis' : formatRupiah(s.price)})
                      </option>
                    ))}
                  </optgroup>
                )}
                {facialServices.length > 0 && (
                  <optgroup label={CATEGORY_LABELS.FACIAL}>
                    {facialServices.map((s) => (
                      <option key={s.service_id} value={s.service_id}>
                        {s.service_name} ({s.duration_minutes} menit ·{' '}
                        {effectiveRewardMode ? 'Rp0 Gratis' : formatRupiah(s.price)})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {errors.service_id && (
                <p className="mt-1.5 text-sm text-red-700">{errors.service_id}</p>
              )}
            </div>
          </div>

          {/* Lokasi Layanan (BL-04) */}
          <div>
            <span className="block text-sm font-medium text-neutral-800">
              Lokasi Layanan <span className="text-red-700">*</span>
            </span>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label
                className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                  effectiveLocation === 'CLINIC'
                    ? 'border-amber-700 bg-amber-50 text-neutral-900'
                    : 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="radio"
                  name="location_type"
                  value="CLINIC"
                  checked={effectiveLocation === 'CLINIC'}
                  onChange={() => setForm({ ...form, location_type: 'CLINIC' })}
                  className="h-4 w-4 accent-amber-700"
                />
                <MapPin className="h-4 w-4 shrink-0 text-amber-800" />
                <span className="text-sm font-medium">{LOCATION_LABELS.CLINIC}</span>
              </label>

              <label
                className={`flex min-h-[48px] items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                  isFacial
                    ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-500'
                    : effectiveLocation === 'HOME_SERVICE'
                      ? 'cursor-pointer border-amber-700 bg-amber-50 text-neutral-900'
                      : 'cursor-pointer border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="radio"
                  name="location_type"
                  value="HOME_SERVICE"
                  disabled={isFacial}
                  checked={effectiveLocation === 'HOME_SERVICE'}
                  onChange={() => setForm({ ...form, location_type: 'HOME_SERVICE' })}
                  className="h-4 w-4 accent-amber-700"
                />
                {isFacial ? (
                  <Lock className="h-4 w-4 shrink-0 text-neutral-500" />
                ) : (
                  <Home className="h-4 w-4 shrink-0 text-amber-800" />
                )}
                <span className="text-sm font-medium">{LOCATION_LABELS.HOME_SERVICE}</span>
              </label>
            </div>
            {isFacial && (
              <p className="mt-1.5 text-sm text-neutral-600">
                Layanan Facial otomatis dikunci ke Di Klinik.
              </p>
            )}
          </div>

          {/* Alamat wajib jika Pijat - Di Tempat Pasien */}
          {!isFacial && effectiveLocation === 'HOME_SERVICE' && (
            <div>
              <label
                htmlFor="patient_address"
                className="block text-sm font-medium text-neutral-800"
              >
                Alamat Lengkap Pasien <span className="text-red-700">*</span>
              </label>
              <textarea
                ref={addressRef}
                id="patient_address"
                name="patient_address"
                rows={2}
                value={form.patient_address}
                onChange={(e) => setForm({ ...form, patient_address: e.target.value })}
                placeholder="Contoh: Jl. Melati No. 12, Kebayoran Baru, Jakarta Selatan"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {errors.patient_address && (
                <p className="mt-1.5 text-sm text-red-700">{errors.patient_address}</p>
              )}
            </div>
          )}

          {/* Tanggal & Jam Mulai */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="booking_date" className="block text-sm font-medium text-neutral-800">
                Tanggal Layanan <span className="text-red-700">*</span>
              </label>
              <input
                ref={dateRef}
                id="booking_date"
                name="booking_date"
                type="date"
                value={form.booking_date}
                onChange={(e) => setForm({ ...form, booking_date: e.target.value })}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {errors.booking_date ? (
                <p className="mt-1.5 text-sm text-red-700">{errors.booking_date}</p>
              ) : (
                <p className="mt-1 text-sm text-neutral-600">{formatDateIndo(form.booking_date)}</p>
              )}
            </div>

            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-neutral-800">
                Jam Mulai <span className="text-red-700">*</span>
              </label>
              <select
                ref={startTimeRef}
                id="start_time"
                name="start_time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {formatTimeDisplay(t)} WIB
                  </option>
                ))}
              </select>
              {hoursCheck.endTime && (
                <p
                  className={`mt-1.5 text-sm tabular-nums ${
                    hoursCheck.valid ? 'text-neutral-700' : 'font-medium text-red-700'
                  }`}
                >
                  Perkiraan selesai pukul {formatTimeDisplay(hoursCheck.endTime)} WIB
                  {!hoursCheck.valid && ' (melewati 21.00)'}
                </p>
              )}
              {errors.start_time && (
                <p className="mt-1 text-sm text-red-700">{errors.start_time}</p>
              )}
            </div>
          </div>

          {!hoursCheck.valid && hoursCheck.error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{hoursCheck.error}</span>
            </div>
          )}

          {/* Pemilihan 3 Terapis */}
          <div ref={therapistSectionRef}>
            <span className="block text-sm font-medium text-neutral-800">
              Pilih Terapis <span className="text-red-700">*</span>
            </span>
            <div className="mt-2 space-y-2">
              {availabilities.map((item) => {
                const isSelected = form.therapist_id === item.therapist.therapist_id;
                return (
                  <label
                    key={item.therapist.therapist_id}
                    className={`flex min-h-[48px] items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                      !item.available
                        ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-500'
                        : isSelected
                          ? 'cursor-pointer border-amber-700 bg-amber-50 text-neutral-900'
                          : 'cursor-pointer border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="therapist_id"
                        value={item.therapist.therapist_id}
                        checked={isSelected}
                        disabled={!item.available}
                        onChange={() =>
                          setForm({ ...form, therapist_id: item.therapist.therapist_id })
                        }
                        className="h-4 w-4 accent-amber-700"
                      />
                      <span className="text-sm font-semibold">{item.therapist.name}</span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-medium tabular-nums ${
                        item.available ? 'text-emerald-800' : 'text-red-700'
                      }`}
                    >
                      {item.available ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Tersedia</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4" />
                          <span>{item.reason ?? 'Tidak Tersedia'}</span>
                        </>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            {!anyTherapistAvailable && (
              <p className="mt-2 text-sm font-medium text-red-700">
                Semua terapis aktif sudah terisi pada jam tersebut. Silakan pilih jam lain.
              </p>
            )}
            {errors.therapist_id && (
              <p className="mt-1.5 text-sm text-red-700">{errors.therapist_id}</p>
            )}
          </div>

          {/* Catatan opsional */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-neutral-800">
              Catatan (Opsional)
            </label>
            <input
              id="notes"
              name="notes"
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Contoh: Fokus area punggung, alergi minyak tertentu"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              Batal
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-amber-700 px-5 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              {editingBooking ? 'Simpan Jadwal Baru' : 'Simpan Reservasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
