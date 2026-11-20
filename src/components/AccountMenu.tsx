// Modul akun di pojok kanan atas dengan dropdown profil, manajemen akun (Admin), ubah sandi lokal, dan menu keluar.

import { ChevronDown, KeyRound, Lock, LogOut, ShieldCheck, User, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { updateAccountPassword } from '../lib/adminLock';
import type { UserAccount } from '../lib/types';

interface AccountMenuProps {
  currentAccount: UserAccount;
  displayLabel: string;
  onOpenAccountManagement: () => void;
  onPasswordUpdated: (updatedAccount: UserAccount) => void;
  onSignOut: () => void;
}

export function AccountMenu({
  currentAccount,
  displayLabel,
  onOpenAccountManagement,
  onPasswordUpdated,
  onSignOut,
}: AccountMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentAccount.role === 'ADMIN';
  const roleLabel = currentAccount.is_master
    ? 'Admin Master'
    : isAdmin
      ? 'Admin'
      : 'Terapis';

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const openChangePassword = () => {
    setMenuOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    setPwError(null);
    setPwModalOpen(true);
    setTimeout(() => newPasswordRef.current?.focus(), 0);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPwError('Kata sandi baru minimal 6 karakter.');
      newPasswordRef.current?.focus();
      return;
    }
    if (confirmPassword !== newPassword) {
      setPwError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSaving(true);
    setPwError(null);
    try {
      const updated = await updateAccountPassword(currentAccount, newPassword);
      onPasswordUpdated(updated);
      setPwModalOpen(false);
    } catch {
      setPwError('Gagal menyimpan kata sandi baru.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
            {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
          </span>
          <span className="max-w-[140px] truncate text-left">
            <span className="block truncate text-sm font-semibold leading-tight text-neutral-900">
              {displayLabel}
            </span>
            <span className="block text-xs font-normal leading-tight text-neutral-600">
              {roleLabel}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-150 ${
              menuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="Menu akun pengguna"
            className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]"
          >
            <div className="border-b border-neutral-200 px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {displayLabel}
              </p>
              <p className="truncate text-xs text-neutral-600">
                {currentAccount.username} · {roleLabel}
              </p>
            </div>

            <div className="mt-1.5 space-y-1">
              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenAccountManagement();
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-amber-700"
                >
                  <Users className="h-4 w-4 text-neutral-600" />
                  <span>Manajemen Akun</span>
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={openChangePassword}
                className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-amber-700"
              >
                <KeyRound className="h-4 w-4 text-neutral-600" />
                <span>Ubah Kata Sandi</span>
              </button>
            </div>

            <div className="mt-1.5 border-t border-neutral-200 pt-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
                className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-amber-700"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Ubah Kata Sandi Sendiri */}
      {pwModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="self-password-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
              <div className="flex items-center gap-2.5">
                <Lock className="h-5 w-5 text-amber-700" />
                <h2 id="self-password-title" className="text-lg font-semibold text-neutral-900">
                  Ubah Kata Sandi
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPwModalOpen(false)}
                aria-label="Tutup ubah kata sandi"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {pwError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {pwError}
              </div>
            )}

            <form onSubmit={handleSavePassword} noValidate className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="self-new-password"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Kata Sandi Baru
                </label>
                <input
                  ref={newPasswordRef}
                  id="self-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
              </div>

              <div>
                <label
                  htmlFor="self-confirm-password"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  id="self-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setPwModalOpen(false)}
                  className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-[44px] rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60 whitespace-nowrap"
                >
                  {isSaving ? 'Menyimpan…' : 'Simpan Sandi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
