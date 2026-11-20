// Batas tangkap kesalahan aplikasi agar error Firestore atau runtime tampil rapi dengan tombol muat ulang.

import { AlertCircle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Terjadi kesalahan antarmuka:', error, info);
  }

  render() {
    if (this.state.error) {
      let friendlyMessage = this.state.error.message;
      try {
        const parsed = JSON.parse(this.state.error.message) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed && parsed.error) {
          friendlyMessage = `Akses data cloud gagal (${parsed.operationType ?? 'operasi'}): ${parsed.error}`;
        }
      } catch {
        // Gunakan pesan asli jika bukan JSON terstruktur
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" />
              <div>
                <h1 className="text-lg font-semibold text-neutral-900">
                  Terjadi Gangguan Koneksi Data
                </h1>
                <p className="mt-1 text-sm text-neutral-600">{friendlyMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Muat Ulang Aplikasi</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
