// Manajemen akun Admin Master, Admin tambahan, dan Terapis yang tersimpan sederhana di browser (FT-07).

import { KeyRound, Plus, ShieldCheck, Trash2, UserCheck, UserX, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { createUserAccount, getWorkspaceOwnerId, updateAccountPassword } from '../lib/adminLock';
import type { Therapist, UserAccount, UserRole } from '../lib/types';

interface AccountsViewProps {
  accounts: UserAccount[];
  allAccounts: UserAccount[];
  therapists: Therapist[];
  currentAccount: UserAccount;
  onCreateAccount: (account: UserAccount) => void;
  onUpdateAccount: (account: UserAccount) => void;
  onRequestDeleteAccount: (account: UserAccount) => void;
}

export function AccountsView({
  accounts,
  allAccounts,
  therapists,
  currentAccount,
  onCreateAccount,
  onUpdateAccount,
  onRequestDeleteAccount,
}: AccountsViewProps) {
  const therapistMap = useMemo(
    () => new Map(therapists.map((t) => [t.therapist_id, t])),
    [therapists]
  );

  const currentOwnerId = getWorkspaceOwnerId(currentAccount);

  const [createOpen, setCreateOpen] = useState(false);
  const [role, setRole] = useState<UserRole>('THERAPIST');
  const [adminDbMode, setAdminDbMode] = useState<'shared' | 'separate'>('shared');
  const [therapistId, setTherapistId] = useState(therapists[0]?.therapist_id ?? '');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<{
    username?: string;
    displayName?: string;
    therapistId?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  const usernameRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const activeWorkspaceAdminCount = accounts.filter(
    (a) =>
      getWorkspaceOwnerId(a) === currentOwnerId &&
      a.role === 'ADMIN' &&
      a.is_active
  ).length;

  const openCreateModal = () => {
    const unassigned = therapists.find(
      (t) =>
        !accounts.some(
          (a) =>
            getWorkspaceOwnerId(a) === currentOwnerId &&
            a.role === 'THERAPIST' &&
            a.therapist_id === t.therapist_id
        )
    );
    const chosen = unassigned ?? therapists[0];
    setRole('THERAPIST');
    setAdminDbMode('shared');
    setTherapistId(chosen?.therapist_id ?? '');
    setDisplayName(chosen?.name ?? '');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setFormErrors({});
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanDisplay =
      role === 'THERAPIST'
        ? therapistMap.get(therapistId)?.name ?? displayName.trim()
        : displayName.trim();

    const errs: typeof formErrors = {};
    if (cleanUser.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(cleanUser)) {
      errs.username =
        'Username minimal 3 karakter (huruf, angka, titik, garis bawah), contoh: sari.terapis.';
    } else if (
      allAccounts.some((a) => a.username.trim().toLowerCase() === cleanUser.toLowerCase())
    ) {
      errs.username = 'Username sudah terdaftar. Gunakan username lain.';
    }

    if (role === 'ADMIN' && !cleanDisplay) {
      errs.displayName = 'Isi nama tampilan admin, contoh: Admin Shift Sore.';
    }
    if (role === 'THERAPIST' && !therapistId) {
      errs.therapistId = 'Pilih terapis yang akan dihubungkan ke akun ini.';
    }
    if (password.length < 6) {
      errs.password = 'Kata sandi minimal 6 karakter.';
    }
    if (confirmPassword !== password) {
      errs.confirmPassword = 'Konfirmasi kata sandi harus sama dengan kata sandi baru.';
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      if (errs.username) usernameRef.current?.focus();
      else if (errs.displayName) displayNameRef.current?.focus();
      else if (errs.password) passwordRef.current?.focus();
      else if (errs.confirmPassword) confirmRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const useSharedDb = role === 'THERAPIST' || adminDbMode === 'shared';
      const created = await createUserAccount({
        username: cleanUser,
        display_name: cleanDisplay || cleanUser,
        password,
        role,
        therapist_id: role === 'THERAPIST' ? therapistId : undefined,
        owner_account_id: useSharedDb ? currentOwnerId : undefined,
        created_by_owner_id: currentOwnerId,
        is_master: false,
      });
      onCreateAccount(created);
      setCreateOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (resetPassword.length < 6) {
      setResetError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (resetConfirm !== resetPassword) {
      setResetError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateAccountPassword(resetTarget, resetPassword);
      onUpdateAccount(updated);
      setResetTarget(null);
      setResetPassword('');
      setResetConfirm('');
      setResetError(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
            Manajemen Akun Admin & Terapis
          </h1>
          <p className="mt-1 text-sm text-neutral-600 tabular-nums">
            {accounts.length} akun terdaftar tersimpan lokal di browser sesuai database masing-masing.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Buat Akun Baru</span>
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
              <th className="px-4 py-3 font-semibold">Nama & Akses Database</th>
              <th className="px-4 py-3 font-semibold">Username</th>
              <th className="px-4 py-3 font-semibold">Peran</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {accounts.map((acc) => {
              const linkedTherapist = acc.therapist_id
                ? therapistMap.get(acc.therapist_id)
                : undefined;
              const isSelf = acc.account_id === currentAccount.account_id;
              const isSeparateDb = getWorkspaceOwnerId(acc) !== currentOwnerId;
              const isProtectedMaster = acc.is_master;
              const isLastActiveAdmin =
                !isSeparateDb &&
                acc.role === 'ADMIN' &&
                acc.is_active &&
                activeWorkspaceAdminCount <= 1;

              return (
                <tr key={acc.account_id} className="hover:bg-neutral-50/70">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-neutral-900">
                      {linkedTherapist?.name ?? acc.display_name}
                      {isSelf && (
                        <span className="ml-2 text-xs font-medium text-amber-800">
                          (Akun Anda)
                        </span>
                      )}
                    </p>
                    {acc.role === 'THERAPIST' ? (
                      <p className="text-xs text-neutral-600 tabular-nums">
                        ID Terapis: {acc.therapist_id}
                      </p>
                    ) : isSeparateDb ? (
                      <p className="text-xs text-amber-800">Database terpisah</p>
                    ) : acc.is_master ? (
                      <p className="text-xs text-amber-800">Akun Admin Master</p>
                    ) : (
                      <p className="text-xs text-neutral-600">Berbagi database klinik ini</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-800">{acc.username}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {acc.role === 'ADMIN' ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                        <ShieldCheck className="h-4 w-4" />
                        <span>{acc.is_master ? 'Admin Master' : 'Admin'}</span>
                      </span>
                    ) : (
                      <span>Terapis</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium ${
                        acc.is_active ? 'text-emerald-800' : 'text-red-700'
                      }`}
                    >
                      {acc.is_active ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <UserX className="h-4 w-4" />
                      )}
                      <span>{acc.is_active ? 'Aktif' : 'Nonaktif'}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResetTarget(acc);
                          setResetPassword('');
                          setResetConfirm('');
                          setResetError(null);
                        }}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm font-medium text-neutral-800 hover:bg-neutral-50 whitespace-nowrap"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>Ubah Sandi</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProtectedMaster || isLastActiveAdmin || isSelf}
                        onClick={() =>
                          onUpdateAccount({
                            ...acc,
                            is_active: !acc.is_active,
                            updated_at: new Date().toISOString(),
                          })
                        }
                        title={
                          isProtectedMaster
                            ? 'Akun Admin Master tidak dapat dinonaktifkan'
                            : isLastActiveAdmin
                              ? 'Minimal harus ada 1 akun Admin yang aktif'
                              : undefined
                        }
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                      >
                        {acc.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>

                      <button
                        type="button"
                        disabled={isSelf || isProtectedMaster || isLastActiveAdmin}
                        onClick={() => onRequestDeleteAccount(acc)}
                        aria-label={`Hapus akun ${acc.username}`}
                        className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-sm font-medium text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Buat Akun Baru */}
      {createOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-account-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
              <h2 id="create-account-title" className="text-lg font-semibold text-neutral-900">
                Buat Akun Login Baru
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Tutup form buat akun"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} noValidate className="mt-5 space-y-4">
              <div>
                <span className="block text-sm font-medium text-neutral-800">Peran Akun</span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(
                    [
                      { value: 'THERAPIST', label: 'Terapis' },
                      { value: 'ADMIN', label: 'Admin Klinik' },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.value}
                      className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2 ${
                        role === item.value
                          ? 'border-amber-700 bg-amber-50 text-neutral-900'
                          : 'border-neutral-200 bg-white text-neutral-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="accountRole"
                        value={item.value}
                        checked={role === item.value}
                        onChange={() => setRole(item.value)}
                        className="h-4 w-4 accent-amber-700"
                      />
                      <span className="text-sm font-medium">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {role === 'THERAPIST' ? (
                <div>
                  <label
                    htmlFor="account-therapist-select"
                    className="block text-sm font-medium text-neutral-800"
                  >
                    Pilih Terapis <span className="text-red-700">*</span>
                  </label>
                  <select
                    id="account-therapist-select"
                    value={therapistId}
                    onChange={(e) => setTherapistId(e.target.value)}
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                  >
                    {therapists.map((t) => (
                      <option key={t.therapist_id} value={t.therapist_id}>
                        {t.name} ({t.therapist_id})
                      </option>
                    ))}
                  </select>
                  {formErrors.therapistId && (
                    <p className="mt-1.5 text-sm text-red-700">{formErrors.therapistId}</p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="account-display-name"
                      className="block text-sm font-medium text-neutral-800"
                    >
                      Nama Tampilan Admin <span className="text-red-700">*</span>
                    </label>
                    <input
                      ref={displayNameRef}
                      id="account-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Contoh: Admin Shift Sore"
                      className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                    />
                    {formErrors.displayName && (
                      <p className="mt-1.5 text-sm text-red-700">{formErrors.displayName}</p>
                    )}
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-neutral-800">
                      Penyimpanan Database
                    </span>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(
                        [
                          { value: 'shared', label: 'Gabung database ini' },
                          { value: 'separate', label: 'Database baru terpisah' },
                        ] as const
                      ).map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 ${
                            adminDbMode === opt.value
                              ? 'border-amber-700 bg-amber-50 text-neutral-900'
                              : 'border-neutral-200 bg-white text-neutral-800'
                          }`}
                        >
                          <input
                            type="radio"
                            name="adminDbMode"
                            value={opt.value}
                            checked={adminDbMode === opt.value}
                            onChange={() => setAdminDbMode(opt.value)}
                            className="h-4 w-4 accent-amber-700"
                          />
                          <span className="text-sm font-medium">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="account-username"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Nama Pengguna (Username) <span className="text-red-700">*</span>
                </label>
                <input
                  ref={usernameRef}
                  id="account-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: sari.terapis"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                {formErrors.username && (
                  <p className="mt-1.5 text-sm text-red-700">{formErrors.username}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="account-password"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Kata Sandi <span className="text-red-700">*</span>
                </label>
                <input
                  ref={passwordRef}
                  id="account-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                {formErrors.password && (
                  <p className="mt-1.5 text-sm text-red-700">{formErrors.password}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="account-confirm"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Ulangi Kata Sandi <span className="text-red-700">*</span>
                </label>
                <input
                  ref={confirmRef}
                  id="account-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                {formErrors.confirmPassword && (
                  <p className="mt-1.5 text-sm text-red-700">{formErrors.confirmPassword}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-[44px] rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60 whitespace-nowrap"
                >
                  {isSaving ? 'Menyimpan…' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ubah Kata Sandi Akun */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-pw-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <h2 id="reset-pw-title" className="text-lg font-semibold text-neutral-900">
                  Ubah Kata Sandi Akun
                </h2>
                <p className="mt-0.5 text-sm text-neutral-600">
                  Akun: <strong>{resetTarget.username}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                aria-label="Tutup form ubah sandi"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {resetError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} noValidate className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="reset-password-input"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Kata Sandi Baru
                </label>
                <input
                  id="reset-password-input"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
              </div>

              <div>
                <label
                  htmlFor="reset-password-confirm"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  id="reset-password-confirm"
                  type="password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
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
    </section>
  );
}
