// Komponen utama aplikasi penjadwalan klinik kesehatan dengan manajemen terapis dinamis, manajemen akun Admin/Terapis, penyimpanan lokal, dan Google Sheets opsional.

import type { User } from 'firebase/auth';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  FileSpreadsheet,
  Loader2,
  Plus,
  Scissors,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AccountMenu } from './components/AccountMenu';
import { AccountsView } from './components/AccountsView';
import { AdminLockScreen } from './components/AdminLockScreen';
import { BookingDetailModal } from './components/BookingDetailModal';
import { BookingFormModal } from './components/BookingFormModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DailyCalendarView } from './components/DailyCalendarView';
import { RevenueSummaryView } from './components/RevenueSummaryView';
import { ServicesView } from './components/ServicesView';
import { SheetSetupPanel } from './components/SheetSetupPanel';
import { TherapistsView } from './components/TherapistsView';
import {
  CLINIC_LOGO_SRC,
  CLINIC_NAME,
  DEFAULT_SERVICES,
  DEFAULT_THERAPISTS,
  LOCATION_LABELS,
  STATUS_LABELS,
  STORAGE_KEY,
} from './config';
import {
  migrateLegacyLockToAccount,
  type AdminLockRecord,
} from './lib/adminLock';
import {
  formatDateIndo,
  formatRupiah,
  formatTimeRange,
  getTodayYYYYMMDD,
} from './lib/format';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './lib/googleAuth';
import {
  appendBookingToSheet,
  appendServiceToSheet,
  AuthExpiredError,
  connectExistingSpreadsheet,
  createClinicSpreadsheet,
  loadClinicData,
  saveTherapistsToSheet,
  updateBookingInSheet,
  updateServiceInSheet,
} from './lib/googleSheets';
import type {
  Booking,
  BookingStatus,
  ConfirmDialogState,
  Service,
  SpreadsheetConnection,
  Therapist,
  UserAccount,
} from './lib/types';

type ActiveTab = 'calendar' | 'services' | 'therapists' | 'revenue' | 'accounts' | 'sheet';

interface StoredAppState {
  spreadsheetId?: string | null;
  adminLock?: AdminLockRecord | null;
  accounts?: UserAccount[];
  therapists?: Therapist[];
  services?: Service[];
  bookings?: Booking[];
}

function isValidAccount(item: unknown): item is UserAccount {
  if (!item || typeof item !== 'object') return false;
  const acc = item as Partial<UserAccount>;
  return (
    typeof acc.account_id === 'string' &&
    typeof acc.username === 'string' &&
    typeof acc.salt === 'string' &&
    typeof acc.hash === 'string' &&
    (acc.role === 'ADMIN' || acc.role === 'THERAPIST')
  );
}

function readStoredState(): StoredAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredAppState;
    if (!parsed || typeof parsed !== 'object') return {};

    const rawLock = parsed.adminLock;
    const validLock =
      rawLock &&
      typeof rawLock === 'object' &&
      typeof rawLock.username === 'string' &&
      typeof rawLock.salt === 'string' &&
      typeof rawLock.hash === 'string'
        ? rawLock
        : null;

    const storedAccounts = Array.isArray(parsed.accounts)
      ? parsed.accounts.filter(isValidAccount)
      : [];

    const migratedAccounts =
      storedAccounts.length > 0
        ? storedAccounts
        : migrateLegacyLockToAccount(validLock);

    return {
      spreadsheetId:
        typeof parsed.spreadsheetId === 'string' && parsed.spreadsheetId.trim()
          ? parsed.spreadsheetId.trim()
          : null,
      accounts: migratedAccounts,
      therapists:
        Array.isArray(parsed.therapists) && parsed.therapists.length > 0
          ? parsed.therapists
          : undefined,
      services:
        Array.isArray(parsed.services) && parsed.services.length > 0
          ? parsed.services
          : undefined,
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : undefined,
    };
  } catch {
    return {};
  }
}

function writeStoredState(next: StoredAppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Abaikan jika penyimpanan browser dibatasi
  }
}

export default function App() {
  const [initialStore] = useState<StoredAppState>(() => readStoredState());

  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayYYYYMMDD);

  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [connection, setConnection] = useState<SpreadsheetConnection | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<UserAccount[]>(
    () => initialStore.accounts ?? []
  );
  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(null);

  const [therapists, setTherapists] = useState<Therapist[]>(
    () => initialStore.therapists ?? DEFAULT_THERAPISTS
  );
  const [services, setServices] = useState<Service[]>(
    () => initialStore.services ?? DEFAULT_SERVICES
  );
  const [bookings, setBookings] = useState<Booking[]>(
    () => initialStore.bookings ?? []
  );

  const [formOpen, setFormOpen] = useState(false);
  const [prefillSlot, setPrefillSlot] = useState<{
    therapistId?: string;
    startTime?: string;
  }>({});
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Simpan otomatis ke satu kunci localStorage setiap ada perubahan data lokal
  useEffect(() => {
    writeStoredState({
      spreadsheetId: connection?.spreadsheetId ?? initialStore.spreadsheetId ?? null,
      accounts,
      therapists,
      services,
      bookings,
    });
  }, [connection, initialStore.spreadsheetId, accounts, therapists, services, bookings]);

  const handleAuthError = useCallback((err: unknown) => {
    if (err instanceof AuthExpiredError) {
      clearAccessToken();
      setIsAuthenticated(false);
      setSyncError(err.message);
      return true;
    }
    return false;
  }, []);

  const syncFromSpreadsheet = useCallback(
    async (token: string, spreadsheetId: string) => {
      setIsSyncing(true);
      setSyncError(null);
      try {
        const conn = await connectExistingSpreadsheet(token, spreadsheetId);
        const data = await loadClinicData(token, conn.spreadsheetId);
        setConnection(conn);
        setTherapists(data.therapists);
        setServices(data.services);
        setBookings(data.bookings);
      } catch (err) {
        if (!handleAuthError(err)) {
          setSyncError(
            err instanceof Error ? err.message : 'Gagal memuat data dari Google Sheets.'
          );
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [handleAuthError]
  );

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setIsAuthenticated(true);
        const saved = readStoredState();
        if (saved.spreadsheetId) {
          void syncFromSpreadsheet(token, saved.spreadsheetId);
        }
      },
      () => {
        setIsAuthenticated(false);
      }
    );
    return () => unsubscribe();
  }, [syncFromSpreadsheet]);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setSyncError(null);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setIsAuthenticated(true);
      const saved = readStoredState();
      if (saved.spreadsheetId) {
        await syncFromSpreadsheet(result.accessToken, saved.spreadsheetId);
      }
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'Gagal masuk dengan akun Google.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setIsAuthenticated(false);
    setConnection(null);
    setNoticeMessage('Koneksi akun Google ditutup. Data lokal tetap tersimpan di browser.');
  };

  const handleCreateSpreadsheet = async (title: string) => {
    const token = getAccessToken();
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    setConfirmDialog({
      title: 'Buat Google Spreadsheet Baru?',
      message:
        'Aplikasi akan membuat file Google Sheets baru di akun Google Anda dengan tab Terapis, Layanan, dan Reservasi.',
      details: [`Nama file: ${title}`, `Data awal: ${therapists.length} terapis dan paket layanan`],
      confirmLabel: 'Ya, Buat Spreadsheet',
      tone: 'primary',
      onConfirm: async () => {
        const activeToken = getAccessToken();
        if (!activeToken) {
          setIsAuthenticated(false);
          throw new AuthExpiredError();
        }
        setIsSyncing(true);
        setSyncError(null);
        try {
          const conn = await createClinicSpreadsheet(activeToken, title);
          const data = await loadClinicData(activeToken, conn.spreadsheetId);
          setConnection(conn);
          setTherapists(data.therapists);
          setServices(data.services);
          setBookings(data.bookings);
          setActiveTab('calendar');
          setNoticeMessage(`Spreadsheet "${conn.title}" berhasil dibuat dan dihubungkan.`);
        } catch (err) {
          handleAuthError(err);
          throw err;
        } finally {
          setIsSyncing(false);
        }
      },
    });
  };

  const handleConnectSpreadsheet = async (spreadsheetId: string) => {
    const token = getAccessToken();
    if (!token) {
      setIsAuthenticated(false);
      return;
    }
    await syncFromSpreadsheet(token, spreadsheetId);
    setActiveTab('calendar');
    setNoticeMessage('Google Spreadsheet berhasil dihubungkan.');
  };

  const handleRefreshData = async () => {
    const token = getAccessToken();
    if (!token || !connection) {
      setIsAuthenticated(false);
      return;
    }
    await syncFromSpreadsheet(token, connection.spreadsheetId);
    setNoticeMessage('Data jadwal terbaru telah dimuat dari Google Sheets.');
  };

  const handleDisconnectSpreadsheet = () => {
    setConnection(null);
    writeStoredState({
      spreadsheetId: null,
      accounts,
      therapists,
      services,
      bookings,
    });
    setNoticeMessage('Spreadsheet dilepas. Perubahan berikutnya disimpan lokal di browser.');
  };

  const handleRequestResetLock = () => {
    setConfirmDialog({
      title: 'Reset Seluruh Akun Lokal?',
      message:
        'Tindakan ini menghapus semua akun login lokal dan riwayat reservasi lokal di browser ini agar Anda dapat mengatur ulang akun Admin utama. Data di Google Sheets tidak ikut terhapus.',
      confirmLabel: 'Ya, Reset Akun',
      tone: 'danger',
      onConfirm: async () => {
        setAccounts([]);
        setCurrentAccount(null);
        setBookings([]);
        setTherapists(DEFAULT_THERAPISTS);
        setServices(DEFAULT_SERVICES);
        writeStoredState({
          spreadsheetId: connection?.spreadsheetId ?? initialStore.spreadsheetId ?? null,
          accounts: [],
          therapists: DEFAULT_THERAPISTS,
          services: DEFAULT_SERVICES,
          bookings: [],
        });
      },
    });
  };

  const hasLiveSheet = Boolean(isAuthenticated && connection && getAccessToken());

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
    const { mode, booking, serviceName, therapistName } = payload;
    const isReschedule = mode === 'reschedule';

    const applyLocalSave = () => {
      if (isReschedule) {
        setBookings((prev) =>
          prev.map((b) => (b.booking_id === booking.booking_id ? booking : b))
        );
        setNoticeMessage(`Jadwal ${booking.patient_name} berhasil diperbarui.`);
      } else {
        setBookings((prev) => [...prev, booking]);
        setSelectedDate(booking.booking_date);
        setNoticeMessage(`Reservasi ${booking.patient_name} berhasil disimpan.`);
      }
      setFormOpen(false);
      setEditingBooking(null);
    };

    if (!hasLiveSheet || !connection) {
      applyLocalSave();
      return;
    }

    setConfirmDialog({
      title: isReschedule
        ? 'Konfirmasi Jadwal Ulang di Google Sheets'
        : 'Simpan Reservasi ke Google Sheets?',
      message: isReschedule
        ? 'Perubahan jadwal berikut akan memperbarui baris reservasi pada tab Reservasi di Google Sheets.'
        : 'Reservasi baru berikut akan ditambahkan ke tab Reservasi di Google Sheets.',
      details: [
        `Pasien: ${booking.patient_name}`,
        `Layanan: ${serviceName}`,
        `Waktu: ${formatDateIndo(booking.booking_date)} · ${formatTimeRange(booking.start_time, booking.end_time)} WIB`,
        `Terapis: ${therapistName}`,
        `Lokasi: ${LOCATION_LABELS[booking.location_type]}${
          booking.patient_address ? ` (${booking.patient_address})` : ''
        }`,
      ],
      confirmLabel: isReschedule ? 'Ya, Perbarui Jadwal' : 'Ya, Simpan Reservasi',
      tone: 'primary',
      onConfirm: async () => {
        const token = getAccessToken();
        if (!token) throw new AuthExpiredError();
        try {
          if (isReschedule) {
            await updateBookingInSheet(token, connection.spreadsheetId, booking);
          } else {
            await appendBookingToSheet(token, connection.spreadsheetId, booking);
          }
          applyLocalSave();
        } catch (err) {
          handleAuthError(err);
          throw err;
        }
      },
    });
  };

  const handleRequestStatusChange = (booking: Booking, nextStatus: BookingStatus) => {
    const isCancel = nextStatus === 'CANCELLED';
    const nextLabel = STATUS_LABELS[nextStatus];

    const applyStatusLocal = () => {
      const updated: Booking = {
        ...booking,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };
      setBookings((prev) =>
        prev.map((b) => (b.booking_id === updated.booking_id ? updated : b))
      );
      setSelectedBooking(null);
      setNoticeMessage(
        `Status reservasi ${booking.patient_name} diubah menjadi ${nextLabel}.`
      );
      return updated;
    };

    if (!isCancel && (!hasLiveSheet || !connection)) {
      applyStatusLocal();
      return;
    }

    setConfirmDialog({
      title: isCancel
        ? 'Batalkan Reservasi Ini?'
        : `Ubah Status Menjadi ${nextLabel}?`,
      message: isCancel
        ? 'Status reservasi akan diubah menjadi Dibatalkan dan slot terapis langsung tersedia kembali.'
        : 'Status reservasi pada Google Sheets akan diperbarui menjadi Selesai.',
      details: [
        `Pasien: ${booking.patient_name}`,
        `Jadwal: ${formatDateIndo(booking.booking_date)} · ${formatTimeRange(booking.start_time, booking.end_time)} WIB`,
        `Perubahan status: ${STATUS_LABELS[booking.status]} -> ${nextLabel}`,
      ],
      confirmLabel: isCancel ? 'Ya, Batalkan Jadwal' : 'Ya, Tandai Selesai',
      tone: isCancel ? 'danger' : 'primary',
      onConfirm: async () => {
        const updated: Booking = {
          ...booking,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        };
        if (hasLiveSheet && connection) {
          const token = getAccessToken();
          if (!token) throw new AuthExpiredError();
          try {
            await updateBookingInSheet(token, connection.spreadsheetId, updated);
          } catch (err) {
            handleAuthError(err);
            throw err;
          }
        }
        setBookings((prev) =>
          prev.map((b) => (b.booking_id === updated.booking_id ? updated : b))
        );
        setSelectedBooking(null);
        setNoticeMessage(
          `Status reservasi ${booking.patient_name} diubah menjadi ${nextLabel}.`
        );
      },
    });
  };

  const handleRequestSaveService = (mode: 'create' | 'edit', service: Service) => {
    const isEdit = mode === 'edit';

    const applyServiceLocal = () => {
      if (isEdit) {
        setServices((prev) =>
          prev.map((s) => (s.service_id === service.service_id ? service : s))
        );
        setNoticeMessage(`Layanan "${service.service_name}" berhasil diperbarui.`);
      } else {
        setServices((prev) => [...prev, service]);
        setNoticeMessage(`Layanan "${service.service_name}" berhasil ditambahkan.`);
      }
    };

    if (!hasLiveSheet || !connection) {
      applyServiceLocal();
      return;
    }

    setConfirmDialog({
      title: isEdit
        ? 'Perbarui Layanan di Google Sheets?'
        : 'Tambah Layanan ke Google Sheets?',
      message: isEdit
        ? 'Perubahan detail paket layanan akan menimpa baris terkait pada tab Layanan.'
        : 'Paket layanan baru akan ditambahkan ke tab Layanan di Google Sheets.',
      details: [
        `Nama: ${service.service_name}`,
        `Kategori: ${service.category === 'PIJAT' ? 'Pijat' : 'Facial'}`,
        `Durasi & Harga: ${service.duration_minutes} menit · ${formatRupiah(service.price)}`,
      ],
      confirmLabel: isEdit ? 'Ya, Perbarui Layanan' : 'Ya, Tambah Layanan',
      tone: 'primary',
      onConfirm: async () => {
        const token = getAccessToken();
        if (!token) throw new AuthExpiredError();
        try {
          if (isEdit) {
            await updateServiceInSheet(token, connection.spreadsheetId, service);
          } else {
            await appendServiceToSheet(token, connection.spreadsheetId, service);
          }
          applyServiceLocal();
        } catch (err) {
          handleAuthError(err);
          throw err;
        }
      },
    });
  };

  const handleRequestSaveTherapists = (nextTherapists: Therapist[]) => {
    if (!hasLiveSheet || !connection) {
      setTherapists(nextTherapists);
      setNoticeMessage('Data terapis berhasil diperbarui.');
      return;
    }

    setConfirmDialog({
      title: 'Simpan Daftar Terapis ke Google Sheets?',
      message:
        'Daftar nama dan status aktif seluruh terapis pada tab Terapis di Google Sheets akan diperbarui.',
      details: nextTherapists.map(
        (t) => `${t.name} (${t.is_active ? 'Aktif' : 'Nonaktif'})`
      ),
      confirmLabel: 'Ya, Simpan Terapis',
      tone: 'primary',
      onConfirm: async () => {
        const token = getAccessToken();
        if (!token) throw new AuthExpiredError();
        try {
          await saveTherapistsToSheet(token, connection.spreadsheetId, nextTherapists);
          setTherapists(nextTherapists);
          setNoticeMessage('Data terapis berhasil diperbarui di Google Sheets.');
        } catch (err) {
          handleAuthError(err);
          throw err;
        }
      },
    });
  };

  const handleAddTherapistWithOptionalAccount = (
    newTherapist: Therapist,
    newAccount?: UserAccount
  ) => {
    const nextTherapists = [...therapists, newTherapist];

    const applyLocal = () => {
      setTherapists(nextTherapists);
      if (newAccount) {
        setAccounts((prev) => [...prev, newAccount]);
        setNoticeMessage(
          `Terapis "${newTherapist.name}" beserta akun "${newAccount.username}" berhasil ditambahkan.`
        );
      } else {
        setNoticeMessage(`Terapis "${newTherapist.name}" berhasil ditambahkan.`);
      }
    };

    if (!hasLiveSheet || !connection) {
      applyLocal();
      return;
    }

    setConfirmDialog({
      title: 'Tambah Terapis Baru ke Google Sheets?',
      message:
        'Terapis baru akan ditambahkan ke tab Terapis di Google Sheets.',
      details: [
        `Nama terapis: ${newTherapist.name}`,
        ...(newAccount ? [`Akun login lokal: ${newAccount.username} (Terapis)`] : []),
      ],
      confirmLabel: 'Ya, Tambah Terapis',
      tone: 'primary',
      onConfirm: async () => {
        const token = getAccessToken();
        if (!token) throw new AuthExpiredError();
        try {
          await saveTherapistsToSheet(token, connection.spreadsheetId, nextTherapists);
          applyLocal();
        } catch (err) {
          handleAuthError(err);
          throw err;
        }
      },
    });
  };

  const handleCreateAccount = (newAcc: UserAccount) => {
    setAccounts((prev) => [...prev, newAcc]);
    setNoticeMessage(`Akun "${newAcc.username}" berhasil dibuat.`);
  };

  const handleUpdateAccount = (updatedAcc: UserAccount) => {
    setAccounts((prev) =>
      prev.map((a) => (a.account_id === updatedAcc.account_id ? updatedAcc : a))
    );
    if (currentAccount?.account_id === updatedAcc.account_id) {
      setCurrentAccount(updatedAcc);
    }
    setNoticeMessage(`Akun "${updatedAcc.username}" berhasil diperbarui.`);
  };

  const handleRequestDeleteAccount = (targetAcc: UserAccount) => {
    setConfirmDialog({
      title: 'Hapus Akun Login Ini?',
      message: `Akun "${targetAcc.username}" tidak akan bisa digunakan lagi untuk masuk ke aplikasi.`,
      confirmLabel: 'Ya, Hapus Akun',
      tone: 'danger',
      onConfirm: async () => {
        setAccounts((prev) =>
          prev.filter((a) => a.account_id !== targetAcc.account_id)
        );
        setNoticeMessage(`Akun "${targetAcc.username}" telah dihapus.`);
      },
    });
  };

  const selectedBookingService = selectedBooking
    ? services.find((s) => s.service_id === selectedBooking.service_id)
    : undefined;
  const selectedBookingTherapist = selectedBooking
    ? therapists.find((t) => t.therapist_id === selectedBooking.therapist_id)
    : undefined;

  if (!currentAccount) {
    return (
      <>
        <AdminLockScreen
          accounts={accounts}
          onLoginSuccess={(account) => {
            setCurrentAccount(account);
            setActiveTab('calendar');
            setNoticeMessage(null);
          }}
          onCreateInitialAdmin={(adminAcc) => {
            setAccounts([adminAcc]);
          }}
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
          <div className="flex items-center gap-3 shrink-0">
            <img
              src={CLINIC_LOGO_SRC}
              alt={`Logo ${CLINIC_NAME}`}
              className="h-10 w-10 shrink-0 rounded-full border border-neutral-200 object-cover"
            />
            <span className="text-lg font-bold tracking-tight text-neutral-900 whitespace-nowrap shrink-0">
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
              className={`inline-flex min-h-[40px] items-center gap-1.5 border-b-2 px-1 py-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
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
                  className={`inline-flex min-h-[40px] items-center gap-1.5 border-b-2 px-1 py-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
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
                  className={`inline-flex min-h-[40px] items-center gap-1.5 border-b-2 px-1 py-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
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
                  className={`inline-flex min-h-[40px] items-center gap-1.5 border-b-2 px-1 py-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
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
                  onClick={() => setActiveTab('sheet')}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 border-b-2 px-1 py-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                    activeTab === 'sheet'
                      ? 'border-amber-700 text-amber-800'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Ekspor & Sheet</span>
                </button>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleOpenCreateModal(undefined, '10:00')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 whitespace-nowrap"
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
              onSignOut={() => setCurrentAccount(null)}
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

        {syncError && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}

        {isSyncing && activeTab === 'calendar' && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-700">
            <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
            <span>Menyinkronkan jadwal dengan Google Sheets…</span>
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
            accounts={accounts}
            onRequestSaveTherapists={handleRequestSaveTherapists}
            onAddTherapistWithOptionalAccount={handleAddTherapistWithOptionalAccount}
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
            accounts={accounts}
            therapists={therapists}
            currentAccountId={currentAccount.account_id}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
            onRequestDeleteAccount={handleRequestDeleteAccount}
          />
        )}

        {isAdmin && activeTab === 'sheet' && (
          <SheetSetupPanel
            isAuthenticated={isAuthenticated}
            userEmail={user?.email ?? null}
            isLoggingIn={isLoggingIn}
            connection={connection}
            isSyncing={isSyncing}
            errorMessage={syncError}
            therapists={therapists}
            services={services}
            bookings={bookings}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onCreateSpreadsheet={handleCreateSpreadsheet}
            onConnectSpreadsheet={handleConnectSpreadsheet}
            onRefreshData={handleRefreshData}
            onDisconnectSpreadsheet={handleDisconnectSpreadsheet}
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
