// Dialog konfirmasi wajib sebelum menjalankan perubahan atau pembatalan data reservasi dan akun.

import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { validateCancellationReason } from '../lib/schedule';
import type { ConfirmDialogState } from '../lib/types';

interface ConfirmDialogProps {
  dialog: ConfirmDialogState | null;
  onClose: () => void;
}

export function ConfirmDialog({ dialog, onClose }: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reasonValue, setReasonValue] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (dialog) {
      setSubmitError(null);
      setReasonError(null);
      setReasonValue(dialog.reasonField?.initialValue ?? '');
      setIsSubmitting(false);
      setTimeout(() => {
        if (dialog.reasonField?.required) {
          reasonRef.current?.focus();
        } else {
          cancelRef.current?.focus();
        }
      }, 0);
    }
  }, [dialog]);

  if (!dialog) return null;

  const isDanger = dialog.tone === 'danger';

  const handleConfirm = async () => {
    if (dialog.reasonField) {
      const check = validateCancellationReason(reasonValue, dialog.reasonField.required);
      if (!check.valid) {
        setReasonError(check.error ?? 'Isi alasan pembatalan terlebih dahulu.');
        reasonRef.current?.focus();
        return;
      }
      setReasonError(null);
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await dialog.onConfirm(dialog.reasonField ? reasonValue.trim() : undefined);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan perubahan data.';
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

        {dialog.reasonField && (
          <div className="mt-4">
            <label
              htmlFor="confirm-dialog-reason"
              className="block text-sm font-medium text-neutral-800"
            >
              {dialog.reasonField.label}{' '}
              {dialog.reasonField.required && <span className="text-red-700">*</span>}
            </label>
            <textarea
              ref={reasonRef}
              id="confirm-dialog-reason"
              name="cancellationReason"
              rows={3}
              maxLength={dialog.reasonField.maxLength ?? 200}
              value={reasonValue}
              onChange={(e) => {
                setReasonValue(e.target.value);
                if (reasonError) setReasonError(null);
              }}
              placeholder={dialog.reasonField.placeholder}
              className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            />
            {reasonError && <p className="mt-1.5 text-sm text-red-700">{reasonError}</p>}
          </div>
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

