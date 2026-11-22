// Panel pengelolaan database akun, sinkronisasi Cloud Firestore, cadangan JSON, Paket Master, dan ekspor CSV.

import type { User } from 'firebase/auth';
import { Cloud, CloudOff, Database, Download, Package, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { exportBookingsCsv, exportServicesCsv, exportTherapistsCsv } from '../lib/csvExport';
import {
  exportAccountDatabaseJson,
  exportMasterBundleJson,
  parseAccountDatabaseJson,
  parseMasterBundleJson,
} from '../lib/database';
import type { AccountDatabase, MasterBundlePayload, UserAccount } from '../lib/types';

interface DatabasePanelProps {
  database: AccountDatabase;
  allAccounts: UserAccount[];
  firebaseUser: User | null;
  isSyncingCloud: boolean;
  onConnectGoogleCloud: () => Promise<void>;
  onDisconnectGoogleCloud: () => Promise<void>;
  onSyncLocalToCloud: () => Promise<void>;
  onRequestImportDatabase: (importedDb: AccountDatabase) => void;
  onRequestImportMasterBundle: (bundle: MasterBundlePayload) => void;
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
  allAccounts,
  firebaseUser,
  isSyncingCloud,
  onConnectGoogleCloud,
  onDisconnectGoogleCloud,
  onSyncLocalToCloud,
  onRequestImportDatabase,
  onRequestImportMasterBundle,
  onRequestResetDatabase,
}: DatabasePanelProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bundleInputRef = useRef<HTMLInputElement>(null);

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

  const handleBundleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBundleError(null);
    try {
      const text = await file.text();
      const bundle = parseMasterBundleJson(text);
      onRequestImportMasterBundle(bundle);
    } catch (err) {
      setBundleError(
        err instanceof Error
          ? err.message
          : 'Gagal membaca file Paket Master. Pastikan format file valid.'
      );
    }
  };

  const handleCloudAction = async (fn: () => Promise<void>) => {
    setCloudError(null);
    try {
      await fn();
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Gagal menyinkronkan ke Cloud Firestore.';
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed && typeof parsed.error === 'string') {
          msg = parsed.error;
        }
      } catch {
        // Gunakan pesan asli
      }
      if (msg.includes('Missing or insufficient permissions')) {
        msg = 'Akses sinkronisasi ditolak oleh aturan keamanan Firestore. Pastikan akun Google terverifikasi dan coba muat ulang halaman.';
      } else if (msg.includes('Quota exceeded')) {
        msg = 'Kuota penggunaan harian Firestore telah tercapai dan akan direset esok hari.';
      }
      setCloudError(msg);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Sinkronisasi Cloud Firestore */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                Database Cloud (Firestore)
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                {firebaseUser
                  ? `Terhubung dengan akun Google ${firebaseUser.email || firebaseUser.displayName}. Data disinkronkan otomatis.`
                  : 'Hubungkan akun Google Anda untuk menyimpan dan menyinkronkan data klinik secara aman ke Cloud Firestore.'}
              </p>
            </div>
          </div>
        </div>

        {cloudError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {cloudError}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {!firebaseUser ? (
            <button
              type="button"
              disabled={isSyncingCloud}
              onClick={() => void handleCloudAction(onConnectGoogleCloud)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60 whitespace-nowrap"
            >
              <Cloud className="h-4 w-4" />
              <span>{isSyncingCloud ? 'Menghubungkan…' : 'Hubungkan Akun Google'}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={isSyncingCloud}
                onClick={() => void handleCloudAction(onSyncLocalToCloud)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span>{isSyncingCloud ? 'Menyinkronkan…' : 'Sinkronkan ke Cloud'}</span>
              </button>

              <button
                type="button"
                disabled={isSyncingCloud}
                onClick={() => void handleCloudAction(onDisconnectGoogleCloud)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60 whitespace-nowrap"
              >
                <CloudOff className="h-4 w-4" />
                <span>Putus Koneksi Google</span>
              </button>
            </>
          )}
        </div>
      </section>

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
                Ringkasan data terapis, layanan, dan reservasi pada ruang kerja aktif.
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

      {/* Paket Master Lintas Browser */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Paket Master Multi-Browser (.json)
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Salin akun Master beserta seluruh akun dan database di dalamnya ke perangkat lain.
            </p>
          </div>
        </div>

        {bundleError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {bundleError}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => exportMasterBundleJson(allAccounts)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <Download className="h-4 w-4 text-amber-700" />
            <span>Unduh Paket Master ({allAccounts.length} Akun)</span>
          </button>

          <input
            ref={bundleInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleBundleFileChange(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => bundleInputRef.current?.click()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <Upload className="h-4 w-4" />
            <span>Impor Paket Master (.json)</span>
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
