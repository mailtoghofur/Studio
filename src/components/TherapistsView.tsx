// Manajemen profil, penambahan terapis baru, status aktif, dan akses akun username/password terapis (FT-06).

import { CheckCircle2, KeyRound, Plus, UserCheck, UserX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createUserAccount } from '../lib/adminLock';
import type { Therapist, UserAccount } from '../lib/types';

interface TherapistsViewProps {
  therapists: Therapist[];
  accounts: UserAccount[];
  allAccounts: UserAccount[];
  ownerAccountId: string;
  onRequestSaveTherapists: (nextTherapists: Therapist[]) => void;
  onAddTherapistWithOptionalAccount: (
    newTherapist: Therapist,
    newAccount?: UserAccount
  ) => void;
  onOpenAccountsTab: () => void;
}

export function TherapistsView({
  therapists,
  accounts,
  allAccounts,
  ownerAccountId,
  onRequestSaveTherapists,
  onAddTherapistWithOptionalAccount,
  onOpenAccountsTab,
}: TherapistsViewProps) {
  const [drafts, setDrafts] = useState<Therapist[]>(therapists);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [createAccountAlso, setCreateAccountAlso] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [addErrors, setAddErrors] = useState<{
    name?: string;
    username?: string;
    password?: string;
  }>({});
  const [isAdding, setIsAdding] = useState(false);

  const newNameRef = useRef<HTMLInputElement>(null);
  const newUserRef = useRef<HTMLInputElement>(null);
  const newPassRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDrafts(therapists);
  }, [therapists]);

  const handleSubmitList = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = drafts.map((t) => ({ ...t, name: t.name.trim() }));
    if (cleaned.some((t) => !t.name)) {
      setErrorMsg('Semua nama terapis wajib diisi, contoh: Sari Wulandari.');
      return;
    }
    setErrorMsg(null);
    onRequestSaveTherapists(cleaned);
  };

  const openAddModal = () => {
    setNewName('');
    setCreateAccountAlso(true);
    setNewUsername('');
    setNewPassword('');
    setAddErrors({});
    setAddOpen(true);
  };

  const generateNextTherapistId = (): string => {
    let maxNum = therapists.length;
    for (const t of therapists) {
      const m = /^T-(\d+)$/.exec(t.therapist_id);
      if (m) {
        const n = Number(m[1]);
        if (n > maxNum) maxNum = n;
      }
    }
    return `T-${String(maxNum + 1).padStart(2, '0')}`;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    const cleanUser = newUsername.trim();
    const nextErrors: { name?: string; username?: string; password?: string } = {};

    if (!cleanName) {
      nextErrors.name = 'Isi nama terapis baru, contoh: Maya Kusuma.';
    }

    if (createAccountAlso) {
      if (cleanUser.length < 3 || /\s/.test(cleanUser)) {
        nextErrors.username = 'Username minimal 3 karakter tanpa spasi, contoh: maya.terapis.';
      } else if (
        allAccounts.some((acc) => acc.username.trim().toLowerCase() === cleanUser.toLowerCase())
      ) {
        nextErrors.username = 'Username tersebut sudah dipakai akun lain. Pilih username berbeda.';
      }

      if (newPassword.length < 6) {
        nextErrors.password = 'Kata sandi minimal 6 karakter.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setAddErrors(nextErrors);
      if (nextErrors.name) newNameRef.current?.focus();
      else if (nextErrors.username) newUserRef.current?.focus();
      else if (nextErrors.password) newPassRef.current?.focus();
      return;
    }

    setIsAdding(true);
    try {
      const therapistId = generateNextTherapistId();
      const newTherapist: Therapist = {
        therapist_id: therapistId,
        name: cleanName,
        is_active: true,
      };

      let newAccount: UserAccount | undefined;
      if (createAccountAlso) {
        newAccount = await createUserAccount({
          username: cleanUser,
          display_name: cleanName,
          password: newPassword,
          role: 'THERAPIST',
          therapist_id: therapistId,
          owner_account_id: ownerAccountId,
          is_active: true,
        });
      }

      setAddOpen(false);
      onAddTherapistWithOptionalAccount(newTherapist, newAccount);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
            Data Terapis Klinik
          </h1>
          <p className="mt-1 text-sm text-neutral-600 tabular-nums">
            {therapists.length} terapis terdaftar · {therapists.filter((t) => t.is_active).length}{' '}
            terapis aktif menerima reservasi.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Terapis</span>
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmitList} noValidate className="mt-6 space-y-4">
        {drafts.map((therapist, idx) => {
          const linkedAccount = accounts.find(
            (acc) => acc.role === 'THERAPIST' && acc.therapist_id === therapist.therapist_id
          );

          return (
            <div
              key={therapist.therapist_id}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-end sm:justify-between"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor={`therapist-name-${therapist.therapist_id}`}
                    className="block text-sm font-medium text-neutral-800"
                  >
                    Terapis {idx + 1} ({therapist.therapist_id})
                  </label>
                  <span className="text-xs text-neutral-600">
                    {linkedAccount
                      ? `Akun: ${linkedAccount.username} (${
                          linkedAccount.is_active ? 'Aktif' : 'Nonaktif'
                        })`
                      : 'Belum ada akun login'}
                  </span>
                </div>
                <input
                  id={`therapist-name-${therapist.therapist_id}`}
                  type="text"
                  value={therapist.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDrafts((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                    );
                  }}
                  placeholder={`Contoh: Nama Terapis ${idx + 1}`}
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenAccountsTab}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>{linkedAccount ? 'Kelola Akun' : 'Buat Akun'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDrafts((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, is_active: !item.is_active } : item
                      )
                    )
                  }
                  aria-pressed={therapist.is_active}
                  className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                    therapist.is_active
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                  }`}
                >
                  {therapist.is_active ? (
                    <>
                      <UserCheck className="h-4 w-4" />
                      <span>Aktif</span>
                    </>
                  ) : (
                    <>
                      <UserX className="h-4 w-4" />
                      <span>Nonaktif</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        <div className="flex justify-end border-t border-neutral-200 pt-4">
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-5 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </form>

      {/* Modal Tambah Terapis Baru */}
      {addOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-therapist-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <h2 id="add-therapist-title" className="text-lg font-semibold text-neutral-900">
                  Tambah Terapis Baru
                </h2>
                <p className="mt-0.5 text-sm text-neutral-600">
                  Terapis baru langsung muncul sebagai kolom baru di kalender harian.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Tutup form tambah terapis"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} noValidate className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="new-therapist-name"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Nama Lengkap Terapis <span className="text-red-700">*</span>
                </label>
                <input
                  ref={newNameRef}
                  id="new-therapist-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Maya Kusuma"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                />
                {addErrors.name && (
                  <p className="mt-1.5 text-sm text-red-700">{addErrors.name}</p>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <input
                  type="checkbox"
                  checked={createAccountAlso}
                  onChange={(e) => setCreateAccountAlso(e.target.checked)}
                  className="h-4 w-4 accent-amber-700"
                />
                <span className="text-sm font-medium text-neutral-900">
                  Sekaligus buatkan akun login terapis
                </span>
              </label>

              {createAccountAlso && (
                <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
                  <div>
                    <label
                      htmlFor="new-therapist-username"
                      className="block text-sm font-medium text-neutral-800"
                    >
                      Nama Pengguna (Username) <span className="text-red-700">*</span>
                    </label>
                    <input
                      ref={newUserRef}
                      id="new-therapist-username"
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Contoh: maya.terapis"
                      className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                    />
                    {addErrors.username && (
                      <p className="mt-1 text-sm text-red-700">{addErrors.username}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="new-therapist-password"
                      className="block text-sm font-medium text-neutral-800"
                    >
                      Kata Sandi Awal <span className="text-red-700">*</span>
                    </label>
                    <input
                      ref={newPassRef}
                      id="new-therapist-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="mt-1.5 min-h-[44px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                    />
                    {addErrors.password && (
                      <p className="mt-1 text-sm text-red-700">{addErrors.password}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="min-h-[44px] rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60 whitespace-nowrap"
                >
                  {isAdding ? 'Menambahkan…' : 'Simpan Terapis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
