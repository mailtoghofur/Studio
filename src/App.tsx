// Komponen utama aplikasi penjadwalan Naomi Beauty & Wellness dengan penyimpanan lokal di browser.

import {
  BarChart3,
  Calendar,
  Database,
  FilePenLine,
  Gift,
  Plus,
  Scissors,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AccountMenu } from './components/AccountMenu';
import { AccountsView } from './components/AccountsView';
import { AdminLockScreen } from './components/AdminLockScreen';
import { BookingDetailModal } from './components/BookingDetailModal';
import { BookingFormModal } from './components/BookingFormModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DailyCalendarView } from './components/DailyCalendarView';
import { DatabasePanel } from './components/DatabasePanel';
import { LoyaltyView } from './components/LoyaltyView';
import { ReceiptEditModal } from './components/ReceiptEditModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ReceiptsView } from './components/ReceiptsView';
import { RevenueSummaryView } from './components/RevenueSummaryView';
import { ServicesView } from './components/ServicesView';
import { TherapistsView } from './components/TherapistsView';
import {
  CLINIC_LOGO_SRC,
  CLINIC_NAME,
  DEFAULT_PRODUCTS,
  STATUS_LABELS,
  STORAGE_KEY,
} from './config';
import { ensureMasterAccountFlag, getWorkspaceOwnerId } from './lib/adminLock';
import {
  clearAllAccountDatabases,
  deleteAccountDatabase,
  loadAccountDatabase,
  resetAccountDatabase,
  restoreMasterBundle,
  saveAccountDatabase,
} from './lib/database';
import {
  calculateTreatmentDiscount,
  normalizeTreatmentDiscountPercent,
} from './lib/discount';
import {
  formatDateIndo,
  formatRupiah,
  formatTimeRange,
  getTodayYYYYMMDD,
} from './lib/format';
import { calculateProductSaleCommission } from './lib/products';
import { findSameTimeCompletedBookings } from './lib/receipt';
import {
  CANCELLATION_REASON_MAX_LENGTH,
  validateAndCancelBooking,
} from './lib/schedule';
import type {
  AccountDatabase,
  Booking,
  BookingStatus,
  ConfirmDialogState,
  MasterBundlePayload,
  Product,
  ProductSale,
  Service,
  Therapist,
  TreatmentDiscountPercent,
  UserAccount,
} from './lib/types';

type ActiveTab =
  | 'calendar'
  | 'services'
  | 'therapists'
  | 'loyalty'
  | 'revenue'
  | 'receipts'
  | 'accounts'
  | 'database';

interface StoredAccountsState {
  accounts: UserAccount[];
  legacySeed?: {
    therapists?: Therapist[];
    services?: Service[];
    bookings?: Booking[];
  };
}

function loadStoredAccountsState(): StoredAccountsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accounts: [] };
    const parsed = JSON.parse(raw) as {
      accounts?: UserAccount[];
      therapists?: Therapist[];
      services?: Service[];
      bookings?: Booking[];
    };
    if (parsed && Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
      const valid = parsed.accounts.filter(
        (a): a is UserAccount =>
          Boolean(
            a &&
              typeof a.account_id === 'string' &&
              typeof a.username === 'string' &&
              typeof a.salt === 'string' &&
              typeof a.hash === 'string'
          )
      );
      return { accounts: ensureMasterAccountFlag(valid) };
    }
    if (
      parsed &&
      (Array.isArray(parsed.bookings) ||
        Array.isArray(parsed.therapists) ||
        Array.isArray(parsed.services))
    ) {
      return {
        accounts: [],
        legacySeed: {
          therapists: Array.isArray(parsed.therapists) ? parsed.therapists : undefined,
          services: Array.isArray(parsed.services) ? parsed.services : undefined,
          bookings: Array.isArray(parsed.bookings) ? parsed.bookings : undefined,
        },
      };
    }
  } catch {
    // Abaikan jika penyimpanan rusak
  }
  return { accounts: [] };
}

function saveAccountsToStorage(accounts: UserAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts }));
  } catch {
    // Abaikan bila kuota browser penuh
  }
}

export default function App() {
  const [initialState] = useState<StoredAccountsState>(() => loadStoredAccountsState());
  const [accounts, setAccounts] = useState<UserAccount[]>(initialState.accounts);
  const [legacySeed, setLegacySeed] = useState(initialState.legacySeed);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [accountDb, setAccountDb] = useState<AccountDatabase | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayYYYYMMDD);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [prefillSlot, setPrefillSlot] = useState<{
    therapistId?: string;
    startTime?: string;
    serviceId?: string;
  }>({});
  const [prefillCustomer, setPrefillCustomer] = useState<{
    patientName: string;
    patientPhone: string;
    useLoyaltyReward?: boolean;
  } | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null);
  const [editingReceiptBooking, setEditingReceiptBooking] = useState<Booking | null>(null);
  const [reopenReceiptAfterEdit, setReopenReceiptAfterEdit] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  useEffect(() => {
    saveAccountsToStorage(accounts);
  }, [accounts]);

  const currentAccount = useMemo(
    () => accounts.find((a) => a.account_id === currentAccountId) ?? null,
    [accounts, currentAccountId]
  );

  const currentOwnerId = currentAccount ? getWorkspaceOwnerId(currentAccount) : null;

  useEffect(() => {
    if (!currentAccount || !currentOwnerId) {
      setAccountDb(null);
      return;
    }
    const ownerAcc = accounts.find((a) => a.account_id === currentOwnerId);
    const db = loadAccountDatabase(
      currentOwnerId,
      ownerAcc?.username ?? currentAccount.username
    );
    setAccountDb(db);
  }, [currentAccount, currentOwnerId, accounts]);

  const workspaceAccounts = useMemo(() => {
    if (!currentAccount || !currentOwnerId) return [];
    if (currentAccount.is_master) return accounts;
    return accounts.filter(
      (a) =>
        getWorkspaceOwnerId(a) === currentOwnerId ||
        a.created_by_owner_id === currentOwnerId
    );
  }, [accounts, currentAccount, currentOwnerId]);

  const workspaceMembers = useMemo(() => {
    if (!currentOwnerId) return [];
    return accounts.filter((a) => getWorkspaceOwnerId(a) === currentOwnerId);
  }, [accounts, currentOwnerId]);

  const updateActiveDatabase = (updater: (prev: AccountDatabase) => AccountDatabase) => {
    setAccountDb((prev) => {
      if (!prev) return prev;
      const next: AccountDatabase = {
        ...updater(prev),
        updated_at: new Date().toISOString(),
      };
      saveAccountDatabase(next);
      return next;
    });
  };

  const handleMasterSetupSuccess = (masterAccount: UserAccount) => {
    const db = loadAccountDatabase(
      masterAccount.account_id,
      masterAccount.username,
      legacySeed
    );
    setLegacySeed(undefined);
    setAccounts([masterAccount]);
    setCurrentAccountId(masterAccount.account_id);
    setAccountDb(db);
    setActiveTab('calendar');
    setNoticeMessage(
      `Akun Admin Master "${masterAccount.username}" aktif dengan database lokal tersendiri.`
    );
  };

  const handleLoginSuccess = (account: UserAccount) => {
    const ownerId = getWorkspaceOwnerId(account);
    const ownerAcc = accounts.find((a) => a.account_id === ownerId);
    const db = loadAccountDatabase(ownerId, ownerAcc?.username ?? account.username);
    setCurrentAccountId(account.account_id);
    setAccountDb(db);
    setActiveTab('calendar');
    setNoticeMessage(null);
  };

  const handleSignOut = () => {
    setCurrentAccountId(null);
    setAccountDb(null);
    setSelectedBooking(null);
    setReceiptBooking(null);
    setEditingReceiptBooking(null);
    setReopenReceiptAfterEdit(false);
    setEditingBooking(null);
    setPrefillCustomer(null);
    setFormOpen(false);
    setNoticeMessage(null);
  };

  const handleResetAllLocalData = () => {
    clearAllAccountDatabases();
    localStorage.removeItem(STORAGE_KEY);
    setAccounts([]);
    setLegacySeed(undefined);
    setCurrentAccountId(null);
    setAccountDb(null);
    setSelectedBooking(null);
    setReceiptBooking(null);
    setEditingReceiptBooking(null);
    setReopenReceiptAfterEdit(false);
    setPrefillCustomer(null);
    setNoticeMessage(null);
  };

  const handleOpenCreateModal = (
    therapistId?: string,
    startTime?: string,
    serviceId?: string
  ) => {
    setEditingBooking(null);
    setPrefillCustomer(null);
    setPrefillSlot({ therapistId, startTime, serviceId });
    setFormOpen(true);
  };

  const handleRequestSaveBooking = async (payload: {
    mode: 'create' | 'reschedule';
    bookings: Booking[];
    summaryLabel: string;
  }) => {
    const { mode, bookings: nextBookings } = payload;
    if (nextBookings.length === 0) return;

    updateActiveDatabase((prev) => ({
      ...prev,
      bookings:
        mode === 'reschedule'
          ? prev.bookings.map((b) =>
              b.booking_id === nextBookings[0].booking_id ? nextBookings[0] : b
            )
          : [...prev.bookings, ...nextBookings],
    }));

    const primaryBooking = nextBookings[0];
    if (mode === 'reschedule') {
      setNoticeMessage(`Jadwal ${primaryBooking.patient_name} berhasil diperbarui.`);
    } else {
      setSelectedDate(primaryBooking.booking_date);
      setNoticeMessage(
        nextBookings.length > 1
          ? `${nextBookings.length} paket reservasi ${primaryBooking.patient_name} berhasil disimpan.`
          : `Reservasi ${primaryBooking.patient_name} berhasil disimpan.`
      );
    }
    setFormOpen(false);
    setEditingBooking(null);
    setPrefillCustomer(null);
  };

  const handleSaveReceiptCorrection = (updatedBooking: Booking) => {
    updateActiveDatabase((prev) => ({
      ...prev,
      bookings: prev.bookings.map((b) =>
        b.booking_id === updatedBooking.booking_id ? updatedBooking : b
      ),
    }));
    setEditingReceiptBooking(null);
    if (reopenReceiptAfterEdit) {
      setReceiptBooking(updatedBooking);
      setReopenReceiptAfterEdit(false);
    }
    setNoticeMessage(
      `Resi RESI-${updatedBooking.booking_id} (${updatedBooking.patient_name}) berhasil diperbarui.`
    );
  };

  const handleRequestStatusChange = (
    booking: Booking,
    nextStatus: BookingStatus,
    discountPercent: TreatmentDiscountPercent = 0
  ) => {
    const isCancel = nextStatus === 'CANCELLED';
    const nextLabel = STATUS_LABELS[nextStatus];

    const applyStatus = async (cancelReason?: string) => {
      const now = new Date().toISOString();
      let updatedBooking: Booking;

      if (nextStatus === 'COMPLETED') {
        const matchedService = accountDb?.services.find(
          (s) => s.service_id === booking.service_id
        );
        const discountCalc = calculateTreatmentDiscount({
          basePrice: matchedService?.price ?? 0,
          discountPercent: normalizeTreatmentDiscountPercent(discountPercent),
          isLoyaltyReward: Boolean(booking.is_loyalty_reward),
        });
        updatedBooking = {
          ...booking,
          status: nextStatus,
          discount_percent: discountCalc.discountPercent,
          discount_amount: discountCalc.discountAmount,
          final_price: discountCalc.finalPrice,
          updated_at: now,
        };
        setSelectedBooking(updatedBooking);
        setNoticeMessage(
          discountCalc.discountPercent > 0
            ? `Status reservasi ${booking.patient_name} diubah menjadi Selesai (Diskon ${discountCalc.discountPercent}%, total ${formatRupiah(discountCalc.finalPrice)}).`
            : `Status reservasi ${booking.patient_name} diubah menjadi ${nextLabel}.`
        );
      } else if (nextStatus === 'CANCELLED') {
        const cancelResult = validateAndCancelBooking({
          booking,
          reason: cancelReason ?? '',
          nowIso: now,
        });
        if (!cancelResult.valid || !cancelResult.updatedBooking) {
          throw new Error(cancelResult.error ?? 'Alasan pembatalan tidak valid.');
        }
        updatedBooking = cancelResult.updatedBooking;
        setSelectedBooking(null);
        if (receiptBooking?.booking_id === booking.booking_id) {
          setReceiptBooking(null);
        }
        if (editingReceiptBooking?.booking_id === booking.booking_id) {
          setEditingReceiptBooking(null);
          setReopenReceiptAfterEdit(false);
        }
        setNoticeMessage(
          updatedBooking.cancellation_reason
            ? `Reservasi ${booking.patient_name} dibatalkan (Alasan: ${updatedBooking.cancellation_reason}).`
            : `Status reservasi ${booking.patient_name} diubah menjadi ${nextLabel}.`
        );
      } else {
        updatedBooking = {
          ...booking,
          status: nextStatus,
          updated_at: now,
        };
        setSelectedBooking(null);
        setNoticeMessage(`Status reservasi ${booking.patient_name} diubah menjadi ${nextLabel}.`);
      }

      updateActiveDatabase((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.booking_id === booking.booking_id ? updatedBooking : b
        ),
      }));
    };

    if (!isCancel) {
      void applyStatus();
      return;
    }

    const isCancellingCompleted = booking.status === 'COMPLETED';
    setConfirmDialog({
      title: isCancellingCompleted ? 'Batalkan Reservasi Selesai?' : 'Batalkan Reservasi Ini?',
      message: isCancellingCompleted
        ? 'Status reservasi akan diubah menjadi Dibatalkan dan dikeluarkan dari laporan pendapatan serta poin kesetiaan.'
        : 'Status reservasi akan diubah menjadi Dibatalkan dan slot terapis langsung tersedia kembali.',
      details: [
        `Pasien: ${booking.patient_name}`,
        `Jadwal: ${formatDateIndo(booking.booking_date)} · ${formatTimeRange(booking.start_time, booking.end_time)} WIB`,
        `Perubahan status: ${STATUS_LABELS[booking.status]} -> ${nextLabel}`,
      ],
      reasonField: {
        label: 'Alasan Pembatalan',
        placeholder: isCancellingCompleted
          ? 'Contoh: Pasien membatalkan setelah pembayaran atau salah input jadwal.'
          : 'Opsional, contoh: Pasien berhalangan hadir.',
        required: isCancellingCompleted,
        maxLength: CANCELLATION_REASON_MAX_LENGTH,
      },
      confirmLabel: isCancellingCompleted ? 'Ya, Batalkan Reservasi' : 'Ya, Batalkan Jadwal',
      tone: 'danger',
      onConfirm: applyStatus,
    });
  };

  const handleRequestSaveService = (mode: 'create' | 'edit', service: Service) => {
    const isEdit = mode === 'edit';
    updateActiveDatabase((prev) => ({
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

  const handleRequestSaveProduct = (mode: 'create' | 'edit', product: Product) => {
    const isEdit = mode === 'edit';
    updateActiveDatabase((prev) => {
      const existingProducts = prev.products ?? DEFAULT_PRODUCTS.map((p) => ({ ...p }));
      return {
        ...prev,
        products: isEdit
          ? existingProducts.map((p) => (p.product_id === product.product_id ? product : p))
          : [...existingProducts, product],
      };
    });
    setNoticeMessage(
      isEdit
        ? `Produk "${product.product_name}" berhasil diperbarui.`
        : `Produk "${product.product_name}" berhasil ditambahkan.`
    );
  };

  const handleRequestAddProductSale = (sale: ProductSale) => {
    updateActiveDatabase((prev) => ({
      ...prev,
      product_sales: [...(prev.product_sales ?? []), sale],
    }));
    const therapistName =
      therapists.find((t) => t.therapist_id === sale.therapist_id)?.name ?? sale.therapist_id;
    const commission = calculateProductSaleCommission(sale.total_amount);
    setNoticeMessage(
      `Penjualan "${sale.product_name}" (${formatRupiah(sale.total_amount)}) dicatat. Komisi 10% ${therapistName}: ${formatRupiah(commission)}.`
    );
  };

  const handleRequestCancelProductSale = (sale: ProductSale) => {
    const therapistName =
      therapists.find((t) => t.therapist_id === sale.therapist_id)?.name ?? sale.therapist_id;
    setConfirmDialog({
      title: 'Batalkan Penjualan Produk Ini?',
      message:
        'Transaksi penjualan produk akan dibatalkan sehingga omzet dan komisi 10% terapis terkait tidak lagi dihitung.',
      details: [
        `Produk: ${sale.product_name} (${sale.quantity} item)`,
        `Terapis: ${therapistName}`,
        `Omzet: ${formatRupiah(sale.total_amount)}`,
      ],
      confirmLabel: 'Ya, Batalkan Penjualan',
      tone: 'danger',
      onConfirm: async () => {
        const now = new Date().toISOString();
        const cancelledSale: ProductSale = { ...sale, status: 'CANCELLED', updated_at: now };
        updateActiveDatabase((prev) => ({
          ...prev,
          product_sales: (prev.product_sales ?? []).map((item) =>
            item.sale_id === sale.sale_id ? cancelledSale : item
          ),
        }));
        setNoticeMessage(`Penjualan produk "${sale.product_name}" dibatalkan.`);
      },
    });
  };

  const handleRequestSaveTherapists = (nextTherapists: Therapist[]) => {
    updateActiveDatabase((prev) => ({
      ...prev,
      therapists: nextTherapists,
    }));
    setNoticeMessage('Data terapis berhasil diperbarui.');
  };

  const handleAddTherapist = (newTherapist: Therapist) => {
    updateActiveDatabase((prev) => ({
      ...prev,
      therapists: [...prev.therapists, newTherapist],
    }));
    setNoticeMessage(
      `Terapis "${newTherapist.name}" berhasil ditambahkan. Buka Manajemen Akun untuk membuatkan akun login.`
    );
  };

  const handleCreateAccount = (newAcc: UserAccount) => {
    const isSeparateDb = !newAcc.owner_account_id;
    if (isSeparateDb) {
      loadAccountDatabase(newAcc.account_id, newAcc.username);
    }
    setAccounts((prev) => [...prev, newAcc]);
    setNoticeMessage(
      isSeparateDb
        ? `Akun Admin "${newAcc.username}" berhasil dibuat dengan database lokal terpisah.`
        : `Akun "${newAcc.username}" berhasil dibuat.`
    );
  };

  const handleUpdateAccount = (updatedAcc: UserAccount) => {
    setAccounts((prev) =>
      prev.map((a) => (a.account_id === updatedAcc.account_id ? updatedAcc : a))
    );
    setNoticeMessage(`Data akun "${updatedAcc.username}" berhasil diperbarui.`);
  };

  const handleRequestDeleteAccount = (targetAcc: UserAccount) => {
    const ownsSeparateDb = !targetAcc.owner_account_id;
    setConfirmDialog({
      title: 'Hapus Akun Login Ini?',
      message: ownsSeparateDb
        ? `Akun "${targetAcc.username}" dan database lokal terpisahnya akan dihapus dari browser.`
        : `Akun "${targetAcc.username}" akan dihapus dan tidak dapat masuk lagi.`,
      confirmLabel: 'Ya, Hapus Akun',
      tone: 'danger',
      onConfirm: async () => {
        if (ownsSeparateDb) {
          deleteAccountDatabase(targetAcc.account_id);
        }
        setAccounts((prev) =>
          prev.filter(
            (a) =>
              a.account_id !== targetAcc.account_id &&
              (!ownsSeparateDb || a.owner_account_id !== targetAcc.account_id)
          )
        );
        setNoticeMessage(`Akun "${targetAcc.username}" telah dihapus.`);
      },
    });
  };

  const handleRequestImportDatabase = (importedDb: AccountDatabase) => {
    setConfirmDialog({
      title: `Pulihkan Database (${importedDb.owner_username})?`,
      message:
        'Seluruh data terapis, layanan, dan reservasi pada akun ini akan diganti dengan isi file JSON cadangan.',
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
        setNoticeMessage('Database akun berhasil dipulihkan.');
      },
    });
  };

  const handleRequestImportMasterBundle = (bundle: MasterBundlePayload) => {
    setConfirmDialog({
      title: 'Pulihkan Paket Master (.json)?',
      message:
        'Seluruh daftar akun dan database di browser ini akan diganti dengan isi file Paket Master.',
      details: [
        `Jumlah akun: ${bundle.accounts.length} akun`,
        `Jumlah database: ${Object.keys(bundle.databases).length} ruang kerja`,
      ],
      confirmLabel: 'Ya, Pulihkan Paket Master',
      tone: 'primary',
      onConfirm: async () => {
        const restoredAccounts = restoreMasterBundle(bundle);
        setAccounts(restoredAccounts);
        const matchingActive = restoredAccounts.find(
          (a) => a.account_id === currentAccountId && a.is_active
        );
        if (!matchingActive) {
          setCurrentAccountId(null);
          setAccountDb(null);
        } else {
          const ownerId = getWorkspaceOwnerId(matchingActive);
          const ownerAcc = restoredAccounts.find((a) => a.account_id === ownerId);
          const restoredDb = loadAccountDatabase(ownerId, ownerAcc?.username ?? matchingActive.username);
          setAccountDb(restoredDb);
        }
        setNoticeMessage('Paket Master berhasil dipulihkan.');
      },
    });
  };

  const handleRequestResetDatabase = () => {
    if (!accountDb) return;
    setConfirmDialog({
      title: `Reset Database (${accountDb.owner_username})?`,
      message:
        'Seluruh riwayat reservasi pada database akun ini akan dihapus, sedangkan data terapis dan layanan dikembalikan ke pengaturan awal.',
      confirmLabel: 'Ya, Reset Database',
      tone: 'danger',
      onConfirm: async () => {
        const fresh = resetAccountDatabase(
          accountDb.owner_account_id,
          accountDb.owner_username
        );
        setAccountDb(fresh);
        setNoticeMessage('Database akun telah direset ke pengaturan awal.');
      },
    });
  };

  if (!currentAccount || !accountDb) {
    return (
      <AdminLockScreen
        accounts={accounts}
        onLoginSuccess={handleLoginSuccess}
        onMasterSetupSuccess={handleMasterSetupSuccess}
        onImportMasterBundle={(restoredAccounts) => {
          setAccounts(restoredAccounts);
          setLegacySeed(undefined);
        }}
        onResetAllData={handleResetAllLocalData}
      />
    );
  }

  const { therapists, services, bookings } = accountDb;
  const products = accountDb.products ?? DEFAULT_PRODUCTS;
  const productSales = accountDb.product_sales ?? [];
  const selectedBookingService = selectedBooking
    ? services.find((s) => s.service_id === selectedBooking.service_id)
    : undefined;
  const selectedBookingTherapist = selectedBooking
    ? therapists.find((t) => t.therapist_id === selectedBooking.therapist_id)
    : undefined;
  const selectedBookingGroupCount = selectedBooking?.order_group_id
    ? bookings.filter((b) => b.order_group_id === selectedBooking.order_group_id).length
    : undefined;
  const selectedBookingCompletedGroupCount =
    selectedBooking && selectedBooking.status === 'COMPLETED'
      ? findSameTimeCompletedBookings(selectedBooking, bookings).length
      : undefined;
  const receiptService = receiptBooking
    ? services.find((s) => s.service_id === receiptBooking.service_id)
    : undefined;
  const receiptTherapist = receiptBooking
    ? therapists.find((t) => t.therapist_id === receiptBooking.therapist_id)
    : undefined;

  const isAdmin = currentAccount.role === 'ADMIN';
  const activeTherapistProfile =
    currentAccount.role === 'THERAPIST' && currentAccount.therapist_id
      ? therapists.find((t) => t.therapist_id === currentAccount.therapist_id)
      : undefined;

  return (
    <>
    <div className="min-h-screen bg-neutral-50 text-neutral-900 print:hidden">
      {/* Bilah navigasi atas */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          {/* Baris atas: merek di tengah dan menu akun di kanan atas */}
          <div className="flex flex-col items-center gap-3 py-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4">
            <div className="hidden md:block" aria-hidden="true" />

            <div className="flex items-center justify-center gap-3">
              <img
                src={CLINIC_LOGO_SRC}
                alt={`Logo ${CLINIC_NAME}`}
                className="h-10 w-10 shrink-0 rounded-full border border-neutral-200 object-cover"
              />
              <span className="whitespace-nowrap text-lg font-bold tracking-tight text-neutral-900">
                {CLINIC_NAME}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
              <AccountMenu
                currentAccount={currentAccount}
                displayLabel={activeTherapistProfile?.name ?? currentAccount.display_name}
                onOpenAccountManagement={() => setActiveTab('accounts')}
                onPasswordUpdated={(updated) => {
                  setAccounts((prev) =>
                    prev.map((a) => (a.account_id === updated.account_id ? updated : a))
                  );
                  setNoticeMessage('Kata sandi akun Anda berhasil diperbarui.');
                }}
                onSignOut={handleSignOut}
              />
            </div>
          </div>

          {/* Baris navigasi tab dan aksi utama */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 py-2">
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
                    onClick={() => setActiveTab('loyalty')}
                    className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                      activeTab === 'loyalty'
                        ? 'border-amber-700 text-amber-800'
                        : 'border-transparent text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <Gift className="h-4 w-4" />
                    <span>Pelanggan</span>
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
                    onClick={() => setActiveTab('receipts')}
                    className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${
                      activeTab === 'receipts'
                        ? 'border-amber-700 text-amber-800'
                        : 'border-transparent text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <FilePenLine className="h-4 w-4" />
                    <span>Perbaikan Resi</span>
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

            {isAdmin && (
              <button
                type="button"
                onClick={() => handleOpenCreateModal(undefined, '10:00')}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                <Plus className="h-4 w-4" />
                <span>Buat Reservasi</span>
              </button>
            )}
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
            onCreateWithService={
              isAdmin
                ? (serviceId) => handleOpenCreateModal(undefined, '10:00', serviceId)
                : undefined
            }
            onSelectBooking={(booking) => setSelectedBooking(booking)}
          />
        )}

        {isAdmin && activeTab === 'services' && (
          <ServicesView
            services={services}
            products={products}
            productSales={productSales}
            therapists={therapists}
            defaultDate={selectedDate}
            onRequestSaveService={handleRequestSaveService}
            onRequestSaveProduct={handleRequestSaveProduct}
            onRequestAddProductSale={handleRequestAddProductSale}
            onRequestCancelProductSale={handleRequestCancelProductSale}
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

        {isAdmin && activeTab === 'loyalty' && (
          <LoyaltyView
            bookings={bookings}
            services={services}
            onBookWithCustomer={(prefill) => {
              setEditingBooking(null);
              setPrefillSlot({});
              setPrefillCustomer(prefill);
              setFormOpen(true);
            }}
          />
        )}

        {isAdmin && activeTab === 'revenue' && (
          <RevenueSummaryView
            bookings={bookings}
            services={services}
            therapists={therapists}
            productSales={productSales}
            defaultDate={selectedDate}
          />
        )}

        {isAdmin && activeTab === 'receipts' && (
          <ReceiptsView
            bookings={bookings}
            services={services}
            therapists={therapists}
            onEditReceipt={(booking) => {
              setReopenReceiptAfterEdit(false);
              setEditingReceiptBooking(booking);
            }}
            onPrintReceipt={(booking) => setReceiptBooking(booking)}
          />
        )}

        {isAdmin && activeTab === 'accounts' && (
          <AccountsView
            accounts={workspaceAccounts}
            allAccounts={accounts}
            therapists={therapists}
            currentAccount={currentAccount}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
            onRequestDeleteAccount={handleRequestDeleteAccount}
          />
        )}

        {isAdmin && activeTab === 'database' && (
          <DatabasePanel
            database={accountDb}
            allAccounts={accounts}
            onRequestImportDatabase={handleRequestImportDatabase}
            onRequestImportMasterBundle={handleRequestImportMasterBundle}
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
            setPrefillCustomer(null);
          }}
          services={services}
          therapists={therapists}
          bookings={bookings}
          initialDate={selectedDate}
          initialStartTime={prefillSlot.startTime}
          initialTherapistId={prefillSlot.therapistId}
          initialServiceId={prefillSlot.serviceId}
          initialCustomer={prefillCustomer}
          editingBooking={editingBooking}
          onRequestSave={handleRequestSaveBooking}
        />
      )}

      <BookingDetailModal
        booking={selectedBooking}
        service={selectedBookingService}
        therapist={selectedBookingTherapist}
        groupPackagesCount={selectedBookingGroupCount}
        completedGroupCount={selectedBookingCompletedGroupCount}
        userRole={currentAccount.role}
        onClose={() => setSelectedBooking(null)}
        onRequestStatusChange={handleRequestStatusChange}
        onStartReschedule={(booking) => {
          setSelectedBooking(null);
          setPrefillCustomer(null);
          setEditingBooking(booking);
          setFormOpen(true);
        }}
        onOpenReceipt={(booking) => {
          setSelectedBooking(null);
          setReceiptBooking(booking);
        }}
        onEditReceipt={
          isAdmin
            ? (booking) => {
                setSelectedBooking(null);
                setReopenReceiptAfterEdit(false);
                setEditingReceiptBooking(booking);
              }
            : undefined
        }
      />

      {isAdmin && (
        <ReceiptEditModal
          booking={editingReceiptBooking}
          services={services}
          therapists={therapists}
          allBookings={bookings}
          onClose={() => {
            setEditingReceiptBooking(null);
            setReopenReceiptAfterEdit(false);
          }}
          onSaveCorrection={handleSaveReceiptCorrection}
        />
      )}

      <ConfirmDialog
        dialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
    </div>

    <ReceiptModal
      booking={receiptBooking}
      service={receiptService}
      therapist={receiptTherapist}
      allBookings={bookings}
      services={services}
      therapists={therapists}
      onClose={() => setReceiptBooking(null)}
      onEditReceipt={
        isAdmin
          ? (booking) => {
              setReceiptBooking(null);
              setReopenReceiptAfterEdit(true);
              setEditingReceiptBooking(booking);
            }
          : undefined
      }
    />
    </>
  );
}
