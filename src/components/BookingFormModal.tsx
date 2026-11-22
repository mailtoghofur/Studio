// Formulir pembuatan dan penjadwalan ulang reservasi untuk satu atau beberapa paket di hari dan waktu yang sama (FT-03 dan FT-04).

import {
  AlertCircle,
  CheckCircle2,
  Gift,
  Home,
  Lock,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
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
  validateMultiPackageBookingInput,
  validateOperatingHours,
} from '../lib/schedule';
import type {
  Booking,
  BookingPackageDraftItem,
  BookingPackageItemErrors,
  LocationType,
  MultiBookingValidationResult,
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
    bookings: Booking[];
    summaryLabel: string;
  }) => void;
}

interface PackageUiItem extends BookingPackageDraftItem {
  serviceSearch: string;
}

function createPackageItem(
  seed: number,
  overrides: Partial<PackageUiItem> = {}
): PackageUiItem {
  return {
    item_id: `pkg-${seed}-${Date.now().toString(36)}`,
    service_id: '',
    location_type: 'CLINIC',
    patient_address: '',
    therapist_id: '',
    is_loyalty_reward: false,
    serviceSearch: '',
    ...overrides,
  };
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
  const nextSeedRef = useRef(1);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [bookingDate, setBookingDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PackageUiItem[]>([]);
  const [sharedErrors, setSharedErrors] = useState<MultiBookingValidationResult['sharedErrors']>({});
  const [itemErrors, setItemErrors] = useState<Record<string, BookingPackageItemErrors>>({});

  const patientNameRef = useRef<HTMLInputElement>(null);
  const patientPhoneRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLSelectElement>(null);

  const standardServices = useMemo(() => getStandardRewardServices(services), [services]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.service_id, s])), [services]);
  const timeOptions = useMemo(() => generateTimeSlotOptions(), []);

  useEffect(() => {
    if (!isOpen) return;
    setSharedErrors({});
    setItemErrors({});
    nextSeedRef.current = 1;

    if (editingBooking) {
      setPatientName(editingBooking.patient_name);
      setPatientPhone(editingBooking.patient_phone);
      setBookingDate(editingBooking.booking_date);
      setStartTime(editingBooking.start_time);
      setNotes(editingBooking.notes);
      setItems([
        createPackageItem(nextSeedRef.current++, {
          service_id: editingBooking.service_id,
          location_type: editingBooking.location_type,
          patient_address: editingBooking.patient_address,
          therapist_id: editingBooking.therapist_id,
          is_loyalty_reward: Boolean(editingBooking.is_loyalty_reward),
          serviceSearch: '',
        }),
      ]);
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

      setPatientName(initialCustomer?.patientName ?? '');
      setPatientPhone(initialCustomer?.patientPhone ?? '');
      setBookingDate(initialDate);
      setStartTime(initialStartTime || '10:00');
      setNotes('');
      setItems([
        createPackageItem(nextSeedRef.current++, {
          service_id: preferredServiceId,
          location_type: 'CLINIC',
          patient_address: '',
          therapist_id: initialTherapistId || '',
          is_loyalty_reward: wantReward,
          serviceSearch: '',
        }),
      ]);
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
        patientPhone,
        bookings,
        services,
        editingBooking?.booking_id
      ),
    [patientPhone, bookings, services, editingBooking]
  );

  const totalAvailableRewards = Math.max(
    customerLoyalty?.available_rewards_count ?? 0,
    editingBooking?.is_loyalty_reward ? 1 : 0
  );

  useEffect(() => {
    if (totalAvailableRewards > 0) return;
    setItems((prev) => {
      if (!prev.some((it) => it.is_loyalty_reward)) return prev;
      return prev.map((it) => (it.is_loyalty_reward ? { ...it, is_loyalty_reward: false } : it));
    });
  }, [totalAvailableRewards]);

  const usedRewardsCount = useMemo(
    () => items.filter((it) => it.is_loyalty_reward).length,
    [items]
  );

  const totalEstimatedPrice = useMemo(
    () =>
      items.reduce((sum, it) => {
        if (it.is_loyalty_reward) return sum;
        const svc = serviceMap.get(it.service_id);
        return sum + (svc ? svc.price : 0);
      }, 0),
    [items, serviceMap]
  );

  if (!isOpen) return null;

  const updateItem = (itemId: string, updater: (prev: PackageUiItem) => PackageUiItem) => {
    setItems((prev) => prev.map((it) => (it.item_id === itemId ? updater(it) : it)));
  };

  const handleToggleItemReward = (itemId: string, checked: boolean) => {
    updateItem(itemId, (prev) => {
      let nextServiceId = prev.service_id;
      let nextLocation = prev.location_type;
      if (checked && !isStandardRewardService(prev.service_id, services)) {
        const currentSvc = serviceMap.get(prev.service_id);
        const preferredStd =
          currentSvc?.category === 'FACIAL'
            ? standardServices.FACIAL?.service_id
            : standardServices.PIJAT?.service_id;
        const fallbackId =
          preferredStd ??
          standardServices.PIJAT?.service_id ??
          standardServices.FACIAL?.service_id;
        if (fallbackId) {
          const nextSvc = serviceMap.get(fallbackId);
          nextServiceId = fallbackId;
          if (nextSvc?.category === 'FACIAL') {
            nextLocation = 'CLINIC';
          }
        }
      }
      return {
        ...prev,
        is_loyalty_reward: checked,
        service_id: nextServiceId,
        location_type: nextLocation,
      };
    });
  };

  const handleSearchChange = (itemId: string, nextQuery: string) => {
    updateItem(itemId, (prev) => {
      const baseServices = prev.is_loyalty_reward
        ? services.filter((s) => isStandardRewardService(s.service_id, services))
        : services;
      const filtered = filterServicesByQuery(baseServices, nextQuery);
      let nextServiceId = prev.service_id;
      let nextLocation = prev.location_type;
      if (filtered.length > 0 && !filtered.some((s) => s.service_id === prev.service_id)) {
        const firstMatch = filtered[0];
        nextServiceId = firstMatch.service_id;
        if (firstMatch.category === 'FACIAL') {
          nextLocation = 'CLINIC';
        }
      }
      return {
        ...prev,
        serviceSearch: nextQuery,
        service_id: nextServiceId,
        location_type: nextLocation,
      };
    });
  };

  const handleAddPackage = () => {
    const defaultSvc = services[0];
    setItems((prev) => [
      ...prev,
      createPackageItem(nextSeedRef.current++, {
        service_id: defaultSvc?.service_id ?? '',
        location_type: 'CLINIC',
        patient_address: '',
        therapist_id: '',
        is_loyalty_reward: false,
        serviceSearch: '',
      }),
    ]);
  };

  const handleRemovePackage = (itemId: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.item_id !== itemId)));
    setItemErrors((prev) => {
      if (!prev[itemId]) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const focusFirstError = (
    nextSharedErrors: MultiBookingValidationResult['sharedErrors'],
    nextItemErrors: Record<string, BookingPackageItemErrors>,
    currentItems: PackageUiItem[]
  ) => {
    if (nextSharedErrors.patient_name) {
      patientNameRef.current?.focus();
      return;
    }
    if (nextSharedErrors.patient_phone) {
      patientPhoneRef.current?.focus();
      return;
    }
    if (nextSharedErrors.booking_date) {
      dateRef.current?.focus();
      return;
    }

    for (const item of currentItems) {
      const err = nextItemErrors[item.item_id];
      if (!err) continue;
      if (err.service_id) {
        document.getElementById(`service_id_${item.item_id}`)?.focus();
        return;
      }
      if (err.patient_address) {
        document.getElementById(`patient_address_${item.item_id}`)?.focus();
        return;
      }
      if (err.start_time) {
        startTimeRef.current?.focus();
        return;
      }
      if (err.is_loyalty_reward) {
        document.getElementById(`loyalty_${item.item_id}`)?.focus();
        return;
      }
      if (err.therapist_id) {
        const firstRadio = document
          .getElementById(`therapist_section_${item.item_id}`)
          ?.querySelector<HTMLInputElement>('input[type="radio"]');
        firstRadio?.focus();
        return;
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateMultiPackageBookingInput(
      {
        patient_name: patientName,
        patient_phone: patientPhone,
        booking_date: bookingDate,
        start_time: startTime,
        notes,
        items: items.map((it) => {
          const svc = serviceMap.get(it.service_id);
          return {
            item_id: it.item_id,
            service_id: it.service_id,
            location_type: getEffectiveLocationType(svc, it.location_type),
            patient_address: it.patient_address,
            therapist_id: it.therapist_id,
            is_loyalty_reward: it.is_loyalty_reward,
          };
        }),
      },
      {
        services,
        therapists,
        bookings,
        excludeBookingId: editingBooking?.booking_id,
        allowExistingRewardEdit: Boolean(editingBooking?.is_loyalty_reward),
      }
    );

    if (!validation.valid || !validation.normalizedPhone) {
      setSharedErrors(validation.sharedErrors);
      setItemErrors(validation.itemErrors);
      focusFirstError(validation.sharedErrors, validation.itemErrors, items);
      return;
    }

    const nowIso = new Date().toISOString();
    const baseToken = Date.now().toString(36).toUpperCase();
    const isMultiOrder = !editingBooking && validation.resolvedItems.length > 1;
    const orderGroupId = editingBooking
      ? editingBooking.order_group_id
      : isMultiOrder
        ? `GRP-${baseToken}-${Math.floor(100 + Math.random() * 900)}`
        : undefined;

    const nextBookings: Booking[] = validation.resolvedItems.map((resolved, idx) => {
      const bookingId =
        editingBooking && idx === 0
          ? editingBooking.booking_id
          : `RSV-${baseToken}-${idx + 1}-${Math.floor(100 + Math.random() * 900)}`;

      return {
        booking_id: bookingId,
        patient_name: patientName.trim(),
        patient_phone: validation.normalizedPhone!,
        service_id: resolved.service.service_id,
        therapist_id: resolved.therapist_id,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: resolved.endTime,
        location_type: resolved.effectiveLocationType,
        patient_address: resolved.patient_address,
        notes: notes.trim(),
        status: editingBooking ? editingBooking.status : 'SCHEDULED',
        is_loyalty_reward: resolved.is_loyalty_reward,
        final_price: resolved.final_price,
        order_group_id: orderGroupId,
        created_at: editingBooking?.created_at ?? nowIso,
        updated_at: nowIso,
      };
    });

    const summaryLabel = validation.resolvedItems
      .map((r) => r.service.service_name)
      .join(', ');

    setSharedErrors({});
    setItemErrors({});
    onRequestSave({
      mode: editingBooking ? 'reschedule' : 'create',
      bookings: nextBookings,
      summaryLabel,
    });
  };

  const firstPackageAddress = items[0]?.patient_address.trim() ?? '';

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
              Pelanggan bisa memesan beberapa paket di waktu sama, dengan terapis sama atau berbeda.
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
          {/* Data Pasien Bersama */}
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
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {sharedErrors.patient_name && (
                <p className="mt-1.5 text-sm text-red-700">{sharedErrors.patient_name}</p>
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
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {sharedErrors.patient_phone ? (
                <p className="mt-1.5 text-sm text-red-700">{sharedErrors.patient_phone}</p>
              ) : (
                <p className="mt-1 text-sm text-neutral-600">Terima format 08xxx, +62xxx, atau 62xxx.</p>
              )}
            </div>
          </div>

          {/* Status Kesetiaan Pelanggan (FT-09) */}
          {(customerLoyalty || editingBooking?.is_loyalty_reward) && (
            <div
              className={`rounded-xl border p-3.5 text-sm ${
                totalAvailableRewards > 0
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

              {totalAvailableRewards > 0 ? (
                <p className="mt-1.5 text-xs text-emerald-900 tabular-nums">
                  Pelanggan memiliki {totalAvailableRewards}x hak gratis paket standar (terpakai{' '}
                  {usedRewardsCount}x pada formulir ini). Centang hadiah di tiap paket di bawah.
                </p>
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

          {/* Tanggal & Jam Mulai Bersama */}
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
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {sharedErrors.booking_date ? (
                <p className="mt-1.5 text-sm text-red-700">{sharedErrors.booking_date}</p>
              ) : (
                <p className="mt-1 text-sm text-neutral-600">{formatDateIndo(bookingDate)}</p>
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
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {formatTimeDisplay(t)} WIB
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-neutral-600">
                Semua paket dimulai serentak pada jam ini.
              </p>
            </div>
          </div>

          {/* Daftar Paket yang Dipesan */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-neutral-900">
                Daftar Paket Layanan ({items.length})
              </h3>
              {!editingBooking && (
                <button
                  type="button"
                  onClick={handleAddPackage}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-700 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Paket Lain</span>
                </button>
              )}
            </div>

            {items.map((item, idx) => {
              const err = itemErrors[item.item_id] ?? {};
              const otherRewardsUsed = items.filter(
                (other, j) => j !== idx && other.is_loyalty_reward
              ).length;
              const remainingRewardsForItem = Math.max(0, totalAvailableRewards - otherRewardsUsed);
              const isRewardChecked = Boolean(item.is_loyalty_reward);
              const canCheckReward = isRewardChecked || remainingRewardsForItem > 0;

              const baseServicesForDropdown = isRewardChecked
                ? services.filter((s) => isStandardRewardService(s.service_id, services))
                : services;
              const availableServicesForDropdown = filterServicesByQuery(
                baseServicesForDropdown,
                item.serviceSearch
              );
              const massageServices = availableServicesForDropdown.filter(
                (s) => s.category === 'PIJAT'
              );
              const facialServices = availableServicesForDropdown.filter(
                (s) => s.category === 'FACIAL'
              );

              const selectedService = serviceMap.get(item.service_id);
              const isFacial = selectedService?.category === 'FACIAL';
              const effectiveLocation: LocationType = getEffectiveLocationType(
                selectedService,
                item.location_type
              );
              const hoursCheck = validateOperatingHours(
                startTime,
                selectedService?.duration_minutes ?? 60
              );

              const availabilities = getTherapistAvailabilities({
                therapists,
                bookings,
                bookingDate,
                startTime,
                durationMinutes: selectedService?.duration_minutes ?? 60,
                excludeBookingId: editingBooking?.booking_id,
                customerPhone: patientPhone,
              });
              const anyTherapistAvailable = availabilities.some((a) => a.available);

              return (
                <div
                  key={item.item_id}
                  className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                    <div>
                      <span className="text-sm font-semibold text-neutral-900">
                        Paket {idx + 1}
                      </span>
                      {selectedService && (
                        <span className="ml-2 text-sm font-medium text-amber-800 tabular-nums">
                          {isRewardChecked ? 'Rp0 (Gratis)' : formatRupiah(selectedService.price)}
                        </span>
                      )}
                    </div>
                    {!editingBooking && items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePackage(item.item_id)}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>

                  {/* Opsi Hadiah Kesetiaan per Paket */}
                  {totalAvailableRewards > 0 && (
                    <div>
                      <label
                        className={`flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-medium ${
                          canCheckReward
                            ? 'cursor-pointer border-emerald-200 bg-white text-neutral-900'
                            : 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        <input
                          id={`loyalty_${item.item_id}`}
                          type="checkbox"
                          checked={isRewardChecked}
                          disabled={!canCheckReward}
                          onChange={(e) =>
                            handleToggleItemReward(item.item_id, e.target.checked)
                          }
                          className="h-4 w-4 accent-amber-700"
                        />
                        <span>Gunakan Hadiah Gratis Paket Standar (Rp0)</span>
                      </label>
                      {!canCheckReward && (
                        <p className="mt-1 text-xs text-neutral-600">
                          Hak hadiah gratis sudah dipakai pada paket lain.
                        </p>
                      )}
                      {err.is_loyalty_reward && (
                        <p className="mt-1 text-sm text-red-700">{err.is_loyalty_reward}</p>
                      )}
                    </div>
                  )}

                  {/* Cari & Pilih Layanan */}
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor={`service_search_${item.item_id}`}
                        className="block text-sm font-medium text-neutral-800"
                      >
                        Cari Layanan
                      </label>
                      <div className="relative mt-1.5 flex items-center">
                        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-500" />
                        <input
                          id={`service_search_${item.item_id}`}
                          type="search"
                          value={item.serviceSearch}
                          onChange={(e) => handleSearchChange(item.item_id, e.target.value)}
                          placeholder="Ketik nama paket, Pijat, Facial, atau durasi…"
                          className="min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white pr-10 pl-9 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                        />
                        {item.serviceSearch && (
                          <button
                            type="button"
                            onClick={() => handleSearchChange(item.item_id, '')}
                            aria-label="Hapus pencarian layanan"
                            className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-amber-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {item.serviceSearch.trim() && (
                        <p className="mt-1 text-xs text-neutral-600 tabular-nums">
                          {availableServicesForDropdown.length > 0
                            ? `Menampilkan ${availableServicesForDropdown.length} dari ${baseServicesForDropdown.length} layanan.`
                            : 'Tidak ada layanan yang cocok dengan kata kunci tersebut.'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor={`service_id_${item.item_id}`}
                        className="block text-sm font-medium text-neutral-800"
                      >
                        {isRewardChecked ? 'Paket Standar Gratis' : 'Paket Layanan'}{' '}
                        <span className="text-red-700">*</span>
                      </label>
                      <select
                        id={`service_id_${item.item_id}`}
                        value={item.service_id}
                        onChange={(e) => {
                          const nextSvc = serviceMap.get(e.target.value);
                          updateItem(item.item_id, (prev) => ({
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
                            {item.serviceSearch.trim()
                              ? 'Tidak ada layanan cocok'
                              : 'Belum ada layanan'}
                          </option>
                        )}
                        {massageServices.length > 0 && (
                          <optgroup label={CATEGORY_LABELS.PIJAT}>
                            {massageServices.map((s) => (
                              <option key={s.service_id} value={s.service_id}>
                                {s.service_name} ({s.duration_minutes} menit ·{' '}
                                {isRewardChecked ? 'Rp0 Gratis' : formatRupiah(s.price)})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {facialServices.length > 0 && (
                          <optgroup label={CATEGORY_LABELS.FACIAL}>
                            {facialServices.map((s) => (
                              <option key={s.service_id} value={s.service_id}>
                                {s.service_name} ({s.duration_minutes} menit ·{' '}
                                {isRewardChecked ? 'Rp0 Gratis' : formatRupiah(s.price)})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {hoursCheck.endTime && (
                        <p
                          className={`mt-1 text-sm tabular-nums ${
                            hoursCheck.valid ? 'text-neutral-700' : 'font-medium text-red-700'
                          }`}
                        >
                          Perkiraan selesai pukul {formatTimeDisplay(hoursCheck.endTime)} WIB
                          {!hoursCheck.valid && ' (melewati 21.00)'}
                        </p>
                      )}
                      {err.service_id && (
                        <p className="mt-1 text-sm text-red-700">{err.service_id}</p>
                      )}
                      {err.start_time && (
                        <p className="mt-1 text-sm text-red-700">{err.start_time}</p>
                      )}
                    </div>
                  </div>

                  {/* Lokasi Layanan Paket */}
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
                          name={`location_type_${item.item_id}`}
                          value="CLINIC"
                          checked={effectiveLocation === 'CLINIC'}
                          onChange={() =>
                            updateItem(item.item_id, (prev) => ({
                              ...prev,
                              location_type: 'CLINIC',
                            }))
                          }
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
                          name={`location_type_${item.item_id}`}
                          value="HOME_SERVICE"
                          disabled={isFacial}
                          checked={effectiveLocation === 'HOME_SERVICE'}
                          onChange={() =>
                            updateItem(item.item_id, (prev) => ({
                              ...prev,
                              location_type: 'HOME_SERVICE',
                            }))
                          }
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor={`patient_address_${item.item_id}`}
                          className="block text-sm font-medium text-neutral-800"
                        >
                          Alamat Lengkap Pasien <span className="text-red-700">*</span>
                        </label>
                        {idx > 0 && firstPackageAddress && (
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(item.item_id, (prev) => ({
                                ...prev,
                                patient_address: firstPackageAddress,
                              }))
                            }
                            className="text-xs font-semibold text-amber-800 underline hover:text-amber-900"
                          >
                            Samakan alamat Paket 1
                          </button>
                        )}
                      </div>
                      <textarea
                        id={`patient_address_${item.item_id}`}
                        rows={2}
                        value={item.patient_address}
                        onChange={(e) =>
                          updateItem(item.item_id, (prev) => ({
                            ...prev,
                            patient_address: e.target.value,
                          }))
                        }
                        placeholder="Contoh: Jl. Melati No. 12, Kebayoran Baru, Jakarta Selatan"
                        className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                      />
                      {err.patient_address && (
                        <p className="mt-1.5 text-sm text-red-700">{err.patient_address}</p>
                      )}
                    </div>
                  )}

                  {/* Pemilihan Terapis Paket */}
                  <div id={`therapist_section_${item.item_id}`}>
                    <span className="block text-sm font-medium text-neutral-800">
                      Pilih Terapis Paket {idx + 1} <span className="text-red-700">*</span>
                    </span>
                    <div className="mt-2 space-y-2">
                      {availabilities.map((av) => {
                        const isSelected = item.therapist_id === av.therapist.therapist_id;
                        const sharedWithPackageNums = items
                          .map((other, j) =>
                            j !== idx && other.therapist_id === av.therapist.therapist_id
                              ? j + 1
                              : null
                          )
                          .filter((num): num is number => num !== null);

                        return (
                          <label
                            key={av.therapist.therapist_id}
                            className={`flex min-h-[48px] items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                              !av.available
                                ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-500'
                                : isSelected
                                  ? 'cursor-pointer border-amber-700 bg-amber-50 text-neutral-900'
                                  : 'cursor-pointer border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name={`therapist_id_${item.item_id}`}
                                value={av.therapist.therapist_id}
                                checked={isSelected}
                                disabled={!av.available}
                                onChange={() =>
                                  updateItem(item.item_id, (prev) => ({
                                    ...prev,
                                    therapist_id: av.therapist.therapist_id,
                                  }))
                                }
                                className="h-4 w-4 accent-amber-700"
                              />
                              <span className="text-sm font-semibold">{av.therapist.name}</span>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1.5 text-sm font-medium tabular-nums ${
                                av.available ? 'text-emerald-800' : 'text-red-700'
                              }`}
                            >
                              {av.available ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>
                                    {sharedWithPackageNums.length > 0
                                      ? `Tersedia (sama dengan Paket ${sharedWithPackageNums.join(', ')})`
                                      : 'Tersedia'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-4 w-4" />
                                  <span>{av.reason ?? 'Tidak Tersedia'}</span>
                                </>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {!anyTherapistAvailable && (
                      <p className="mt-2 text-sm font-medium text-red-700">
                        Semua terapis aktif sudah terisi oleh pelanggan lain pada jam tersebut. Pilih jam lain.
                      </p>
                    )}
                    {err.therapist_id && (
                      <p className="mt-1.5 text-sm text-red-700">{err.therapist_id}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Catatan opsional bersama */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-neutral-800">
              Catatan (Opsional)
            </label>
            <input
              id="notes"
              name="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Fokus area punggung, datang bersama keluarga"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            />
          </div>

          {/* Ringkasan Total Paket dan Biaya */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
            <span className="font-medium text-neutral-700 tabular-nums">
              Total Pesanan ({items.length} paket)
            </span>
            <span className="text-base font-bold text-neutral-900 tabular-nums">
              {formatRupiah(totalEstimatedPrice)}
            </span>
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
              {editingBooking
                ? 'Simpan Jadwal Baru'
                : items.length > 1
                  ? `Simpan ${items.length} Paket`
                  : 'Simpan Reservasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
