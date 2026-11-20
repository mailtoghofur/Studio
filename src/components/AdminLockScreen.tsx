// Layar masuk utama menggunakan username dan kata sandi, serta pendaftaran akun Admin baru dengan database terpisah.

import { Eye, EyeOff, RotateCcw, UserPlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { CLINIC_LOGO_SRC, CLINIC_NAME } from '../config';
import { createUserAccount, verifyAccountLogin } from '../lib/adminLock';
import type { UserAccount } from '../lib/types';

interface AdminLockScreenProps {
  accounts: UserAccount[];
  onLoginSuccess: (account: UserAccount) => void;
  onCreateAdminAccount: (adminAccount: UserAccount) => void;
  onRequestResetLock: () => void;
}

export function AdminLockScreen({
  accounts,
  onLoginSuccess,
  onCreateAdminAccount,
  onRequestResetLock,
}: AdminLockScreenProps) {
  const validPasswordAccounts = accounts.filter((acc) => Boolean(acc.hash && acc.salt));
  const hasAnyAccount = validPasswordAccounts.length > 0;

  const [mode, setMode] = useState<'login' | 'register'>(() =>
    hasAnyAccount ? 'login' : 'register'
  );
  const isRegisterMode = !hasAnyAccount || mode === 'register';

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const displayNameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setErrorMsg(null);
    setFieldErrors({});
    setPassword('');
    setConfirmPassword('');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanDisplay = displayName.trim();
    const nextErrors: typeof fieldErrors = {};

    if (cleanUser.length < 3 || /\s/.test(cleanUser)) {
      nextErrors.username = 'Username minimal 3 karakter tanpa spasi, contoh: admin.';
    } else if (
      validPasswordAccounts.some(
        (acc) => acc.username.trim().toLowerCase() === cleanUser.toLowerCase()
      )
    ) {
      nextErrors.username = 'Username tersebut sudah digunakan. Pilih username lain.';
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
    try {
      const adminAccount = await createUserAccount({
        username: cleanUser,
        display_name: cleanDisplay || 'Admin Klinik',
        password,
        role: 'ADMIN',
        is_active: true,
      });
      onCreateAdminAccount(adminAccount);
      onLoginSuccess(adminAccount);
    } catch {
      setErrorMsg('Gagal menyimpan akun admin di browser ini.');
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
    try {
      const result = await verifyAccountLogin(validPasswordAccounts, cleanUser, password);
      if (!result.ok) {
        setErrorMsg(result.reason);
        passwordRef.current?.focus();
        return;
      }
      onLoginSuccess(result.account);
    } catch {
      setErrorMsg('Terjadi kesalahan saat memeriksa kata sandi.');
    } finally {
      setIsProcessing(false);
    }
  };

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
              {!hasAnyAccount
                ? 'Atur Akun Admin Utama'
                : isRegisterMode
                  ? 'Daftar Akun Admin Baru'
                  : 'Masuk Aplikasi Klinik'}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              {isRegisterMode
                ? 'Setiap akun Admin memiliki penyimpanan database jadwal terpisah.'
                : 'Masukkan username dan kata sandi akun Admin atau Terapis.'}
            </p>
          </div>
        </div>

        {hasAnyAccount && (
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`min-h-[38px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                !isRegisterMode
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Masuk Akun
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isRegisterMode
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Akun Baru</span>
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={isRegisterMode ? handleRegisterSubmit : handleLoginSubmit}
          noValidate
          className="mt-5 space-y-4"
        >
          {isRegisterMode && (
            <div>
              <label
                htmlFor="admin-display-name"
                className="block text-sm font-medium text-neutral-800"
              >
                Nama Tampilan Admin
              </label>
              <input
                ref={displayNameRef}
                id="admin-display-name"
                name="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Contoh: Admin Cabang Utama"
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
              {isRegisterMode ? 'Kata Sandi Baru' : 'Kata Sandi'}{' '}
              <span className="text-red-700">*</span>
            </label>
            <div className="relative mt-1.5">
              <input
                ref={passwordRef}
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegisterMode ? 'Minimal 6 karakter' : 'Masukkan kata sandi'}
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

          {isRegisterMode && (
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
              ? 'Memproses…'
              : isRegisterMode
                ? 'Buat Akun & Masuk'
                : 'Masuk'}
          </button>
        </form>

        {hasAnyAccount ? (
          <div className="mt-5 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onRequestResetLock}
              className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Lupa kata sandi? Reset akun & database lokal</span>
            </button>
          </div>
        ) : (
          <p className="mt-4 text-xs text-neutral-600">
            Kata sandi disimpan sebagai hash SHA-256 di perangkat ini dengan database terpisah per akun.
          </p>
        )}
      </div>
    </div>
  );
}
