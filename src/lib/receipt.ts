// Pembentuk data, file PDF, dan perintah cetak sistem/termal untuk resi pemesanan reservasi selesai (FT-05).

import { jsPDF } from 'jspdf';
import {
  CATEGORY_LABELS,
  CLINIC_NAME,
  LOCATION_LABELS,
  STATUS_LABELS,
} from '../config';
import {
  formatDateIndo,
  formatPhoneDisplay,
  formatRupiah,
  formatTimeRange,
  formatWeekdayDateIndo,
  normalizeIndoPhone,
  parseDateParts,
} from './format';
import { findCustomerLoyaltyByPhone, isStandardRewardService } from './loyalty';
import { getEffectiveLocationType, isValidTimeFormat, validateOperatingHours } from './schedule';
import type { Booking, LocationType, Service, Therapist } from './types';

interface SerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  writable: WritableStream<Uint8Array> | null;
}

interface SerialApiLike {
  requestPort: () => Promise<SerialPortLike>;
}

export interface ReceiptData {
  receiptNumber: string;
  bookingId: string;
  clinicName: string;
  printedAtLabel: string;
  statusLabel: string;
  patientName: string;
  patientPhone: string;
  serviceName: string;
  categoryLabel: string;
  durationLabel: string;
  scheduleDateLabel: string;
  scheduleTimeLabel: string;
  therapistName: string;
  locationLabel: string;
  patientAddress?: string;
  notes?: string;
  isLoyaltyReward: boolean;
  priceAmount: number;
  formattedTotal: string;
  isRevised: boolean;
  revisedAtLabel?: string;
  revisionReason?: string;
}

export function canPrintReceipt(booking: Booking | null | undefined): boolean {
  return Boolean(booking && booking.status === 'COMPLETED');
}

export function isSystemPrintSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.print === 'function';
}

export function isDirectThermalPrinterSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function formatReceiptPrintedAt(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatDateIndo(`${y}-${m}-${d}`)}, ${hh}.${mm} WIB`;
}

export function buildReceiptData(params: {
  booking: Booking;
  service?: Service;
  therapist?: Therapist;
  printedAt?: Date;
}): ReceiptData {
  const { booking, service, therapist, printedAt = new Date() } = params;
  const isLoyaltyReward = Boolean(booking.is_loyalty_reward);
  const priceAmount = isLoyaltyReward
    ? 0
    : typeof booking.final_price === 'number'
      ? Math.max(0, Math.round(booking.final_price))
      : service
        ? Math.max(0, Math.round(service.price))
        : 0;

  const parsedRevised = booking.receipt_revised_at ? new Date(booking.receipt_revised_at) : null;
  const revisedAtLabel =
    parsedRevised && !Number.isNaN(parsedRevised.getTime())
      ? formatReceiptPrintedAt(parsedRevised)
      : undefined;

  return {
    receiptNumber: `RESI-${booking.booking_id}`,
    bookingId: booking.booking_id,
    clinicName: CLINIC_NAME,
    printedAtLabel: formatReceiptPrintedAt(printedAt),
    statusLabel: STATUS_LABELS[booking.status],
    patientName: booking.patient_name,
    patientPhone: formatPhoneDisplay(booking.patient_phone),
    serviceName: service?.service_name ?? booking.service_id,
    categoryLabel: service ? CATEGORY_LABELS[service.category] : '-',
    durationLabel: service ? `${service.duration_minutes} menit` : '-',
    scheduleDateLabel: formatWeekdayDateIndo(booking.booking_date),
    scheduleTimeLabel: `${formatTimeRange(booking.start_time, booking.end_time)} WIB`,
    therapistName: therapist?.name ?? booking.therapist_id,
    locationLabel: LOCATION_LABELS[booking.location_type],
    patientAddress:
      booking.location_type === 'HOME_SERVICE' && booking.patient_address
        ? booking.patient_address
        : undefined,
    notes: booking.notes ? booking.notes : undefined,
    isLoyaltyReward,
    priceAmount,
    formattedTotal: isLoyaltyReward ? 'Rp0 (Gratis Kesetiaan)' : formatRupiah(priceAmount),
    isRevised: Boolean(booking.receipt_revised_at),
    revisedAtLabel,
    revisionReason: booking.receipt_revision_reason || undefined,
  };
}

export function buildReceiptPdf(receipt: ReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const labelWidth = 36;
  const valueStartX = marginX + labelWidth + 4;
  const valueMaxWidth = pageWidth - marginX - valueStartX;
  let y = 18;

  // Header Klinik
  doc.setTextColor(23, 23, 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(receipt.clinicName, pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(82, 82, 82);
  doc.text('Resi Pemesanan Layanan', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setDrawColor(212, 212, 212);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  const drawRow = (label: string, value: string, boldValue = false) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(82, 82, 82);
    doc.text(label, marginX, y);

    doc.setFont('helvetica', boldValue ? 'bold' : 'normal');
    doc.setTextColor(23, 23, 23);
    const wrapped = doc.splitTextToSize(value, valueMaxWidth) as string[];
    doc.text(wrapped, pageWidth - marginX, y, { align: 'right' });
    y += Math.max(1, wrapped.length) * 5 + 1.5;
  };

  drawRow('No. Resi', receipt.receiptNumber, true);
  drawRow('Waktu Cetak', receipt.printedAtLabel);
  drawRow('Status', receipt.isRevised ? `${receipt.statusLabel} (Diperbaiki)` : receipt.statusLabel, true);
  if (receipt.revisedAtLabel) {
    drawRow('Diperbaiki', receipt.revisedAtLabel);
  }

  y += 1.5;
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  drawRow('Pasien', receipt.patientName, true);
  drawRow('Nomor HP', receipt.patientPhone);
  drawRow(
    'Layanan',
    `${receipt.serviceName} (${receipt.categoryLabel}, ${receipt.durationLabel})`
  );
  drawRow('Tanggal', receipt.scheduleDateLabel);
  drawRow('Jam Sesi', receipt.scheduleTimeLabel);
  drawRow('Terapis', receipt.therapistName);
  drawRow('Lokasi', receipt.locationLabel);

  if (receipt.patientAddress) {
    drawRow('Alamat', receipt.patientAddress);
  }
  if (receipt.notes) {
    drawRow('Catatan', receipt.notes);
  }
  if (receipt.revisionReason) {
    drawRow('Ket. Revisi', receipt.revisionReason);
  }

  y += 2;
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(23, 23, 23);
  doc.text('Total Bayar', marginX, y);
  doc.setFontSize(14);
  doc.text(receipt.formattedTotal, pageWidth - marginX, y, { align: 'right' });

  y += 7;
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(82, 82, 82);
  doc.text(
    `Terima kasih telah menggunakan layanan ${receipt.clinicName}.`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  return doc;
}

export function downloadReceiptPdf(receipt: ReceiptData): void {
  const doc = buildReceiptPdf(receipt);
  const safeId = receipt.bookingId.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`resi-${safeId}.pdf`);
}

function formatEscPosLine(left: string, right: string, width = 32): string {
  const cleanLeft = left.replace(/[^\x20-\x7E]/g, ' ').trim();
  const cleanRight = right.replace(/[^\x20-\x7E]/g, ' ').trim();
  const spaces = Math.max(1, width - cleanLeft.length - cleanRight.length);
  if (cleanLeft.length + 1 + cleanRight.length > width) {
    return `${cleanLeft}\n${' '.repeat(Math.max(0, width - cleanRight.length))}${cleanRight}`;
  }
  return `${cleanLeft}${' '.repeat(spaces)}${cleanRight}`;
}

export function buildEscPosReceiptBytes(receipt: ReceiptData): Uint8Array {
  const divider = '-'.repeat(32);
  const encoder = new TextEncoder();

  const textLines = [
    receipt.clinicName.toUpperCase(),
    'RESI PEMESANAN LAYANAN',
    divider,
    formatEscPosLine('No. Resi', receipt.receiptNumber),
    formatEscPosLine('Cetak', receipt.printedAtLabel),
    formatEscPosLine('Status', receipt.isRevised ? `${receipt.statusLabel} (Revisi)` : receipt.statusLabel),
    divider,
    formatEscPosLine('Pasien', receipt.patientName),
    formatEscPosLine('HP', receipt.patientPhone),
    `Layanan: ${receipt.serviceName}`,
    formatEscPosLine('Durasi', receipt.durationLabel),
    formatEscPosLine('Tanggal', receipt.scheduleDateLabel),
    formatEscPosLine('Jam', receipt.scheduleTimeLabel),
    formatEscPosLine('Terapis', receipt.therapistName),
    formatEscPosLine('Lokasi', receipt.locationLabel),
  ];

  if (receipt.patientAddress) {
    textLines.push(`Alamat: ${receipt.patientAddress}`);
  }
  if (receipt.notes) {
    textLines.push(`Catatan: ${receipt.notes}`);
  }
  if (receipt.revisionReason) {
    textLines.push(`Revisi: ${receipt.revisionReason}`);
  }

  textLines.push(
    divider,
    formatEscPosLine('TOTAL BAYAR', receipt.formattedTotal),
    divider,
    'Terima kasih atas kunjungan Anda.',
    '\n\n\n'
  );

  const initCmd = new Uint8Array([0x1b, 0x40]); // ESC @
  const bodyBytes = encoder.encode(`${textLines.join('\n')}\n`);
  const cutCmd = new Uint8Array([0x1d, 0x56, 0x00]); // GS V 0

  const result = new Uint8Array(initCmd.length + bodyBytes.length + cutCmd.length);
  result.set(initCmd, 0);
  result.set(bodyBytes, initCmd.length);
  result.set(cutCmd, initCmd.length + bodyBytes.length);
  return result;
}

export async function printToThermalSerialPrinter(receipt: ReceiptData): Promise<void> {
  const nav = navigator as unknown as { serial?: SerialApiLike };
  if (!nav.serial) {
    throw new Error('Browser ini tidak mendukung koneksi langsung ke printer termal.');
  }

  const port = await nav.serial.requestPort();
  await port.open({ baudRate: 9600 });

  if (!port.writable) {
    await port.close();
    throw new Error('Port printer tidak dapat menerima data cetak.');
  }

  const writer = port.writable.getWriter();
  try {
    await writer.write(buildEscPosReceiptBytes(receipt));
  } finally {
    writer.releaseLock();
    await port.close();
  }
}

export interface ReceiptCorrectionInput {
  patient_name: string;
  patient_phone: string;
  service_id: string;
  therapist_id: string;
  booking_date: string;
  start_time: string;
  location_type: LocationType;
  patient_address: string;
  is_loyalty_reward: boolean;
  final_price: string;
  notes: string;
  revision_reason: string;
}

export type ReceiptCorrectionFieldName = keyof ReceiptCorrectionInput;

export type ReceiptCorrectionErrors = Partial<Record<ReceiptCorrectionFieldName, string>>;

export interface ReceiptCorrectionResult {
  valid: boolean;
  errors: ReceiptCorrectionErrors;
  updatedBooking?: Booking;
}

export function validateAndApplyReceiptCorrection(params: {
  booking: Booking;
  input: ReceiptCorrectionInput;
  services: Service[];
  therapists: Therapist[];
  allBookings: Booking[];
  nowIso?: string;
}): ReceiptCorrectionResult {
  const { booking, input, services, therapists, allBookings, nowIso = new Date().toISOString() } =
    params;

  const errors: ReceiptCorrectionErrors = {};

  if (!canPrintReceipt(booking)) {
    errors.revision_reason = 'Perbaikan resi hanya berlaku untuk reservasi berstatus Selesai.';
    return { valid: false, errors };
  }

  const trimmedName = input.patient_name.trim();
  if (!trimmedName) {
    errors.patient_name = 'Isi nama pasien terlebih dahulu, contoh: Budi Santoso.';
  }

  const normalizedPhone = normalizeIndoPhone(input.patient_phone);
  if (!normalizedPhone) {
    errors.patient_phone =
      'Masukkan nomor WhatsApp/HP Indonesia yang valid, contoh: 081234567890 atau +6281234567890.';
  }

  const selectedService = services.find((s) => s.service_id === input.service_id);
  if (!selectedService) {
    errors.service_id = 'Pilih salah satu paket layanan Pijat atau Facial.';
  }

  const selectedTherapist = therapists.find((t) => t.therapist_id === input.therapist_id);
  if (!selectedTherapist) {
    errors.therapist_id = 'Pilih terapis yang menangani reservasi ini.';
  }

  if (!parseDateParts(input.booking_date)) {
    errors.booking_date = 'Pilih tanggal layanan yang valid, contoh: 2026-11-20.';
  }

  let computedEndTime = booking.end_time;
  if (selectedService) {
    const hoursCheck = validateOperatingHours(input.start_time, selectedService.duration_minutes);
    if (!hoursCheck.valid && hoursCheck.error) {
      errors.start_time = hoursCheck.error;
    } else {
      computedEndTime = hoursCheck.endTime;
    }
  } else if (!isValidTimeFormat(input.start_time)) {
    errors.start_time = 'Pilih jam mulai layanan antara 10.00 sampai 20.30.';
  }

  const effectiveLocationType = getEffectiveLocationType(selectedService, input.location_type);
  const trimmedAddress = input.patient_address.trim();
  if (
    selectedService &&
    selectedService.category === 'PIJAT' &&
    effectiveLocationType === 'HOME_SERVICE' &&
    !trimmedAddress
  ) {
    errors.patient_address =
      'Alamat lengkap pasien wajib diisi untuk layanan Pijat di tempat pasien, contoh: Jl. Melati No. 12, Jakarta Selatan.';
  }

  if (input.is_loyalty_reward) {
    if (!selectedService || !isStandardRewardService(selectedService.service_id, services)) {
      errors.service_id =
        'Hadiah gratis kesetiaan hanya berlaku untuk paket standar Pijat atau Facial.';
    } else if (normalizedPhone) {
      const loyalty = findCustomerLoyaltyByPhone(
        normalizedPhone,
        allBookings,
        services,
        booking.booking_id
      );
      if (!loyalty || loyalty.available_rewards_count <= 0) {
        errors.is_loyalty_reward =
          'Pelanggan ini belum memiliki hak hadiah gratis yang tersedia untuk ditukarkan.';
      }
    }
  }

  let resolvedFinalPrice = 0;
  if (!input.is_loyalty_reward) {
    const cleanPriceText = input.final_price.trim();
    if (!/^\d+$/.test(cleanPriceText)) {
      errors.final_price =
        'Masukkan nominal total bayar berupa angka bulat tanpa titik/koma, contoh: 150000.';
    } else {
      const parsed = Number(cleanPriceText);
      if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 100_000_000) {
        errors.final_price =
          'Nominal total bayar harus antara Rp0 sampai Rp100.000.000, contoh: 150000.';
      } else {
        resolvedFinalPrice = parsed;
      }
    }
  }

  if (Object.keys(errors).length > 0 || !normalizedPhone || !selectedService) {
    return { valid: false, errors };
  }

  const updatedBooking: Booking = {
    ...booking,
    patient_name: trimmedName,
    patient_phone: normalizedPhone,
    service_id: selectedService.service_id,
    therapist_id: input.therapist_id,
    booking_date: input.booking_date,
    start_time: input.start_time,
    end_time: computedEndTime,
    location_type: effectiveLocationType,
    patient_address: effectiveLocationType === 'HOME_SERVICE' ? trimmedAddress : '',
    is_loyalty_reward: input.is_loyalty_reward,
    final_price: resolvedFinalPrice,
    notes: input.notes.trim(),
    receipt_revised_at: nowIso,
    receipt_revision_reason: input.revision_reason.trim() || undefined,
    updated_at: nowIso,
  };

  return {
    valid: true,
    errors: {},
    updatedBooking,
  };
}
