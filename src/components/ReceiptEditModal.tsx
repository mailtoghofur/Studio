// Modal formulir perbaikan data resi untuk reservasi yang telah berstatus Selesai (FT-05).

import { AlertCircle, Gift, Home, Lock, MapPin, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_LABELS, LOCATION_LABELS, LOYALTY_MILESTONE_COUNT } from '../config';
import { formatRupiah, formatTimeDisplay } from '../lib/format';
import { findCustomerLoyaltyByPhone, isStandardRewardService } from '../lib/loyalty';
import {
  type ReceiptCorrectionErrors,
  type ReceiptCorrectionFieldName,
  type ReceiptCorrectionInput,
  validateAndApplyReceiptCorrection,
} from '../lib/receipt';
import {
  calculateEndTime,
  generateTimeSlotOptions,
  getEffectiveLocationType,
} from '../lib/schedule';
import type { Booking, LocationType, Service, Therapist } from '../lib/types';

interface ReceiptEditModalProps {
  booking: Booking | null;
  services: Service[];
  therapists: Therapist[];
  allBookings: Booking[];
  onClose: () => void;
  onSaveCorrection: (updatedBooking: Booking) => void;
}

export function ReceiptEditModal({
  booking,
  services,
  therapists,
  allBookings,
  onClose,
  onSaveCorrection,
}: ReceiptEditModalProps) {
  const [form, setForm] = useState<ReceiptCorrectionInput>({
    patient_name: '',
    patient_phone: '',
    service_id: '',
    therapist_id: '',
    booking_date: '',
    start_time: '10:00',
    location_type: 'CLINIC',
    patient_address: '',
    is_loyalty_reward: false,
    final_price: '0',
    notes: '',
    revision_reason: '',
  });
  const [errors, setErrors] = useState<ReceiptCorrectionErrors>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<HTMLSelectElement>(null);
  const therapistRef = useRef<HTMLSelectElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLSelectElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!booking) return;
    const matchedService = services.find((s) => s.service_id === booking.service_id);
    const initialPrice = booking.is_loyalty_reward
      ? 0
      : typeof booking.final_price === 'number'
        ? Math.max(0, Math.round(booking.final_price))
        : matchedService
          ? Math.max(0, Math.round(matchedService.price))
          : 0;

    setForm({
      patient_name: booking.patient_name,
      patient_phone: booking.patient_phone,
      service_id: booking.service_id,
      therapist_id: booking.therapist_id,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      location_type: booking.location_type,
      patient_address: booking.patient_address,
      is_loyalty_reward: Boolean(booking.is_loyalty_reward),
      final_price: String(initialPrice),
      notes: booking.notes,
      revision_reason: booking.receipt_revision_reason ?? '',
    });
    setErrors({});
  }, [booking, services]);

  useEffect(() => {
    if (!booking) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [booking, onClose]);

  const timeOptions = useMemo(() => generateTimeSlotOptions(), []);

  const selectedService = useMemo(
    () => services.find((s) => s.service_id === form.service_id),
    [services, form.service_id]
  );

  const effectiveLocation = useMemo(
    () => getEffectiveLocationType(selectedService, form.location_type),
    [selectedService, form.location_type]
  );

  const computedEndTime = useMemo(() => {
    if (!selectedService) return '';
    return calculateEndTime(form.start_time, selectedService.duration_minutes);
  }, [selectedService, form.start_time]);

  const customerLoyalty = useMemo(() => {
    if (!booking) return null;
    return findCustomerLoyaltyByPhone(
      form.patient_phone,
      allBookings,
      services,
      booking.booking_id
    );
  }, [booking, form.patient_phone, allBookings, services]);

  if (!booking) return null;

  const canUseReward = Boolean(
    (customerLoyalty && customerLoyalty.available_rewards_count > 0) ||
      booking.is_loyalty_reward
  );

  const availableServices = form.is_loyalty_reward
    ? services.filter((s) => isStandardRewardService(s.service_id, services))
    : services;

  const isFacial = selectedService?.category === 'FACIAL';
  const homeServiceDisabled = !selectedService || !selectedService.allow_home_service || isFacial;

  const handleServiceChange = (nextServiceId: string) => {
    const nextSvc = services.find((s) => s.service_id === nextServiceId);
    const nextLoc: LocationType =
      nextSvc && nextSvc.category === 'PIJAT' && nextSvc.allow_home_service
        ? form.location_type
        : 'CLINIC';
    setForm((prev) => ({
      ...prev,
      service_id: nextServiceId,
      location_type: nextLoc,
      final_price: prev.is_loyalty_reward
        ? '0'
        : String(nextSvc ? Math.max(0, Math.round(nextSvc.price)) : prev.final_price),
    }));
  };

  const handleToggleLoyalty = (checked: boolean) => {
    setForm((prev) => {
      if (checked) {
        const standardCandidate = services.find((s) =>
          isStandardRewardService(s.service_id, services)
        );
        const keepCurrent = isStandardRewardService(prev.service_id, services);
        const nextServiceId = keepCurrent
          ? prev.service_id
          : standardCandidate?.service_id ?? prev.service_id;
        return {
          ...prev,
          is_loyalty_reward: true,
          service_id: nextServiceId,
          final_price: '0',
        };
      }
      const currentSvc = services.find((s) => s.service_id === prev.service_id);
      return {
        ...prev,
        is_loyalty_reward: false,
        final_price: String(currentSvc ? Math.max(0, Math.round(currentSvc.price)) : 0),
      };
    });
  };

  const focusFirstError = (validationErrors: ReceiptCorrectionErrors) => {
    const order: ReceiptCorrectionFieldName[] = [
      'patient_name',
      'patient_phone',
      'service_id',
      'therapist_id',
      'booking_date',
      'start_time',
      'patient_address',
      'final_price',
    ];
    const firstKey = order.find((k) => Boolean(validationErrors[k]));
    if (!firstKey) return;
    if (firstKey === 'patient_name') nameRef.current?.focus();
    if (firstKey === 'patient_phone') phoneRef.current?.focus();
    if (firstKey === 'service_id') serviceRef.current?.focus();
    if (firstKey === 'therapist_id') therapistRef.current?.focus();
    if (firstKey === 'booking_date') dateRef.current?.focus();
    if (firstKey === 'start_time') startTimeRef.current?.focus();
    if (firstKey === 'patient_address') addressRef.current?.focus();
    if (firstKey === 'final_price') priceRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateAndApplyReceiptCorrection({
      booking,
      input: form,
      services,
      therapists,
      allBookings,
    });

    if (!result.valid || !result.updatedBooking) {
      setErrors(result.errors);
      focusFirstError(result.errors);
      return;
    }

    onSaveCorrection(result.updatedBooking);
  };

  const parsedPricePreview = Number(/^\d+$/.test(form.final_price.trim()) ? form.final_price.trim() : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-edit-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <p className="text-sm font-medium text-neutral-600 tabular-nums">
              RESI-{booking.booking_id}
            </p>
            <h2 id="receipt-edit-title" className="mt-0.5 text-xl font-semibold text-neutral-900">
              Perbaiki Resi Pemesanan
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup perbaikan resi"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
          {/* Data Pasien */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-receipt-patient-name"
                className="block text-sm font-medium text-neutral-900"
              >
                Nama Pasien
              </label>
              <input
                ref={nameRef}
                id="edit-receipt-patient-name"
                name="patient_name"
                type="text"
                autoComplete="name"
                value={form.patient_name}
                onChange={(e) => setForm((prev) => ({ ...prev, patient_name: e.target.value }))}
                placeholder="Contoh: Budi Santoso"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {errors.patient_name && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.patient_name}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-receipt-patient-phone"
                className="block text-sm font-medium text-neutral-900"
              >
                Nomor WhatsApp / HP
              </label>
              <input
                ref={phoneRef}
                id="edit-receipt-patient-phone"
                name="patient_phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.patient_phone}
                onChange={(e) => setForm((prev) => ({ ...prev, patient_phone: e.target.value }))}
                placeholder="Contoh: 081234567890"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {errors.patient_phone && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.patient_phone}</span>
                </p>
              )}
            </div>
          </div>

          {/* Layanan & Terapis */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-receipt-service"
                className="block text-sm font-medium text-neutral-900"
              >
                Paket Layanan
              </label>
              <select
                ref={serviceRef}
                id="edit-receipt-service"
                name="service_id"
                value={form.service_id}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                {availableServices.map((svc) => (
                  <option key={svc.service_id} value={svc.service_id}>
                    {svc.service_name} ({CATEGORY_LABELS[svc.category]}, {svc.duration_minutes} mnt -{' '}
                    {formatRupiah(svc.price)})
                  </option>
                ))}
              </select>
              {errors.service_id && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.service_id}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-receipt-therapist"
                className="block text-sm font-medium text-neutral-900"
              >
                Terapis
              </label>
              <select
                ref={therapistRef}
                id="edit-receipt-therapist"
                name="therapist_id"
                value={form.therapist_id}
                onChange={(e) => setForm((prev) => ({ ...prev, therapist_id: e.target.value }))}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                {therapists.map((t) => (
                  <option key={t.therapist_id} value={t.therapist_id}>
                    {t.name}
                    {!t.is_active ? ' (Nonaktif)' : ''}
                  </option>
                ))}
              </select>
              {errors.therapist_id && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.therapist_id}</span>
                </p>
              )}
            </div>
          </div>

          {/* Tanggal & Jam */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-receipt-date"
                className="block text-sm font-medium text-neutral-900"
              >
                Tanggal Sesi
              </label>
              <input
                ref={dateRef}
                id="edit-receipt-date"
                name="booking_date"
                type="date"
                value={form.booking_date}
                onChange={(e) => setForm((prev) => ({ ...prev, booking_date: e.target.value }))}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {errors.booking_date && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.booking_date}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-receipt-start-time"
                className="block text-sm font-medium text-neutral-900"
              >
                Jam Mulai (10.00–21.00 WIB)
              </label>
              <select
                ref={startTimeRef}
                id="edit-receipt-start-time"
                name="start_time"
                value={form.start_time}
                onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                {timeOptions.map((slot) => (
                  <option key={slot} value={slot}>
                    {formatTimeDisplay(slot)} WIB
                  </option>
                ))}
              </select>
              {computedEndTime && (
                <p className="mt-1 text-xs text-neutral-600 tabular-nums">
                  Selesai otomatis pukul {formatTimeDisplay(computedEndTime)} WIB
                </p>
              )}
              {errors.start_time && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.start_time}</span>
                </p>
              )}
            </div>
          </div>

          {/* Lokasi */}
          <div>
            <span className="block text-sm font-medium text-neutral-900">Lokasi Layanan</span>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['CLINIC', 'HOME_SERVICE'] as const).map((loc) => {
                const isSelected = effectiveLocation === loc;
                const isDisabled = loc === 'HOME_SERVICE' && homeServiceDisabled;
                return (
                  <button
                    key={loc}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setForm((prev) => ({ ...prev, location_type: loc }))}
                    className={`flex min-h-[48px] items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                      isSelected
                        ? 'border-amber-700 bg-amber-50 text-amber-900'
                        : isDisabled
                          ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400'
                          : 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {loc === 'HOME_SERVICE' ? (
                        <Home className="h-4 w-4 shrink-0" />
                      ) : (
                        <MapPin className="h-4 w-4 shrink-0" />
                      )}
                      <span>{LOCATION_LABELS[loc]}</span>
                    </span>
                    {isDisabled && <Lock className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {effectiveLocation === 'HOME_SERVICE' && (
              <div className="mt-3">
                <label
                  htmlFor="edit-receipt-address"
                  className="block text-sm font-medium text-neutral-900"
                >
                  Alamat Pasien
                </label>
                <textarea
                  ref={addressRef}
                  id="edit-receipt-address"
                  name="patient_address"
                  rows={2}
                  value={form.patient_address}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, patient_address: e.target.value }))
                  }
                  placeholder="Contoh: Jl. Melati No. 12, Jakarta Selatan"
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                {errors.patient_address && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errors.patient_address}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Hadiah Kesetiaan & Total Bayar */}
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            {canUseReward && (
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.is_loyalty_reward}
                  onChange={(e) => handleToggleLoyalty(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-neutral-300 text-amber-700 focus-visible:outline-2 focus-visible:outline-amber-700"
                />
                <span className="text-sm text-neutral-900">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
                    <Gift className="h-4 w-4 text-amber-700" />
                    <span>Gunakan Hadiah Gratis 1x Paket Standar (Rp0)</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-600">
                    Program kesetiaan tiap {LOYALTY_MILESTONE_COUNT} pemesanan berlaku untuk paket
                    standar Pijat atau Facial.
                  </span>
                </span>
              </label>
            )}
            {errors.is_loyalty_reward && (
              <p className="flex items-start gap-1.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errors.is_loyalty_reward}</span>
              </p>
            )}

            <div>
              <label
                htmlFor="edit-receipt-final-price"
                className="block text-sm font-medium text-neutral-900"
              >
                Total Bayar pada Resi (Rp)
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <input
                  ref={priceRef}
                  id="edit-receipt-final-price"
                  name="final_price"
                  type="text"
                  inputMode="numeric"
                  disabled={form.is_loyalty_reward}
                  value={form.final_price}
                  onChange={(e) => setForm((prev) => ({ ...prev, final_price: e.target.value }))}
                  placeholder="Contoh: 150000"
                  className="min-h-[44px] w-full max-w-[220px] rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums disabled:bg-neutral-100 disabled:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                <span className="text-sm font-semibold text-neutral-800 tabular-nums">
                  {form.is_loyalty_reward
                    ? 'Rp0 (Gratis Kesetiaan)'
                    : formatRupiah(Number.isFinite(parsedPricePreview) ? parsedPricePreview : 0)}
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-600">
                Memengaruhi nominal resi, laporan pendapatan, serta komisi terapis 10%.
              </p>
              {errors.final_price && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.final_price}</span>
                </p>
              )}
            </div>
          </div>

          {/* Catatan & Alasan Perbaikan */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-receipt-notes"
                className="block text-sm font-medium text-neutral-900"
              >
                Catatan Resi (Opsional)
              </label>
              <textarea
                id="edit-receipt-notes"
                name="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Catatan layanan pada lembar resi"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
            </div>

            <div>
              <label
                htmlFor="edit-receipt-revision-reason"
                className="block text-sm font-medium text-neutral-900"
              >
                Alasan Perbaikan Resi (Opsional)
              </label>
              <textarea
                id="edit-receipt-revision-reason"
                name="revision_reason"
                rows={2}
                value={form.revision_reason}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, revision_reason: e.target.value }))
                }
                placeholder="Contoh: Koreksi paket layanan atau nama pasien"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {errors.revision_reason && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.revision_reason}</span>
                </p>
              )}
            </div>
          </div>

          {/* Aksi */}
          <div className="flex flex-wrap justify-end gap-3 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              Batal
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-amber-700 px-5 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              Simpan Perbaikan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
