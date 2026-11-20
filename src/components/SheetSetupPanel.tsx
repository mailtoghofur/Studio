// Panel ekspor CSV serta koneksi permanen database Google Spreadsheet dan sinkronisasi dua arah.

import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { exportBookingsCsv, exportServicesCsv, exportTherapistsCsv } from '../lib/csvExport';
import { extractSpreadsheetId } from '../lib/googleSheets';
import type { Booking, Service, SpreadsheetConnection, Therapist } from '../lib/types';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SheetSetupPanelProps {
  isAuthenticated: boolean;
  hasLiveSheet: boolean;
  userEmail: string | null;
  connectedGoogleEmail: string | null;
  isLoggingIn: boolean;
  connection: SpreadsheetConnection | null;
  hasPendingSync: boolean;
  isSyncing: boolean;
  errorMessage: string | null;
  therapists: Therapist[];
  services: Service[];
  bookings: Booking[];
  onSignIn: (forceSelectAccount?: boolean) => void;
  onSignOut: () => void;
  onCreateSpreadsheet: (title: string) => Promise<void>;
  onConnectSpreadsheet: (spreadsheetId: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onPushLocalToSheet: () => void;
  onDisconnectSpreadsheet: () => void;
}

export function SheetSetupPanel({
  isAuthenticated,
  hasLiveSheet,
  userEmail,
  connectedGoogleEmail,
  isLoggingIn,
  connection,
  hasPendingSync,
  isSyncing,
  errorMessage,
  therapists,
  services,
  bookings,
  onSignIn,
  onSignOut,
  onCreateSpreadsheet,
  onConnectSpreadsheet,
  onRefreshData,
  onPushLocalToSheet,
  onDisconnectSpreadsheet,
}: SheetSetupPanelProps) {
  const [newTitle, setNewTitle] = useState('Database Penjadwalan Naomi Beauty & Wellness');
  const [existingInput, setExistingInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setFormError('Masukkan nama spreadsheet baru, contoh: Jadwal Naomi Beauty & Wellness 2026.');
      return;
    }
    setFormError(null);
    setIsWorking(true);
    try {
      await onCreateSpreadsheet(trimmed);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat Google Spreadsheet.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractSpreadsheetId(existingInput);
    if (!id) {
      setFormError(
        'Masukkan tautan atau ID Google Sheets yang valid, contoh: https://docs.google.com/spreadsheets/d/1AbC.../edit'
      );
      return;
    }
    setFormError(null);
    setIsWorking(true);
    try {
      await onConnectSpreadsheet(id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menghubungkan Google Spreadsheet.');
    } finally {
      setIsWorking(false);
    }
  };

  const activeEmail = userEmail ?? connectedGoogleEmail;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Status Database Google Sheets Terhubung Permanen (selalu tampil jika sudah pernah dihubungkan) */}
      {connection && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
                  Database Google Sheets Permanen
                </h1>
                {hasLiveSheet ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Sinkronisasi Aktif</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Terikat Permanen - Perlu Aktivasi Sesi</span>
                  </span>
                )}
              </div>

              <p className="text-base font-medium text-neutral-900">{connection.title}</p>
              <p className="text-sm text-neutral-600 tabular-nums">
                ID: {connection.spreadsheetId} · Tab: Terapis, Layanan, Reservasi
              </p>
              {activeEmail && (
                <p className="text-sm text-neutral-600">
                  Akun Google terhubung: <span className="font-medium text-neutral-900">{activeEmail}</span>
                </p>
              )}
            </div>

            <a
              href={connection.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
            >
              <ExternalLink className="h-4 w-4 text-amber-700" />
              <span>Buka Google Sheet</span>
            </a>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {errorMessage}
            </div>
          )}

          {!hasLiveSheet ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                Ikatan ke database spreadsheet ini tersimpan permanen di perangkat ini.{' '}
                {hasPendingSync
                  ? 'Terdapat perubahan lokal yang belum dikirim ke Google Sheets.'
                  : 'Aktifkan kembali sesi Google untuk memuat dan menyimpan perubahan langsung ke spreadsheet.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <GoogleSignInButton
                  onClick={() => onSignIn(false)}
                  disabled={isLoggingIn}
                  label={isLoggingIn ? 'Mengaktifkan Sesi…' : 'Aktifkan Sesi Google'}
                />
                {activeEmail && (
                  <button
                    type="button"
                    onClick={() => onSignIn(true)}
                    disabled={isLoggingIn}
                    className="inline-flex min-h-[40px] items-center rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                  >
                    Ganti Akun Google
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
              <div className="flex flex-wrap gap-2">
                {hasPendingSync && (
                  <button
                    type="button"
                    onClick={onPushLocalToSheet}
                    disabled={isSyncing}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60 whitespace-nowrap"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Kirim Perubahan Lokal ke Sheet</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onRefreshData}
                  disabled={isSyncing}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60 whitespace-nowrap"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Menyinkronkan…' : 'Muat Ulang dari Sheet'}</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Tutup Sesi Google</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onDisconnectSpreadsheet}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                Putus Koneksi Permanen
              </button>
            </div>
          )}

          {!hasLiveSheet && (
            <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
              <button
                type="button"
                onClick={onDisconnectSpreadsheet}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                Putus Koneksi Permanen
              </button>
            </div>
          )}
        </section>
      )}

      {/* Setup Database Google Sheets Baru (tampil saat belum ada spreadsheet terikat permanen) */}
      {!connection && (
        !isAuthenticated ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
              Hubungkan Database Google Sheets
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Masuk dengan akun Google untuk menghubungkan spreadsheet sebagai database permanen klinik. Setelah terhubung, ikatan database tetap tersimpan otomatis.
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {errorMessage}
              </div>
            )}

            <div className="mt-4">
              <GoogleSignInButton
                onClick={() => onSignIn(true)}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Menghubungkan…' : 'Sign in with Google'}
              />
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-neutral-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
                    Pilih atau Buat Spreadsheet Database
                  </h1>
                  <p className="mt-1 text-sm text-neutral-600">
                    {userEmail ? `Masuk sebagai ${userEmail}. ` : ''}
                    Spreadsheet yang dipilih akan terikat permanen sebagai database aplikasi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Ganti Akun Google</span>
                </button>
              </div>

              {(formError || errorMessage) && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {formError || errorMessage}
                </div>
              )}

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <form
                  onSubmit={handleCreate}
                  className="space-y-4 border-t border-neutral-200 pt-4 md:border-t-0 md:pt-0"
                >
                  <h2 className="text-base font-semibold text-neutral-900">
                    Buat Spreadsheet Baru
                  </h2>
                  <div>
                    <label
                      htmlFor="new-sheet-title"
                      className="block text-sm font-medium text-neutral-800"
                    >
                      Nama File Google Sheets
                    </label>
                    <input
                      id="new-sheet-title"
                      name="newSheetTitle"
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                      placeholder="Contoh: Jadwal Naomi Beauty & Wellness"
                    />
                    <p className="mt-1 text-sm text-neutral-600">
                      Otomatis menyalin data terapis, layanan, dan reservasi saat ini.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={isWorking}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60 whitespace-nowrap"
                  >
                    {isWorking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    <span>{isWorking ? 'Membuat…' : 'Buat & Ikat Permanen'}</span>
                  </button>
                </form>

                <form
                  onSubmit={handleConnect}
                  className="space-y-4 border-t border-neutral-200 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0"
                >
                  <h2 className="text-base font-semibold text-neutral-900">
                    Hubungkan Sheet yang Ada
                  </h2>
                  <div>
                    <label
                      htmlFor="existing-sheet-id"
                      className="block text-sm font-medium text-neutral-800"
                    >
                      Tautan atau ID Spreadsheet
                    </label>
                    <input
                      id="existing-sheet-id"
                      name="existingSheetId"
                      type="text"
                      value={existingInput}
                      onChange={(e) => setExistingInput(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                    />
                    <p className="mt-1 text-sm text-neutral-600">
                      Tempel URL penuh Google Sheets atau ID spreadsheet.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={isWorking}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60 whitespace-nowrap"
                  >
                    {isWorking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    <span>{isWorking ? 'Menghubungkan…' : 'Hubungkan Permanen'}</span>
                  </button>
                </form>
              </div>
            </section>
          </>
        )
      )}

      {/* Ekspor CSV cadangan */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Cadangan Ekspor CSV</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Unduh salinan data lokal kapan saja sebagai file CSV.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => exportBookingsCsv(bookings)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <Download className="h-4 w-4 text-amber-700" />
            <span>Unduh CSV Reservasi ({bookings.length})</span>
          </button>
          <button
            type="button"
            onClick={() => exportServicesCsv(services)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Unduh CSV Layanan ({services.length})</span>
          </button>
          <button
            type="button"
            onClick={() => exportTherapistsCsv(therapists)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Unduh CSV Terapis ({therapists.length})</span>
          </button>
        </div>
      </section>
    </div>
  );
}
