// Layar masuk utama menggunakan akun Google (terhubung langsung ke aplikasi dan Google Sheets) beserta opsi cadangan akun lokal.

import { ChevronDown, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { CLINIC_LOGO_SRC, CLINIC_NAME } from '../config';
import { verifyAccountLogin } from '../lib/adminLock';
import type { UserAccount } from '../lib/types';
import { GoogleSignInButton } from './GoogleSignInButton';

interface AdminLockScreenProps {
  accounts: UserAccount[];
  isGoogleLoggingIn: boolean;
  googleAuthError: string | null;
  onGoogleLogin: () => void;
  onLocalLoginSuccess: (account: UserAccount) => void;
  onRequestResetLock: () => void;
}

export function AdminLockScreen({
  accounts,
  isGoogleLoggingIn,
  googleAuthError,
  onGoogleLogin,
  onLocalLoginSuccess,
  onRequestResetLock,
}: AdminLockScreenProps) {
  const hasGoogleAdmin = accounts.some((acc) => Boolean(acc.google_email?.trim()));
  const hasLocalAccounts = accounts.some((acc) => Boolean(acc.hash && acc.salt));

  const [showLocalForm, setShowLocalForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localErrorMsg, setLocalErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleLocalLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const nextErrors: { username?: string; password?: string } = {};

    if (!cleanUser) {
      nextErrors.username = 'Masukkan nama pengguna akun lokal.';
    }
    if (!password) {
      nextErrors.password = 'Masukkan kata sandi.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setLocalErrorMsg(null);
      if (nextErrors.username) usernameRef.current?.focus();
      else if (nextErrors.password) passwordRef.current?.focus();
      return;
    }

    setIsProcessingLocal(true);
    setFieldErrors({});
    setLocalErrorMsg(null);
    try {
      const result = await verifyAccountLogin(accounts, cleanUser, password);
      if (!result.ok) {
        setLocalErrorMsg(result.reason);
        passwordRef.current?.focus();
        return;
      }
      onLocalLoginSuccess(result.account);
    } catch {
      setLocalErrorMsg('Terjadi kesalahan saat memeriksa kata sandi.');
    } finally {
      setIsProcessingLocal(false);
    }
  };

  const activeError = googleAuthError || localErrorMsg;

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
              Masuk Aplikasi Klinik
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              {hasGoogleAdmin
                ? 'Masuk dengan akun Google Admin atau Terapis yang terdaftar.'
                : 'Masuk dengan akun Google untuk menjadi Admin utama dan menghubungkan Google Sheets.'}
            </p>
          </div>
        </div>

        {activeError && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {activeError}
          </div>
        )}

        <div className="mt-6">
          <GoogleSignInButton
            onClick={onGoogleLogin}
            disabled={isGoogleLoggingIn}
            label={isGoogleLoggingIn ? 'Menghubungkan ke Google…' : 'Sign in with Google'}
          />
          <p className="mt-2.5 text-xs text-neutral-600">
            Setiap kali masuk, aplikasi melakukan sinkronisasi langsung dengan akun Google dan Google Sheets Anda.
          </p>
        </div>

        {hasLocalAccounts && (
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={() => setShowLocalForm((prev) => !prev)}
              aria-expanded={showLocalForm}
              className="inline-flex min-h-[40px] w-full items-center justify-between text-sm font-medium text-neutral-700 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            >
              <span>Masuk dengan username lokal</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-150 ${
                  showLocalForm ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showLocalForm && (
              <form onSubmit={handleLocalLoginSubmit} noValidate className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="local-username"
                    className="block text-sm font-medium text-neutral-800"
                  >
                    Nama Pengguna (Username) <span className="text-red-700">*</span>
                  </label>
                  <input
                    ref={usernameRef}
                    id="local-username"
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
                  <label
                    htmlFor="local-password"
                    className="block text-sm font-medium text-neutral-800"
                  >
                    Kata Sandi <span className="text-red-700">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      ref={passwordRef}
                      id="local-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
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

                <button
                  type="submit"
                  disabled={isProcessingLocal}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60"
                >
                  {isProcessingLocal ? 'Memproses…' : 'Masuk dengan Akun Lokal'}
                </button>
              </form>
            )}
          </div>
        )}

        {accounts.length > 0 && (
          <div className="mt-4 border-t border-neutral-200 pt-3">
            <button
              type="button"
              onClick={onRequestResetLock}
              className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset daftar akun di browser ini</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
