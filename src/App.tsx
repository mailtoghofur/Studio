// Komponen utama aplikasi penjadwalan Naomi Beauty & Wellness dengan akun Admin Master cloud multi-browser dan ruang kerja terpisah per akun.

import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Database,
  Plus,
  Scissors,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  DB_KEY_PREFIX,
  DEFAULT_SERVICES,
  DEFAULT_THERAPISTS,
  STATUS_LABELS,
  STORAGE_KEY,
} from './config';
import {
  checkSystemInitialized,
  deleteCloudAccount,
  fetchCurrentUserProfile,
  importWorkspaceDatabaseToCloud,
  logoutCloudSession,
  resetWorkspaceDatabaseInCloud,
  saveWorkspaceBooking,
  saveWorkspaceServices,
  saveWorkspaceTherapists,
  subscribeWorkspace,
  toggleCloudAccountActive,
  updateWorkspaceBookingStatus,
  type WorkspaceMetadata,
} from './lib/cloudClinic';
import { auth } from './lib/firebase';
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

function readLegacyLocalData():
  | {
      therapists?: Therapist[];
      services?: Service[];
      bookings?: Booking[];
    }
  | undefined {
  try {
    // Cek database lokal per akun jika ada dari sesi sebelumnya
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DB_KEY_PREFIX)) {
        const rawDb = localStorage.getItem(key);
        if (!rawDb) continue;
        const parsed = JSON.parse(rawDb) as Partial<AccountDatabase>;
        if (parsed && Array.isArray(parsed.bookings) && parsed.bookings.length > 0) {
          return {
            therapists: Array.isArray(parsed.therapists) ? parsed.therapists : undefined,
            services: Array.isArray(parsed.services) ? parsed.services : undefined,
            bookings: parsed.bookings,
          };
        }
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as {
      therapists?: Therapist[];
      services?: Service[];
      bookings?: Booking[];
    };
    if (
      parsed &&
      (Array.isArray(parsed.bookings) ||
        Array.isArray(parsed.therapists) ||
        Array.isArray(parsed.services))
    ) {
      return {
        therapists: Array.isArray(parsed.therapists) ? parsed.therapists : undefined,
        services: Array.isArray(parsed.services) ? parsed.services : undefined,
        bookings: Array.isArray(parsed.bookings) ? parsed.bookings : undefined,
      };
    }
  } catch {
    // Abaikan jika data lokal tidak terbaca
  }
  return undefined;
}

export default function App() {
  const [legacyLocalData] = useState(() => readLegacyLocalData());
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayYYYYMMDD);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(null);
  const currentAccountRef = useRef<UserAccount | null>(null);
  currentAccountRef.current = currentAccount;

  const [workspaceMeta, setWorkspaceMeta] = useState<WorkspaceMetadata | null>(null);
  const [therapists, setTherapists] = useState<Therapist[]>(DEFAULT_THERAPISTS);
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<UserAccount[]>([]);
  const [createdAccounts, setCreatedAccounts] = useState<UserAccount[]>([]);
  const [lastUpdatedIso, setLastUpdatedIso] = useState<string>(() => new Date().toISOString());

  const [formOpen, setFormOpen] = useState(false);
  const [prefillSlot, setPrefillSlot] = useState<{
    therapistId?: string;
    startTime?: string;
  }>({});
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const verifySystemBoot = useCallback(async () => {
    setInitError(null);
    setIsInitialized(null);
    try {
      const initialized = await checkSystemInitialized();
      setIsInitialized(initialized);
    } catch (err) {
      setInitError(
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke database cloud Firestore. Periksa koneksi Anda.'
      );
    }
  }, []);

  useEffect(() => {
    void verifySystemBoot();
  }, [verifySystemBoot]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentAccount(null);
        setWorkspaceMeta(null);
        setWorkspaceMembers([]);
        setCreatedAccounts([]);
        return;
      }

      if (currentAccountRef.current?.uid === firebaseUser.uid) {
        return;
      }

      void (async () => {
        try {
          let profile = await fetchCurrentUserProfile(firebaseUser.uid);
          if (!profile) {
            await new Promise((r) => setTimeout(r, 700));
            profile = await fetchCurrentUserProfile(firebaseUser.uid);
          }
          if (!profile) return;
          if (!profile.is_active) {
            await logoutCloudSession();
            setCurrentAccount(null);
            return;
          }
          setCurrentAccount(profile);
          setIsInitialized(true);
        } catch (err) {
          setCloudError(err instanceof Error ? err.message : 'Gagal memuat profil akun.');
        }
      })();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentAccount) return;

    const unsubscribe = subscribeWorkspace(currentAccount.workspace_id, currentAccount, {
      onWorkspace: (ws) => {
        setWorkspaceMeta(ws);
        setLastUpdatedIso(new Date().toISOString());
      },
      onTherapists: (items) => {
        setTherapists(items.length > 0 ? items : DEFAULT_THERAPISTS);
        setLastUpdatedIso(new Date().toISOString());
      },
      onServices: (items) => {
        setServices(items.length > 0 ? items : DEFAULT_SERVICES);
        setLastUpdatedIso(new Date().toISOString());
      },
      onBookings: (items) => {
        setBookings(items);
        setLastUpdatedIso(new Date().toISOString());
      },
      onWorkspaceMembers: (members) => {
        setWorkspaceMembers(members);
      },
      onCreatedAccounts: (created) => {
        setCreatedAccounts(created);
      },
      onError: (err) => {
        setCloudError(err.message);
      },
    });

    return () => unsubscribe();
  }, [currentAccount]);

  const managedAccounts = useMemo(() => {
    const map = new Map<string, UserAccount>();
    for (const m of workspaceMembers) {
      map.set(m.uid, m);
    }
    for (const c of createdAccounts) {
      if (!map.has(c.uid)) {
        map.set(c.uid, c);
      }
    }
    if (currentAccount && !map.has(currentAccount.uid)) {
      map.set(currentAccount.uid, currentAccount);
    }
    return Array.from(map.values());
  }, [workspaceMembers, createdAccounts, currentAccount]);

  const therapistUidByTherapistId = useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of workspaceMembers) {
      if (acc.role === 'THERAPIST' && acc.therapist_id && acc.is_active) {
        map.set(acc.therapist_id, acc.uid);
      }
    }
    return map;
  }, [workspaceMembers]);

  const workspaceOwnerUid =
    workspaceMeta?.ownerUid ?? currentAccount?.uid ?? '';
  const workspaceAdminUids = useMemo(() => {
    if (workspaceMeta?.adminUids && workspaceMeta.adminUids.length > 0) {
      return workspaceMeta.adminUids;
    }
    return currentAccount ? [currentAccount.uid] : [];
  }, [workspaceMeta, currentAccount]);

  const activeAccountDatabase: AccountDatabase | null = useMemo(() => {
    if (!currentAccount) return null;
    return {
      database_id: currentAccount.workspace_id,
      owner_account_id: workspaceOwnerUid,
      owner_username: workspaceMeta?.ownerUsername ?? currentAccount.username,
      therapists,
      services,
      bookings,
      updated_at: lastUpdatedIso,
    };
  }, [currentAccount, workspaceOwnerUid, workspaceMeta, therapists, services, bookings, lastUpdatedIso]);

  const handleSignOut = async () => {
    await logoutCloudSession();
    setCurrentAccount(null);
    setWorkspaceMeta(null);
    setWorkspaceMembers([]);
    setCreatedAccounts([]);
    setSelectedBooking(null);
    setEditingBooking(null);
    setFormOpen(false);
    setNoticeMessage(null);
    setCloudError(null);
  };

  const handleOpenCreateModal = (therapistId?: string, startTime?: string) => {
    setEditingBooking(null);
    setPrefillSlot({ therapistId, startTime });
    setFormOpen(true);
  };

  const handleRequestSaveBooking = async (payload: {
    mode: 'create' | 'reschedule';
    booking: Booking;
    serviceName: string;
    therapistName: string;
  }) => {
    if (!currentAccount) return;
    const { mode, booking } = payload;
    const therapistUid = therapistUidByTherapistId.get(booking.therapist_id) ?? '';
    setCloudError(null);
    try {
      await saveWorkspaceBooking({
        mode,
        workspaceId: currentAccount.workspace_id,
        ownerUid: workspaceOwnerUid,
        adminUids: workspaceAdminUids,
        therapistUid,
        booking,
      });
      if (mode === 'reschedule') {
        setNoticeMessage(`Jadwal ${booking.patient_name} berhasil diperbarui.`);
      } else {
        setSelectedDate(booking.booking_date);
        setNoticeMessage(`Reservasi ${booking.patient_name} berhasil disimpan.`);
      }
      setFormOpen(false);
      setEditingBooking(null);
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Gagal menyimpan reservasi ke cloud.');
    }
  };

  const handleRequestStatusChange = (booking: Booking, nextStatus: BookingStatus) => {
    if (!currentAccount) return;
    const isCancel = nextStatus === 'CANCELLED';
    const nextLabel = STATUS_LABELS[nextStatus];

    const applyStatus = async () => {
      setCloudError(null);
      await updateWorkspaceBookingStatus({
        workspaceId: currentAccount.workspace_id,
        bookingId: booking.booking_id,
        status: nextStatus,
      });
      setSelectedBooking(null);
      setNoticeMessage(`Status reservasi ${booking.patient_name} diubah menjadi ${nextLabel}.`);
    };

    if (!isCancel) {
      void applyStatus().catch((err) => {
        setCloudError(err instanceof Error ? err.message : 'Gagal mengubah status reservasi.');
      });
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
      onConfirm: applyStatus,
    });
  };

  const handleRequestSaveService = async (mode: 'create' | 'edit', service: Service) => {
    if (!currentAccount) return;
    const isEdit = mode === 'edit';
    const nextServices = isEdit
      ? services.map((s) => (s.service_id === service.service_id ? service : s))
      : [...services, service];

    setCloudError(null);
    try {
      await saveWorkspaceServices(currentAccount.workspace_id, nextServices);
      setNoticeMessage(
        isEdit
          ? `Layanan "${service.service_name}" berhasil diperbarui.`
          : `Layanan "${service.service_name}" berhasil ditambahkan.`
      );
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Gagal menyimpan layanan ke cloud.');
    }
  };

  const handleRequestSaveTherapists = async (nextTherapists: Therapist[]) => {
    if (!currentAccount) return;
    setCloudError(null);
    try {
      await saveWorkspaceTherapists(currentAccount.workspace_id, nextTherapists);
      setNoticeMessage('Data terapis berhasil diperbarui.');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Gagal menyimpan data terapis ke cloud.');
    }
  };

  const handleAddTherapist = async (newTherapist: Therapist) => {
    if (!currentAccount) return;
    setCloudError(null);
    try {
      await saveWorkspaceTherapists(currentAccount.workspace_id, [
        ...therapists,
        newTherapist,
      ]);
      setNoticeMessage(
        `Terapis "${newTherapist.name}" berhasil ditambahkan. Gunakan menu Manajemen Akun untuk membuatkan akun login.`
      );
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Gagal menambahkan terapis ke cloud.');
    }
  };

  const handleAccountCreated = (newAcc: UserAccount) => {
    const isSeparateDb =
      currentAccount && newAcc.workspace_id !== currentAccount.workspace_id;
    setNoticeMessage(
      isSeparateDb
        ? `Akun Admin "${newAcc.username}" berhasil dibuat dengan database cloud terpisah.`
        : `Akun "${newAcc.username}" berhasil dibuat dan dapat digunakan masuk di browser mana saja.`
    );
  };

  const handleToggleAccountActive = async (targetAcc: UserAccount, nextActive: boolean) => {
    if (!currentAccount) return;
    setCloudError(null);
    try {
      await toggleCloudAccountActive(targetAcc, nextActive, currentAccount.workspace_id);
      setNoticeMessage(
        `Akun "${targetAcc.username}" sekarang ${nextActive ? 'Aktif' : 'Nonaktif'}.`
      );
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Gagal mengubah status akun.');
    }
  };

  const handleRequestDeleteAccount = (targetAcc: UserAccount) => {
    if (!currentAccount) return;
    const ownsSeparateDb = targetAcc.workspace_id !== currentAccount.workspace_id;

    setConfirmDialog({
      title: 'Hapus Akun Login Ini?',
      message: ownsSeparateDb
        ? `Akun "${targetAcc.username}" akan dihapus dan akses ke database terpisahnya dicabut.`
        : `Akun "${targetAcc.username}" akan dicabut aksesnya dan tidak dapat digunakan lagi.`,
      confirmLabel: 'Ya, Hapus Akun',
      tone: 'danger',
      onConfirm: async () => {
        await deleteCloudAccount(targetAcc, currentAccount.workspace_id);
        setNoticeMessage(`Akun "${targetAcc.username}" telah dihapus.`);
      },
    });
  };

  const handleRequestImportDatabase = (importedDb: AccountDatabase) => {
    if (!currentAccount) return;
    setConfirmDialog({
      title: `Pulihkan Database Cloud (${importedDb.owner_username})?`,
      message:
        'Seluruh data terapis, layanan, dan reservasi di ruang kerja akun ini akan diganti dengan isi file JSON cadangan.',
      details: [
        `Terapis: ${importedDb.therapists.length} data`,
        `Layanan: ${importedDb.services.length} paket`,
        `Reservasi: ${importedDb.bookings.length} jadwal`,
      ],
      confirmLabel: 'Ya, Pulihkan Database',
      tone: 'primary',
      onConfirm: async () => {
        await importWorkspaceDatabaseToCloud({
          workspaceId: currentAccount.workspace_id,
          ownerUid: workspaceOwnerUid,
          adminUids: workspaceAdminUids,
          existingBookingIds: bookings.map((b) => b.booking_id),
          imported: importedDb,
          therapistUidByTherapistId,
        });
        setNoticeMessage('Database cloud berhasil dipulihkan dari file JSON.');
      },
    });
  };

  const handleRequestResetDatabase = () => {
    if (!currentAccount || !activeAccountDatabase) return;
    setConfirmDialog({
      title: `Reset Database Cloud (${activeAccountDatabase.owner_username})?`,
      message:
        'Seluruh riwayat reservasi di ruang kerja ini akan dihapus, sedangkan data terapis dan layanan dikembalikan ke pengaturan awal.',
      confirmLabel: 'Ya, Reset Database',
      tone: 'danger',
      onConfirm: async () => {
        await resetWorkspaceDatabaseInCloud({
          workspaceId: currentAccount.workspace_id,
          existingBookingIds: bookings.map((b) => b.booking_id),
        });
        setNoticeMessage('Database ruang kerja telah direset ke pengaturan awal.');
      },
    });
  };

  const selectedBookingService = selectedBooking
    ? services.find((s) => s.service_id === selectedBooking.service_id)
    : undefined;
  const selectedBookingTherapist = selectedBooking
    ? therapists.find((t) => t.therapist_id === selectedBooking.therapist_id)
    : undefined;

  if (!currentAccount || !activeAccountDatabase) {
    return (
      <AdminLockScreen
        isInitialized={isInitialized}
        initError={initError}
        legacyLocalData={legacyLocalData}
        onRetryInit={() => void verifySystemBoot()}
        onLoginSuccess={(account) => {
          setCurrentAccount(account);
          setIsInitialized(true);
          setActiveTab('calendar');
          setNoticeMessage(null);
          setCloudError(null);
        }}
        onMasterSetupSuccess={(masterAccount) => {
          setCurrentAccount(masterAccount);
          setIsInitialized(true);
          setActiveTab('calendar');
          setNoticeMessage(
            `Akun Admin Master "${masterAccount.username}" aktif dan siap dipakai di multi browser.`
          );
          setCloudError(null);
        }}
      />
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
              onPasswordChanged={() =>
                setNoticeMessage('Kata sandi akun Anda berhasil diperbarui.')
              }
              onSignOut={() => void handleSignOut()}
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

        {cloudError && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{cloudError}</span>
            </div>
            <button
              type="button"
              onClick={() => setCloudError(null)}
              className="text-sm font-semibold underline hover:text-red-950"
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
            accounts={workspaceMembers}
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
            therapists={therapists}
            currentAccount={currentAccount}
            workspaceId={currentAccount.workspace_id}
            workspaceOwnerUid={workspaceOwnerUid}
            workspaceAdminUids={workspaceAdminUids}
            onAccountCreated={handleAccountCreated}
            onToggleActive={handleToggleAccountActive}
            onRequestDeleteAccount={handleRequestDeleteAccount}
          />
        )}

        {isAdmin && activeTab === 'database' && (
          <DatabasePanel
            database={activeAccountDatabase}
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
