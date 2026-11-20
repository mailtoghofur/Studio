// Komponen utama aplikasi penjadwalan Naomi Beauty & Wellness dengan login username/password dan database terpisah per akun.

import {
  BarChart3,
  Calendar,
  Database,
  Plus,
  Scissors,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccountMenu } from './components/AccountMenu';
import { AccountsView } from './components/AccountsView';
import { AdminLockScreen } from './components/AdminLockScreen';
import { BookingDetailModal } from './components/BookingDetailModal';
import { BookingFormModal } from './components/BookingFormModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DailyCalendarView } from './components/DailyCalendarView';
import { DatabasePanel } from './components/DatabasePanel';
import { RevenueSummaryView } from './components/RevenueSummaryView';
import { ServicesView } from './components/ServicesView';
import { TherapistsView } from './components/TherapistsView';
import {
  CLINIC_LOGO_SRC,
  CLINIC_NAME,
  DEFAULT_SERVICES,
  DEFAULT_THERAPISTS,
  STATUS_LABELS,
  STORAGE_KEY,
} from './config';
import {
  getWorkspaceOwnerId,
  migrateLegacyLockToAccount,
  type AdminLockRecord,
} from './lib/adminLock';
import {
  clearAllAccountDatabases,
  deleteAccountDatabase,
  loadAccountDatabase,
  resetAccountDatabase,
  saveAccountDatabase,
} from './lib/database';
import {
  formatDateIndo,
  formatTimeRange,
  getTodayYYYYMMDD,
} from './lib/format';
import type {
  AccountDatabase,
  Booking,
  BookingStatus,
  ConfirmDialogState,
  Service,
  Therapist,
  UserAccount,
} from './lib/types';

type ActiveTab = 'calendar' | 'services' | 'therapists' | 'revenue' | 'accounts' | 'database';

interface LegacySeedData {
  therapists?: Therapist[];
  services?: Service[];
  bookings?: Booking[];
}

interface StoredAccountsDirectory {
  adminLock?: AdminLockRecord | null;
  accounts?: UserAccount[];
  therapists?: Therapist[];
  services?: Service[];
  bookings?: Booking[];
}

function isValidPasswordAccount(item: unknown): item is UserAccount {
  if (!item || typeof item !== 'object') return false;
  const acc = item as Partial<UserAccount>;
  return (
    typeof acc.account_id === 'string' &&
    typeof acc.username === 'string' &&
    typeof acc.salt === 'string' &&
    acc.salt.length > 0 &&
    typeof acc.hash === 'string' &&
    acc.hash.length > 0 &&
    (acc.role === 'ADMIN' || acc.role === 'THERAPIST')
  );
}

function readInitialDirectory(): {
  accounts: UserAccount[];
  legacySeed?: LegacySeedData;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accounts: [] };
    const parsed = JSON.parse(raw) as StoredAccountsDirectory;
    if (!parsed || typeof parsed !== 'object') return { accounts: [] };

    const rawLock = parsed.adminLock;
    const validLock =
      rawLock &&
      typeof rawLock === 'object' &&
      typeof rawLock.username === 'string' &&
      typeof rawLock.salt === 'string' &&
      rawLock.salt.length > 0 &&
      typeof rawLock.hash === 'string' &&
      rawLock.hash.length > 0
        ? rawLock
        : null;

    const storedAccounts = Array.isArray(parsed.accounts)
      ? parsed.accounts.filter(isValidPasswordAccount)
      : [];

    const accounts =
      storedAccounts.length > 0
        ? storedAccounts
        : migrateLegacyLockToAccount(validLock);

    const hasLegacyTherapists = Array.isArray(parsed.therapists) && parsed.therapists.length > 0;
    const hasLegacyServices = Array.isArray(parsed.services) && parsed.services.length > 0;
    const hasLegacyBookings = Array.isArray(parsed.bookings) && parsed.bookings.length > 0;

    const legacySeed =
      hasLegacyTherapists || hasLegacyServices || hasLegacyBookings
        ? {
            therapists: hasLegacyTherapists ? parsed.therapists : undefined,
            services: hasLegacyServices ? parsed.services : undefined,
            bookings: hasLegacyBookings ? parsed.bookings : undefined,
          }
        : undefined;

    return { accounts, legacySeed };
  } catch {
    return { accounts: [] };
  }
}

function writeAccountsDirectory(accounts: UserAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts }));
  } catch {
    // Abaikan jika penyimpanan browser dibatasi
  }
}

export default function App() {
  const [initialDirectory] = useState(() => readInitialDirectory());
  const legacySeedRef = useRef<LegacySeedData | undefined>(initialDirectory.legacySeed);

  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayYYYYMMDD);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<UserAccount[]>(
    () => initialDirectory.accounts
  );
  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(null);
  const [accountDb, setAccountDb] = useState<AccountDatabase | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [prefillSlot, setPrefillSlot] = useState<{
    therapistId?: string;
    startTime?: string;
  }>({});
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Simpan direktori akun di kunci utama localStorage
  useEffect(() => {
    if (!legacySeedRef.current) {
      writeAccountsDirectory(accounts);
    }
  }, [accounts]);

  // Simpan database terpisah milik akun aktif setiap kali ada perubahan
  useEffect(() => {
    if (accountDb) {
      saveAccountDatabase(accountDb);
    }
  }, [accountDb]);

  const openWorkspaceForAccount = (
    account: UserAccount,
    directoryAccounts: UserAccount[],
    allowLegacySeed: boolean
  ) => {
    const ownerId = getWorkspaceOwnerId(account);
    const ownerAcc = directoryAccounts.find((a) => a.account_id === ownerId);
    const ownerUsername = ownerAcc?.username ?? account.username;

    const loadedDb = loadAccountDatabase(
      ownerId,
      ownerUsername,
      allowLegacySeed ? legacySeedRef.current : undefined
    );

    if (allowLegacySeed && legacySeedRef.current) {
      legacySeedRef.current = undefined;
      writeAccountsDirectory(directoryAccounts);
    }

    setAccountDb(loadedDb);
    setCurrentAccount(account);
    setActiveTab('calendar');
  };

  const handleLoginSuccess = (account: UserAccount) => {
    setNoticeMessage(null);
    openWorkspaceForAccount(account, accounts, true);
  };

  const handleCreateAdminAccount = (newAdmin: UserAccount) => {
    const isFirstAccount = accounts.length === 0;
    const nextAccounts = [...accounts, newAdmin];
    setAccounts(nextAccounts);
    openWorkspaceForAccount(newAdmin, nextAccounts, isFirstAccount);
    setNoticeMessage(
      `Akun Admin "${newAdmin.username}" berhasil dibuat dengan database tersendiri.`
    );
  };

  const handleSignOut = () => {
    setCurrentAccount(null);
    setAccountDb(null);
    setSelectedBooking(null);
    setEditingBooking(null);
    setFormOpen(false);
    setNoticeMessage(null);
  };

  const handleRequestResetLock = () => {
    setConfirmDialog({
      title: 'Reset Seluruh Akun & Database Lokal?',
      message:
        'Tindakan ini menghapus semua akun login serta seluruh database jadwal lokal di browser ini agar Anda dapat mengatur ulang dari awal.',
      confirmLabel: 'Ya, Reset Semua',
      tone: 'danger',
      onConfirm: async () => {
        legacySeedRef.current = undefined;
        clearAllAccountDatabases();
        setAccounts([]);
        setCurrentAccount(null);
        setAccountDb(null);
        writeAccountsDirectory([]);
      },
    });
  };

  const updateAccountDb = (updater: (prev: AccountDatabase) => AccountDatabase) => {
    setAccountDb((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      return {
        ...next,
        updated_at: new Date().toISOString(),
      };
    });
  };

  const handleOpenCreateModal = (therapistId?: string, startTime?: string) => {
    setEditingBooking(null);
    setPrefillSlot({ therapistId, startTime });
    setFormOpen(true);
  };

  const handleRequestSaveBooking = (payload: {
    mode: 'create' | 'reschedule';
    booking: Booking;
    serviceName: string;
    therapistName: string;
  }) => {
    const { mode, booking } = payload;
    const isReschedule = mode === 'reschedule';

    updateAccountDb((prev) => ({
      ...prev,
      bookings: isReschedule
        ? prev.bookings.map((b) => (b.booking_id === booking.booking_id ? booking : b))
        : [...prev.bookings, booking],
    }));

    if (isReschedule) {
      setNoticeMessage(`Jadwal ${booking.patient_name} berhasil diperbarui.`);
    } else {
      setSelectedDate(booking.booking_date);
      setNoticeMessage(`Reservasi ${booking.patient_name} berhasil disimpan.`);
    }
    setFormOpen(false);
    setEditingBooking(null);
  };

  const handleRequestStatusChange = (booking: Booking, nextStatus: BookingStatus) => {
    const isCancel = nextStatus === 'CANCELLED';
    const nextLabel = STATUS_LABELS[nextStatus];

    const applyStatus = () => {
      const updated: Booking = {
        ...booking,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };
      updateAccountDb((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) => (b.booking_id === updated.booking_id ? updated : b)),
      }));
      setSelectedBooking(null);
      setNoticeMessage(`Status reservasi ${booking.patient_name} diubah menjadi ${nextLabel}.`);
    };

    if (!isCancel) {
      applyStatus();
      return;
    }

    setConfirmDialog({
      title: 'Batalkan Reservasi Ini?',
      message:
        'Status reservasi akan diubah menjadi Dibatalkan dan slot terapis langsung tersedia kembali.',
      details: [
        `Pasien: ${booking.patient_name}`,
        `Jadwal: ${formatDateIndo(booking.booking_date)} · ${formatTimeRange(booking.start_time, booking.end_time)} WIB`,
        `Perubahan status: ${STATUS_LABELS[booking.status]} -> ${nextLabel}`,
      ],
      confirmLabel: 'Ya, Batalkan Jadwal',
      tone: 'danger',
      onConfirm: async () => {
        applyStatus();
      },
    });
  };

  const handleRequestSaveService = (mode: 'create' | 'edit', service: Service) => {
    const isEdit = mode === 'edit';
    updateAccountDb((prev) => ({
      ...prev,
      services: isEdit
        ? prev.services.map((s) => (s.service_id === service.service_id ? service : s))
        : [...prev.services, service],
    }));
    setNoticeMessage(
      isEdit
        ? `Layanan "${service.service_name}" berhasil diperbarui.`
        : `Layanan "${service.service_name}" berhasil ditambahkan.`
    );
  };

  const handleRequestSaveTherapists = (nextTherapists: Therapist[]) => {
    updateAccountDb((prev) => ({
      ...prev,
      therapists: nextTherapists,
    }));
    setNoticeMessage('Data terapis berhasil diperbarui.');
  };

  const handleAddTherapist = (newTherapist: Therapist) => {
    updateAccountDb((prev) => ({
      ...prev,
      therapists: [...prev.therapists, newTherapist],
    }));
    setNoticeMessage(
      `Terapis "${newTherapist.name}" berhasil ditambahkan. Gunakan menu Manajemen Akun untuk membuatkan akun login.`
    );
  };

  const handleCreateAccount = (newAcc: UserAccount) => {
    setAccounts((prev) => [...prev, newAcc]);
    const isSeparateDb = getWorkspaceOwnerId(newAcc) !== activeOwnerId;
    if (isSeparateDb) {
      loadAccountDatabase(newAcc.account_id, newAcc.username);
      setNoticeMessage(
        `Akun Admin "${newAcc.username}" berhasil dibuat dengan database baru terpisah.`
      );
    } else {
      setNoticeMessage(`Akun "${newAcc.username}" berhasil dibuat.`);
    }
  };

  const handleUpdateAccount = (updatedAcc: UserAccount) => {
    setAccounts((prev) =>
      prev.map((a) => (a.account_id === updatedAcc.account_id ? updatedAcc : a))
    );
    if (currentAccount?.account_id === updatedAcc.account_id) {
      setCurrentAccount(updatedAcc);
    }
    if (accountDb && accountDb.owner_account_id === updatedAcc.account_id) {
      setAccountDb((prev) =>
        prev
          ? {
              ...prev,
              owner_username: updatedAcc.username,
            }
          : prev
      );
    }
    setNoticeMessage(`Akun "${updatedAcc.username}" berhasil diperbarui.`);
  };

  const handleRequestDeleteAccount = (targetAcc: UserAccount) => {
    const ownsSeparateDb =
      targetAcc.role === 'ADMIN' &&
      getWorkspaceOwnerId(targetAcc) === targetAcc.account_id &&
      getWorkspaceOwnerId(targetAcc) !== activeOwnerId;

    setConfirmDialog({
      title: 'Hapus Akun Login Ini?',
      message: ownsSeparateDb
        ? `Akun "${targetAcc.username}" beserta database terpisah miliknya akan dihapus dan tidak dapat digunakan lagi.`
        : `Akun "${targetAcc.username}" tidak akan bisa digunakan lagi untuk masuk ke aplikasi.`,
      confirmLabel: 'Ya, Hapus Akun',
      tone: 'danger',
      onConfirm: async () => {
        if (ownsSeparateDb) {
          deleteAccountDatabase(targetAcc.account_id);
        }
        setAccounts((prev) =>
          prev.filter((a) => a.account_id !== targetAcc.account_id)
        );
        setNoticeMessage(`Akun "${targetAcc.username}" telah dihapus.`);
      },
    });
  };

  const handleRequestImportDatabase = (importedDb: AccountDatabase) => {
    setConfirmDialog({
      title: `Pulihkan Database Akun (${importedDb.owner_username})?`,
      message:
        'Seluruh data terapis, layanan, dan reservasi di database akun ini akan diganti dengan isi file JSON cadangan yang dipilih.',
      details: [
        `Terapis: ${importedDb.therapists.length} data`,
        `Layanan: ${importedDb.services.length} paket`,
        `Reservasi: ${importedDb.bookings.length} jadwal`,
      ],
      confirmLabel: 'Ya, Pulihkan Database',
      tone: 'primary',
      onConfirm: async () => {
        saveAccountDatabase(importedDb);
        setAccountDb(importedDb);
        setNoticeMessage(
          `Database akun "${importedDb.owner_username}" berhasil dipulihkan dari file JSON.`
        );
      },
    });
  };

  const handleRequestResetDatabase = () => {
    if (!accountDb) return;
    setConfirmDialog({
      title: `Reset Database Akun (${accountDb.owner_username})?`,
      message:
        'Seluruh riwayat reservasi di akun ini akan dihapus, sedangkan data terapis dan layanan dikembalikan ke pengaturan awal. Database akun lain tidak terpengaruh.',
      confirmLabel: 'Ya, Reset Database Akun',
      tone: 'danger',
      onConfirm: async () => {
        const fresh = resetAccountDatabase(
          accountDb.owner_account_id,
          accountDb.owner_username
        );
        setAccountDb(fresh);
        setNoticeMessage(`Database akun "${fresh.owner_username}" telah direset ke awal.`);
      },
    });
  };

  const activeOwnerId = currentAccount ? getWorkspaceOwnerId(currentAccount) : '';
  const workspaceAccounts = useMemo(
    () => accounts.filter((acc) => getWorkspaceOwnerId(acc) === activeOwnerId),
    [accounts, activeOwnerId]
  );
  const managedAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          getWorkspaceOwnerId(acc) === activeOwnerId ||
          acc.created_by_owner_id === activeOwnerId
      ),
    [accounts, activeOwnerId]
  );

  const therapists = accountDb?.therapists ?? DEFAULT_THERAPISTS;
  const services = accountDb?.services ?? DEFAULT_SERVICES;
  const bookings = accountDb?.bookings ?? [];

  const selectedBookingService = selectedBooking
    ? services.find((s) => s.service_id === selectedBooking.service_id)
    : undefined;
  const selectedBookingTherapist = selectedBooking
    ? therapists.find((t) => t.therapist_id === selectedBooking.therapist_id)
    : undefined;

  if (!currentAccount || !accountDb) {
    return (
      <>
        <AdminLockScreen
          accounts={accounts}
          onLoginSuccess={handleLoginSuccess}
          onCreateAdminAccount={handleCreateAdminAccount}
          onRequestResetLock={handleRequestResetLock}
        />
        <ConfirmDialog
          dialog={confirmDialog}
          onClose={() => setConfirmDialog(null)}
        />
      </>
    );
  }

  const isAdmin = currentAccount.role === 'ADMIN';
  const activeTherapistProfile =
    currentAccount.role === 'THERAPIST' && currentAccount.therapist_id
      ? therapists.find((t) => t.therapist_id === currentAccount.therapist_id)
      : undefined;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Bilah navigasi atas */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <img
              src={CLINIC_LOGO_SRC}
              alt={`Logo ${CLINIC_NAME}`}
              className="h-10 w-10 shrink-0 rounded-full border border-neutral-200 object-cover"
            />
            <span className="shrink-0 whitespace-nowrap text-lg font-bold tracking-tight text-neutral-900">
              {CLINIC_NAME}
            </span>
          </div>

          <nav
            aria-label="Navigasi utama"
            className="flex items-center gap-4 overflow-x-auto text-sm font-medium text-neutral-600"
          >
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                activeTab === 'calendar'
                  ? 'border-amber-700 text-amber-800'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>{isAdmin ? 'Jadwal Harian' : 'Jadwal Saya'}</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('services')}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                    activeTab === 'services'
                      ? 'border-amber-700 text-amber-800'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Scissors className="h-4 w-4" />
                  <span>Layanan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('therapists')}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                    activeTab === 'therapists'
                      ? 'border-amber-700 text-amber-800'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Terapis</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('revenue')}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                    activeTab === 'revenue'
                      ? 'border-amber-700 text-amber-800'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Pendapatan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('database')}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                    activeTab === 'database'
                      ? 'border-amber-700 text-amber-800'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Database className="h-4 w-4" />
                  <span>Database</span>
                </button>
              </>
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleOpenCreateModal(undefined, '10:00')}
                className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                <Plus className="h-4 w-4" />
                <span>Buat Reservasi</span>
              </button>
            )}
            <AccountMenu
              currentAccount={currentAccount}
              displayLabel={activeTherapistProfile?.name ?? currentAccount.display_name}
              onOpenAccountManagement={() => setActiveTab('accounts')}
              onUpdateSelfAccount={handleUpdateAccount}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {noticeMessage && (
          <div
            role="status"
            className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            <span>{noticeMessage}</span>
            <button
              type="button"
              onClick={() => setNoticeMessage(null)}
              className="text-sm font-semibold underline hover:text-emerald-950"
            >
              Tutup
            </button>
          </div>
        )}

        {activeTab === 'calendar' && (
          <DailyCalendarView
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
            therapists={therapists}
            services={services}
            bookings={bookings}
            userRole={currentAccount.role}
            loggedInTherapistId={currentAccount.therapist_id}
            onCreateAtSlot={(therapistId, startTime) =>
              handleOpenCreateModal(therapistId, startTime)
            }
            onSelectBooking={(booking) => setSelectedBooking(booking)}
          />
        )}

        {isAdmin && activeTab === 'services' && (
          <ServicesView
            services={services}
            onRequestSaveService={handleRequestSaveService}
          />
        )}

        {isAdmin && activeTab === 'therapists' && (
          <TherapistsView
            therapists={therapists}
            accounts={workspaceAccounts}
            onRequestSaveTherapists={handleRequestSaveTherapists}
            onAddTherapist={handleAddTherapist}
            onOpenAccountsTab={() => setActiveTab('accounts')}
          />
        )}

        {isAdmin && activeTab === 'revenue' && (
          <RevenueSummaryView
            bookings={bookings}
            services={services}
            therapists={therapists}
            defaultDate={selectedDate}
          />
        )}

        {isAdmin && activeTab === 'accounts' && (
          <AccountsView
            accounts={managedAccounts}
            allAccounts={accounts}
            therapists={therapists}
            currentAccountId={currentAccount.account_id}
            ownerAccountId={activeOwnerId}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
            onRequestDeleteAccount={handleRequestDeleteAccount}
          />
        )}

        {isAdmin && activeTab === 'database' && (
          <DatabasePanel
            database={accountDb}
            onRequestImportDatabase={handleRequestImportDatabase}
            onRequestResetDatabase={handleRequestResetDatabase}
          />
        )}
      </main>

      {isAdmin && (
        <BookingFormModal
          isOpen={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingBooking(null);
          }}
          services={services}
          therapists={therapists}
          bookings={bookings}
          initialDate={selectedDate}
          initialStartTime={prefillSlot.startTime}
          initialTherapistId={prefillSlot.therapistId}
          editingBooking={editingBooking}
          onRequestSave={handleRequestSaveBooking}
        />
      )}

      <BookingDetailModal
        booking={selectedBooking}
        service={selectedBookingService}
        therapist={selectedBookingTherapist}
        userRole={currentAccount.role}
        onClose={() => setSelectedBooking(null)}
        onRequestStatusChange={handleRequestStatusChange}
        onStartReschedule={(booking) => {
          setSelectedBooking(null);
          setEditingBooking(booking);
          setFormOpen(true);
        }}
      />

      <ConfirmDialog
        dialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
    </div>
  );
}
