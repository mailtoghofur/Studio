// Layar masuk lokal dengan username dan kata sandi, pengaturan awal Admin Master, serta impor Paket Master lintas browser.

import { Eye, EyeOff, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { CLINIC_LOGO_SRC, CLINIC_NAME } from '../config';
import { createUserAccount, verifyAccountLogin } from '../lib/adminLock';
import { parseMasterBundleJson, restoreMasterBundle } from '../lib/database';
import type { UserAccount } from '../lib/types';

interface AdminLockScreenProps {
  accounts: UserAccount[];
  onLoginSuccess: (account: UserAccount) => void;
  onMasterSetupSuccess: (masterAccount: UserAccount) => void;
  onImportMasterBundle: (restoredAccounts: UserAccount[]) => void;
  onResetAllData: () => void;
}

export function AdminLockScreen({
  accounts,
  onLoginSuccess,
  onMasterSetupSuccess,
  onImportMasterBundle,
  onResetAllData,
}: AdminLockScreenProps) {
  const isInitialSetup = accounts.length === 0;

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const bundleInputRef = useRef<HTMLInputElement>(null);

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
    setInfoMsg(null);
    try {
      const masterAccount = await createUserAccount({
        username: cleanUser,
        display_name: cleanDisplay || 'Admin Master',
        password,
        role: 'ADMIN',
        is_master: true,
      });
      onMasterSetupSuccess(masterAccount);
    } catch {
      setErrorMsg('Gagal membuat akun Admin Master di browser.');
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
    setInfoMsg(null);
    try {
      const result = await verifyAccountLogin(accounts, cleanUser, password);
      if (!result.ok) {
        setErrorMsg(result.error);
        passwordRef.current?.focus();
        return;
      }
      onLoginSuccess(result.account);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBundleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const text = await file.text();
      const parsed = parseMasterBundleJson(text);
      const restoredAccounts = restoreMasterBundle(parsed);
      onImportMasterBundle(restoredAccounts);
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setInfoMsg(
        `Paket Master berhasil dipulihkan (${restoredAccounts.length} akun). Silakan masuk dengan username dan kata sandi Anda.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal membaca file Paket Master. Pastikan file berasal dari ekspor aplikasi.'
      );
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
              {isInitialSetup ? 'Atur Akun Admin Master' : 'Masuk Aplikasi Klinik'}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              {isInitialSetup
                ? 'Buat satu akun Admin Master untuk mengelola klinik dan akun staf.'
                : 'Masukkan username dan kata sandi akun Admin Master, Admin, atau Terapis.'}
            </p>
          </div>
        </div>

        {infoMsg && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {infoMsg}
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
              ? 'Memproses…'
              : isInitialSetup
                ? 'Buat Akun Master & Masuk'
                : 'Masuk'}
          </button>
        </form>

        <div className="mt-5 space-y-3 border-t border-neutral-200 pt-4">
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
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          >
            <Upload className="h-4 w-4 text-amber-700" />
            <span>Impor Paket Master dari Browser Lain (.json)</span>
          </button>

          {!isInitialSetup && !confirmResetOpen && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-neutral-600">
                Pembuatan akun baru tersedia di menu Manajemen Akun.
              </p>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="shrink-0 text-xs font-medium text-red-700 underline hover:text-red-800"
              >
                Reset lokal
              </button>
            </div>
          )}

          {!isInitialSetup && confirmResetOpen && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <p className="font-semibold">Hapus semua akun dan database di browser ini?</p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmResetOpen(false);
                    onResetAllData();
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Ya, Hapus Semua</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(false)}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
