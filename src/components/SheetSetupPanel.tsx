// Panel ekspor CSV tanpa login serta koneksi Google Spreadsheet opsional untuk sinkronisasi cloud.

import { Download, ExternalLink, Link2, Loader2, LogOut, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { exportBookingsCsv, exportServicesCsv, exportTherapistsCsv } from '../lib/csvExport';
import { extractSpreadsheetId } from '../lib/googleSheets';
import type { Booking, Service, SpreadsheetConnection, Therapist } from '../lib/types';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SheetSetupPanelProps {
  isAuthenticated: boolean;
  userEmail: string | null;
  isLoggingIn: boolean;
  connection: SpreadsheetConnection | null;
  isSyncing: boolean;
  errorMessage: string | null;
  therapists: Therapist[];
  services: Service[];
  bookings: Booking[];
  onSignIn: () => void;
  onSignOut: () => void;
  onCreateSpreadsheet: (title: string) => Promise<void>;
  onConnectSpreadsheet: (spreadsheetId: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onDisconnectSpreadsheet: () => void;
}

export function SheetSetupPanel({
  isAuthenticated,
  userEmail,
  isLoggingIn,
  connection,
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Ekspor CSV langsung tanpa login */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
          Penyimpanan Lokal & Ekspor Google Sheets
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Seluruh jadwal tersimpan otomatis di browser tanpa perlu login. Anda dapat mengunduh file CSV untuk diimpor ke Google Sheets kapan saja.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => exportBookingsCsv(bookings)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
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

      {/* Sinkronisasi Google Sheets langsung (opsional) */}
      {!isAuthenticated ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-neutral-900">
            Sinkronisasi Langsung ke Google Sheets (Opsional)
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Jika ingin sinkronisasi otomatis dua arah ke Google Spreadsheet di Google Drive Anda, masuk dengan akun Google di bawah ini.
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
              onClick={onSignIn}
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
                <h2 className="text-lg font-semibold text-neutral-900">Akun Google Terhubung</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  {userEmail ? `Masuk sebagai ${userEmail}` : 'Sesi Google Sheets aktif'}
                </p>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </section>

          {connection ? (
            <section className="rounded-2xl border border-neutral-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Spreadsheet Aktif</h2>
                  <p className="mt-1 text-base font-medium text-neutral-900">{connection.title}</p>
                  <p className="mt-1 text-sm text-neutral-600 tabular-nums">
                    ID: {connection.spreadsheetId} · Tab: Terapis, Layanan, Reservasi
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onRefreshData}
                    disabled={isSyncing}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60 whitespace-nowrap"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menyinkronkan…' : 'Muat Ulang'}</span>
                  </button>
                  <a
                    href={connection.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Buka Google Sheet</span>
                  </a>
                  <button
                    type="button"
                    onClick={onDisconnectSpreadsheet}
                    className="inline-flex min-h-[44px] items-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                  >
                    Ganti Sheet
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-neutral-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-neutral-900">
                Pilih atau Buat Spreadsheet Database
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Buat spreadsheet baru otomatis atau hubungkan spreadsheet Google Sheets yang sudah Anda miliki.
              </p>

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
                  <h3 className="text-base font-semibold text-neutral-900">
                    Buat Spreadsheet Baru
                  </h3>
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
                      Otomatis membuat tab Terapis, Layanan, dan Reservasi.
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
                    <span>{isWorking ? 'Membuat…' : 'Buat Spreadsheet Baru'}</span>
                  </button>
                </form>

                <form
                  onSubmit={handleConnect}
                  className="space-y-4 border-t border-neutral-200 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0"
                >
                  <h3 className="text-base font-semibold text-neutral-900">
                    Hubungkan Sheet yang Ada
                  </h3>
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
                    <span>{isWorking ? 'Menghubungkan…' : 'Hubungkan Sheet'}</span>
                  </button>
                </form>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
