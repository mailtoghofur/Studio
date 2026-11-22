// Batas tangkap kesalahan antarmuka agar error aplikasi dan error izin Firestore tampil rapi dengan tombol muat ulang.

import { AlertCircle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import firebaseConfig from '../../firebase-applet-config.json';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function formatReadableError(error: Error): { message: string; upgradeUrl?: string } {
  let rawMessage = error.message;
  try {
    const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
    if (parsed && typeof parsed.error === 'string') {
      rawMessage = parsed.error;
    }
  } catch {
    // Gunakan pesan asli jika bukan JSON terstruktur
  }

  if (rawMessage.includes("Free daily read units per project")) {
    return {
      message: 'Kuota pembacaan harian gratis Firestore tercapai dan akan direset esok hari.',
      upgradeUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`,
    };
  }

  if (rawMessage.includes('Quota exceeded')) {
    return {
      message: 'Batas kuota penggunaan harian Firestore telah tercapai dan akan direset besok.',
    };
  }

  if (rawMessage.includes('Missing or insufficient permissions')) {
    return {
      message: 'Akses ke database ditolak oleh aturan keamanan Firestore. Pastikan Anda masuk dengan akun Google terverifikasi yang memiliki akses.',
    };
  }

  return { message: rawMessage };
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
      const formatted = formatReadableError(this.state.error);
      return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" />
              <div>
                <h1 className="text-lg font-semibold text-neutral-900">
                  Terjadi Kesalahan Aplikasi
                </h1>
                <p className="mt-1 text-sm text-neutral-600">{formatted.message}</p>
                {formatted.upgradeUrl && (
                  <a
                    href={formatted.upgradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-amber-800 underline hover:text-amber-900"
                  >
                    Lihat informasi kuota database di Firebase Console
                  </a>
                )}
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
