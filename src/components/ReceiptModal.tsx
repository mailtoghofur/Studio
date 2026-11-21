// Pratinjau resi pemesanan dengan unduh PDF serta cetak lewat sistem printer atau printer termal (FT-05).

import { CheckCircle2, Download, FilePenLine, Printer, Usb, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CLINIC_LOGO_SRC } from '../config';
import {
  buildReceiptData,
  canPrintReceipt,
  downloadReceiptPdf,
  isDirectThermalPrinterSupported,
  isSystemPrintSupported,
  printToThermalSerialPrinter,
} from '../lib/receipt';
import type { Booking, Service, Therapist } from '../lib/types';

interface ReceiptModalProps {
  booking: Booking | null;
  service?: Service;
  therapist?: Therapist;
  onClose: () => void;
  onEditReceipt?: (booking: Booking) => void;
}

export function ReceiptModal({
  booking,
  service,
  therapist,
  onClose,
  onEditReceipt,
}: ReceiptModalProps) {
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrintingThermal, setIsPrintingThermal] = useState(false);

  useEffect(() => {
    setPrintError(null);
  }, [booking]);

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

  const receipt = useMemo(() => {
    if (!booking || !canPrintReceipt(booking)) return null;
    return buildReceiptData({ booking, service, therapist });
  }, [booking, service, therapist]);

  if (!receipt) return null;

  const canDirectThermal = isDirectThermalPrinterSupported();

  const handleSystemPrint = () => {
    setPrintError(null);
    if (!isSystemPrintSupported()) {
      setPrintError(
        'Dialog cetak sistem tidak tersedia di perangkat ini. Gunakan tombol Unduh PDF.'
      );
      return;
    }
    try {
      window.print();
    } catch {
      setPrintError(
        'Gagal membuka sistem printer browser. Gunakan tombol Unduh PDF untuk mencetak manual.'
      );
    }
  };

  const handleThermalPrint = async () => {
    setPrintError(null);
    setIsPrintingThermal(true);
    try {
      await printToThermalSerialPrinter(receipt);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        return;
      }
      setPrintError(
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke printer termal. Periksa kabel atau izin perangkat.'
      );
    } finally {
      setIsPrintingThermal(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 print:static print:block print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)] print:mx-auto print:max-h-none print:max-w-[380px] print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        {/* Bilah atas pratinjau (disembunyikan saat cetak) */}
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-6 py-4 print:hidden">
          <h2 id="receipt-modal-title" className="text-lg font-semibold text-neutral-900">
            Resi Pemesanan
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau resi"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lembar Resi Cetak */}
        <article
          id="receipt-print-sheet"
          className="p-6 text-neutral-900 print:p-2"
        >
          <div className="flex flex-col items-center border-b border-dashed border-neutral-300 pb-4 text-center">
            <img
              src={CLINIC_LOGO_SRC}
              alt={`Logo ${receipt.clinicName}`}
              className="h-12 w-12 rounded-full border border-neutral-200 object-cover"
            />
            <p className="mt-2 text-base font-bold text-neutral-900">
              {receipt.clinicName}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-700">
              Resi Pemesanan Layanan
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 print:border print:border-neutral-300 print:bg-white print:text-neutral-900">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Status: {receipt.statusLabel}</span>
            </div>
          </div>

          <dl className="mt-4 space-y-2 border-b border-dashed border-neutral-300 pb-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-neutral-600">No. Resi</dt>
              <dd className="text-right font-semibold text-neutral-900 tabular-nums">
                {receipt.receiptNumber}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-neutral-600">Waktu Cetak</dt>
              <dd className="text-right text-neutral-900 tabular-nums">
                {receipt.printedAtLabel}
              </dd>
            </div>
            {receipt.isRevised && (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-neutral-600">Diperbaiki</dt>
                <dd className="text-right font-medium text-amber-800 tabular-nums">
                  {receipt.revisedAtLabel ?? 'Ya'}
                </dd>
              </div>
            )}
          </dl>

          <dl className="mt-4 space-y-2.5 border-b border-dashed border-neutral-300 pb-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-neutral-600">Pasien</dt>
              <dd className="text-right font-semibold text-neutral-900">
                {receipt.patientName}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-neutral-600">Nomor HP</dt>
              <dd className="text-right text-neutral-900 tabular-nums">
                {receipt.patientPhone}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-neutral-600">Layanan</dt>
              <dd className="text-right font-medium text-neutral-900">
                <span>{receipt.serviceName}</span>
                <span className="block text-xs text-neutral-600">
                  {receipt.categoryLabel} · {receipt.durationLabel}
                </span>
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-neutral-600">Tanggal</dt>
              <dd className="text-right text-neutral-900">
                {receipt.scheduleDateLabel}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-neutral-600">Jam Sesi</dt>
              <dd className="text-right text-neutral-900 tabular-nums">
                {receipt.scheduleTimeLabel}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-neutral-600">Terapis</dt>
              <dd className="text-right font-medium text-neutral-900">
                {receipt.therapistName}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-neutral-600">Lokasi</dt>
              <dd className="max-w-[210px] text-right text-neutral-900">
                <span>{receipt.locationLabel}</span>
                {receipt.patientAddress && (
                  <span className="mt-0.5 block text-xs text-neutral-600">
                    {receipt.patientAddress}
                  </span>
                )}
              </dd>
            </div>
            {receipt.notes && (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-neutral-600">Catatan</dt>
                <dd className="max-w-[210px] text-right text-neutral-900">
                  {receipt.notes}
                </dd>
              </div>
            )}
            {receipt.revisionReason && (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-neutral-600">Ket. Revisi</dt>
                <dd className="max-w-[210px] text-right text-neutral-900">
                  {receipt.revisionReason}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex items-center justify-between gap-4 border-b border-dashed border-neutral-300 pb-4">
            <span className="text-sm font-semibold text-neutral-900">Total Bayar</span>
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {receipt.formattedTotal}
            </span>
          </div>

          <p className="mt-4 text-center text-xs text-neutral-600">
            Terima kasih telah menggunakan layanan {receipt.clinicName}.
          </p>
        </article>

        {printError && (
          <div className="px-6 pb-3 print:hidden">
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {printError}
            </p>
          </div>
        )}

        {/* Tombol aksi unduh PDF dan cetak ke sistem printer (disembunyikan saat cetak) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-6 py-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            Tutup
          </button>

          <div className="flex flex-wrap gap-2">
            {onEditReceipt && booking && (
              <button
                type="button"
                onClick={() => onEditReceipt(booking)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                <FilePenLine className="h-4 w-4 text-amber-700" />
                <span>Perbaiki Resi</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => downloadReceiptPdf(receipt)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Unduh PDF</span>
            </button>

            {canDirectThermal && (
              <button
                type="button"
                disabled={isPrintingThermal}
                onClick={() => void handleThermalPrint()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                <Usb className="h-4 w-4" />
                <span>{isPrintingThermal ? 'Mencetak…' : 'Printer Termal'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSystemPrint}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Resi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
