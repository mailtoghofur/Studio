// Dialog konfirmasi wajib sebelum menjalankan perubahan atau pembatalan data di Google Sheets.

import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ConfirmDialogState } from '../lib/types';

interface ConfirmDialogProps {
  dialog: ConfirmDialogState | null;
  onClose: () => void;
}

export function ConfirmDialog({ dialog, onClose }: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dialog) {
      setSubmitError(null);
      setIsSubmitting(false);
      setTimeout(() => cancelRef.current?.focus(), 0);
    }
  }, [dialog]);

  if (!dialog) return null;

  const isDanger = dialog.tone === 'danger';

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await dialog.onConfirm();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan perubahan ke Google Sheets.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isDanger ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isDanger ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="confirm-dialog-title" className="text-lg font-semibold text-neutral-900">
                {dialog.title}
              </h2>
              <p className="mt-1 text-sm text-neutral-600">{dialog.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog konfirmasi"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {dialog.details && dialog.details.length > 0 && (
          <ul className="mt-4 space-y-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800">
            {dialog.details.map((item, idx) => (
              <li key={idx} className="leading-snug">
                {item}
              </li>
            ))}
          </ul>
        )}

        {submitError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {submitError}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60 whitespace-nowrap"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60 whitespace-nowrap ${
              isDanger ? 'bg-red-700 hover:bg-red-800' : 'bg-amber-700 hover:bg-amber-800'
            }`}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isSubmitting ? 'Menyimpan…' : dialog.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
