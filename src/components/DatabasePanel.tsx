// Panel pengelolaan database terpisah milik akun aktif (cadangan JSON, pulihkan data, ekspor CSV, dan reset).

import { Database, Download, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { exportBookingsCsv, exportServicesCsv, exportTherapistsCsv } from '../lib/csvExport';
import { exportAccountDatabaseJson, parseAccountDatabaseJson } from '../lib/database';
import type { AccountDatabase } from '../lib/types';

interface DatabasePanelProps {
  database: AccountDatabase;
  onRequestImportDatabase: (importedDb: AccountDatabase) => void;
  onRequestResetDatabase: () => void;
}

function formatUpdatedAt(iso: string): string {
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function DatabasePanel({
  database,
  onRequestImportDatabase,
  onRequestResetDatabase,
}: DatabasePanelProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError(null);
    try {
      const text = await file.text();
      const parsedDb = parseAccountDatabaseJson(
        text,
        database.owner_account_id,
        database.owner_username
      );
      onRequestImportDatabase(parsedDb);
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : 'Gagal membaca file database. Pastikan format file adalah JSON cadangan aplikasi.'
      );
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Info Database Terpisah Akun Aktif */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
                Database Akun ({database.owner_username})
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Data terapis, layanan, dan reservasi tersimpan terpisah khusus untuk akun ini.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-neutral-50 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-3.5">
            <p className="text-xs font-medium text-neutral-600">ID Database</p>
            <p className="mt-1 truncate text-sm font-semibold text-neutral-900 tabular-nums">
              {database.database_id}
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-xs font-medium text-neutral-600">Terapis</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
              {database.therapists.length}
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-xs font-medium text-neutral-600">Layanan</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
              {database.services.length}
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-xs font-medium text-neutral-600">Reservasi</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
              {database.bookings.length}
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs text-neutral-600 tabular-nums">
          Pembaruan terakhir: {formatUpdatedAt(database.updated_at)}
        </p>

        {importError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {importError}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => exportAccountDatabaseJson(database)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Unduh Database (.json)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              <Upload className="h-4 w-4" />
              <span>Impor Database (.json)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onRequestResetDatabase}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Database Akun</span>
          </button>
        </div>
      </section>

      {/* Ekspor CSV */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Ekspor Tabel CSV</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Unduh salinan masing-masing tabel dalam format CSV untuk dibuka di Excel atau aplikasi spreadsheet lainnya.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => exportBookingsCsv(database.bookings)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <Download className="h-4 w-4 text-amber-700" />
            <span>Unduh CSV Reservasi ({database.bookings.length})</span>
          </button>
          <button
            type="button"
            onClick={() => exportServicesCsv(database.services)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Unduh CSV Layanan ({database.services.length})</span>
          </button>
          <button
            type="button"
            onClick={() => exportTherapistsCsv(database.therapists)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Unduh CSV Terapis ({database.therapists.length})</span>
          </button>
        </div>
      </section>
    </div>
  );
}
