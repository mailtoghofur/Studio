// Layar masuk multi-browser dengan satu akun Admin Master serta akun Terapis dan Admin tambahan dari Manajemen Akun.

import { ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { CLINIC_LOGO_SRC, CLINIC_NAME } from '../config';
import { bootstrapMasterWorkspace, loginWithUsernamePassword } from '../lib/cloudClinic';
import { FIREBASE_PROJECT_ID } from '../lib/firebase';
import { formatFirebaseAuthError, isAuthProviderDisabledError } from '../lib/firebaseErrors';
import type { Booking, Service, Therapist, UserAccount } from '../lib/types';

interface AdminLockScreenProps {
  isInitialized: boolean | null;
  initError: string | null;
  legacyLocalData?: {
    therapists?: Therapist[];
    services?: Service[];
    bookings?: Booking[];
  };
  onRetryInit: () => void;
  onLoginSuccess: (account: UserAccount) => void;
  onMasterSetupSuccess: (account: UserAccount) => void;
}

export function AdminLockScreen({
  isInitialized,
  initError,
  legacyLocalData,
  onRetryInit,
  onLoginSuccess,
  onMasterSetupSuccess,
}: AdminLockScreenProps) {
  const isInitialSetup = isInitialized === false;

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showProviderGuide, setShowProviderGuide] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const firebaseProvidersUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`;

  const handleInitialSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanDisplay = displayName.trim();
    const nextErrors: typeof fieldErrors = {};

    if (cleanUser.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(cleanUser)) {
      nextErrors.username =
        'Username minimal 3 karakter (huruf, angka, titik, atau garis bawah), contoh: admin.';
    }
    if (password.length < 6) {
      nextErrors.password = 'Kata sandi minimal 6 karakter, contoh kombinasi huruf dan angka.';
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Konfirmasi kata sandi harus sama dengan kata sandi baru.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setErrorMsg(null);
      if (nextErrors.username) usernameRef.current?.focus();
      else if (nextErrors.password) passwordRef.current?.focus();
      else if (nextErrors.confirmPassword) confirmRef.current?.focus();
      return;
    }

    setIsProcessing(true);
    setFieldErrors({});
    setErrorMsg(null);
    setShowProviderGuide(false);
    try {
      const masterAccount = await bootstrapMasterWorkspace({
        username: cleanUser,
        displayName: cleanDisplay || 'Admin Master',
        password,
        initialData: legacyLocalData,
      });
      onMasterSetupSuccess(masterAccount);
    } catch (err) {
      if (isAuthProviderDisabledError(err)) {
        setShowProviderGuide(true);
      }
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const nextErrors: { username?: string; password?: string } = {};

    if (!cleanUser) {
      nextErrors.username = 'Masukkan nama pengguna akun.';
    }
    if (!password) {
      nextErrors.password = 'Masukkan kata sandi.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setErrorMsg(null);
      if (nextErrors.username) usernameRef.current?.focus();
      else if (nextErrors.password) passwordRef.current?.focus();
      return;
    }

    setIsProcessing(true);
    setFieldErrors({});
    setErrorMsg(null);
    setShowProviderGuide(false);
    try {
      const account = await loginWithUsernamePassword(cleanUser, password);
      onLoginSuccess(account);
    } catch (err) {
      if (isAuthProviderDisabledError(err)) {
        setShowProviderGuide(true);
      }
      setErrorMsg(formatFirebaseAuthError(err));
      passwordRef.current?.focus();
    } finally {
      setIsProcessing(false);
    }
  };

  if (isInitialized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">
          <div className="flex items-center gap-3.5">
            <img
              src={CLINIC_LOGO_SRC}
              alt={`Logo ${CLINIC_NAME}`}
              className="h-14 w-14 shrink-0 rounded-full border border-neutral-200 object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-amber-800">{CLINIC_NAME}</p>
              <h1 className="mt-0.5 text-xl font-semibold text-neutral-900">
                Menyiapkan Koneksi Cloud
              </h1>
            </div>
          </div>

          {initError ? (
            <div className="mt-5 space-y-3">
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {initError}
              </div>
              <button
                type="button"
                onClick={onRetryInit}
                className="min-h-[44px] w-full rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                Coba Hubungkan Lagi
              </button>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-2.5 text-sm text-neutral-600">
              <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
              <span>Memeriksa status akun master klinik…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">
        <div className="flex items-center gap-3.5">
          <img
            src={CLINIC_LOGO_SRC}
            alt={`Logo ${CLINIC_NAME}`}
            className="h-14 w-14 shrink-0 rounded-full border border-neutral-200 object-cover"
          />
          <div>
            <p className="text-sm font-semibold text-amber-800">{CLINIC_NAME}</p>
            <h1 className="mt-0.5 text-2xl font-semibold text-neutral-900">
              {isInitialSetup ? 'Atur Akun Admin Master' : 'Masuk Aplikasi Klinik'}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              {isInitialSetup
                ? 'Akun Admin Master ini dapat digunakan masuk dari berbagai browser dan perangkat.'
                : 'Masukkan username dan kata sandi akun Admin Master, Admin, atau Terapis.'}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        {showProviderGuide && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-950">
            <p className="font-semibold">Langkah Aktifkan Login Username/Kata Sandi:</p>
            <ol className="mt-1.5 list-inside list-decimal space-y-1 text-xs text-amber-900">
              <li>Buka halaman Sign-in providers di Firebase Console.</li>
              <li>Pilih <strong>Email/Password</strong>, aktifkan tombol <strong>Enable</strong>, lalu klik <strong>Save</strong>.</li>
              <li>Kembali ke halaman ini dan klik tombol masuk/simpan lagi.</li>
            </ol>
            <a
              href={firebaseProvidersUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 underline hover:text-amber-950"
            >
              <span>Buka Firebase Authentication Providers</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        <form
          onSubmit={isInitialSetup ? handleInitialSetupSubmit : handleLoginSubmit}
          noValidate
          className="mt-5 space-y-4"
        >
          {isInitialSetup && (
            <div>
              <label
                htmlFor="admin-display-name"
                className="block text-sm font-medium text-neutral-800"
              >
                Nama Tampilan Admin Master
              </label>
              <input
                id="admin-display-name"
                name="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Contoh: Admin Master Naomi"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
            </div>
          )}

          <div>
            <label htmlFor="admin-username" className="block text-sm font-medium text-neutral-800">
              Nama Pengguna (Username) <span className="text-red-700">*</span>
            </label>
            <input
              ref={usernameRef}
              id="admin-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: admin"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            />
            {fieldErrors.username && (
              <p className="mt-1.5 text-sm text-red-700">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-neutral-800">
              {isInitialSetup ? 'Kata Sandi Master' : 'Kata Sandi'}{' '}
              <span className="text-red-700">*</span>
            </label>
            <div className="relative mt-1.5">
              <input
                ref={passwordRef}
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isInitialSetup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isInitialSetup ? 'Minimal 6 karakter' : 'Masukkan kata sandi'}
                className="min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white py-2 pl-3.5 pr-12 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-amber-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1.5 text-sm text-red-700">{fieldErrors.password}</p>
            )}
          </div>

          {isInitialSetup && (
            <div>
              <label
                htmlFor="admin-password-confirm"
                className="block text-sm font-medium text-neutral-800"
              >
                Ulangi Kata Sandi <span className="text-red-700">*</span>
              </label>
              <input
                ref={confirmRef}
                id="admin-password-confirm"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi baru"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1.5 text-sm text-red-700">{fieldErrors.confirmPassword}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing}
            className="min-h-[44px] w-full rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60"
          >
            {isProcessing
              ? 'Menghubungkan…'
              : isInitialSetup
                ? 'Buat Akun Master & Masuk'
                : 'Masuk'}
          </button>
        </form>

        <div className="mt-5 border-t border-neutral-200 pt-4">
          <p className="text-xs text-neutral-600">
            {isInitialSetup
              ? 'Setelah akun Master diatur, semua browser akan memakai akun ini sebagai akses utama.'
              : 'Pembuatan akun baru hanya tersedia melalui menu Manajemen Akun oleh Admin.'}
          </p>
        </div>
      </div>
    </div>
  );
}
