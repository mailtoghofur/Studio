// Sistem database sederhana di browser yang tersimpan terpisah sesuai akun pemilik (owner_account_id), termasuk paket ekspor/impor Master lintas browser.

import {
  DB_KEY_PREFIX,
  DEFAULT_PRODUCTS,
  DEFAULT_SERVICES,
  DEFAULT_THERAPISTS,
} from '../config';
import { ensureMasterAccountFlag, getWorkspaceOwnerId } from './adminLock';
import type {
  AccountDatabase,
  Booking,
  MasterBundlePayload,
  Product,
  ProductSale,
  Service,
  Therapist,
  UserAccount,
} from './types';

export function getDatabaseStorageKey(ownerAccountId: string): string {
  return `${DB_KEY_PREFIX}${ownerAccountId}`;
}

function createFreshDatabase(
  ownerAccountId: string,
  ownerUsername: string,
  seed?: {
    therapists?: Therapist[];
    services?: Service[];
    bookings?: Booking[];
    products?: Product[];
    product_sales?: ProductSale[];
  }
): AccountDatabase {
  return {
    database_id: `DB-${ownerAccountId}`,
    owner_account_id: ownerAccountId,
    owner_username: ownerUsername,
    therapists:
      seed?.therapists && seed.therapists.length > 0
        ? seed.therapists
        : DEFAULT_THERAPISTS.map((t) => ({ ...t })),
    services:
      seed?.services && seed.services.length > 0
        ? seed.services
        : DEFAULT_SERVICES.map((s) => ({ ...s })),
    bookings: seed?.bookings ? [...seed.bookings] : [],
    products:
      seed?.products && seed.products.length > 0
        ? seed.products
        : DEFAULT_PRODUCTS.map((p) => ({ ...p })),
    product_sales: seed?.product_sales ? [...seed.product_sales] : [],
    updated_at: new Date().toISOString(),
  };
}

export function loadAccountDatabase(
  ownerAccountId: string,
  ownerUsername: string,
  legacySeed?: {
    therapists?: Therapist[];
    services?: Service[];
    bookings?: Booking[];
    products?: Product[];
    product_sales?: ProductSale[];
  }
): AccountDatabase {
  const key = getDatabaseStorageKey(ownerAccountId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccountDatabase>;
      if (parsed && typeof parsed === 'object') {
        return {
          database_id:
            typeof parsed.database_id === 'string' && parsed.database_id
              ? parsed.database_id
              : `DB-${ownerAccountId}`,
          owner_account_id: ownerAccountId,
          owner_username: parsed.owner_username || ownerUsername,
          therapists:
            Array.isArray(parsed.therapists) && parsed.therapists.length > 0
              ? parsed.therapists
              : DEFAULT_THERAPISTS.map((t) => ({ ...t })),
          services:
            Array.isArray(parsed.services) && parsed.services.length > 0
              ? parsed.services
              : DEFAULT_SERVICES.map((s) => ({ ...s })),
          bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
          products:
            Array.isArray(parsed.products) && parsed.products.length > 0
              ? parsed.products
              : DEFAULT_PRODUCTS.map((p) => ({ ...p })),
          product_sales: Array.isArray(parsed.product_sales) ? parsed.product_sales : [],
          updated_at:
            typeof parsed.updated_at === 'string'
              ? parsed.updated_at
              : new Date().toISOString(),
        };
      }
    }
  } catch {
    // Gunakan database baru jika data tersimpan rusak
  }

  const fresh = createFreshDatabase(ownerAccountId, ownerUsername, legacySeed);
  saveAccountDatabase(fresh);
  return fresh;
}

export function saveAccountDatabase(db: AccountDatabase): void {
  try {
    const key = getDatabaseStorageKey(db.owner_account_id);
    const payload: AccountDatabase = {
      ...db,
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Abaikan bila penyimpanan browser dibatasi
  }
}

export function resetAccountDatabase(
  ownerAccountId: string,
  ownerUsername: string
): AccountDatabase {
  const fresh = createFreshDatabase(ownerAccountId, ownerUsername);
  saveAccountDatabase(fresh);
  return fresh;
}

export function deleteAccountDatabase(ownerAccountId: string): void {
  try {
    localStorage.removeItem(getDatabaseStorageKey(ownerAccountId));
  } catch {
    // Abaikan kesalahan penyimpanan
  }
}

export function clearAllAccountDatabases(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DB_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Abaikan kesalahan penyimpanan
  }
}

export function exportAccountDatabaseJson(db: AccountDatabase): void {
  const content = JSON.stringify(db, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeUser = db.owner_username.replace(/[^a-zA-Z0-9_-]/g, '_') || 'klinik';
  link.href = url;
  link.download = `database-${safeUser}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseAccountDatabaseJson(
  rawText: string,
  ownerAccountId: string,
  ownerUsername: string
): AccountDatabase {
  const parsed = JSON.parse(rawText) as Partial<AccountDatabase>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Format file database tidak valid.');
  }
  if (
    !Array.isArray(parsed.therapists) ||
    !Array.isArray(parsed.services) ||
    !Array.isArray(parsed.bookings)
  ) {
    throw new Error('File JSON harus memuat daftar terapis, layanan, dan reservasi.');
  }
  return {
    database_id: `DB-${ownerAccountId}`,
    owner_account_id: ownerAccountId,
    owner_username: ownerUsername,
    therapists:
      parsed.therapists.length > 0
        ? parsed.therapists
        : DEFAULT_THERAPISTS.map((t) => ({ ...t })),
    services:
      parsed.services.length > 0
        ? parsed.services
        : DEFAULT_SERVICES.map((s) => ({ ...s })),
    bookings: parsed.bookings,
    products:
      Array.isArray(parsed.products) && parsed.products.length > 0
        ? parsed.products
        : DEFAULT_PRODUCTS.map((p) => ({ ...p })),
    product_sales: Array.isArray(parsed.product_sales) ? parsed.product_sales : [],
    updated_at: new Date().toISOString(),
  };
}

export function collectAllAccountDatabases(
  accounts: UserAccount[]
): Record<string, AccountDatabase> {
  const databases: Record<string, AccountDatabase> = {};
  const ownerMap = new Map<string, string>();

  for (const acc of accounts) {
    const ownerId = getWorkspaceOwnerId(acc);
    if (!ownerMap.has(ownerId)) {
      const ownerAccount = accounts.find((a) => a.account_id === ownerId);
      ownerMap.set(ownerId, ownerAccount?.username ?? acc.username);
    }
  }

  for (const [ownerId, ownerUsername] of ownerMap.entries()) {
    databases[ownerId] = loadAccountDatabase(ownerId, ownerUsername);
  }

  return databases;
}

export function exportMasterBundleJson(accounts: UserAccount[]): void {
  const databases = collectAllAccountDatabases(accounts);
  const payload: MasterBundlePayload = {
    version: 1,
    exported_at: new Date().toISOString(),
    accounts,
    databases,
  };
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'paket-master-naomi.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseMasterBundleJson(rawText: string): MasterBundlePayload {
  const parsed = JSON.parse(rawText) as Partial<MasterBundlePayload>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Format file paket master tidak valid.');
  }
  if (!Array.isArray(parsed.accounts) || parsed.accounts.length === 0) {
    throw new Error('File JSON tidak memuat daftar akun pengguna.');
  }

  const validAccounts = parsed.accounts.filter(
    (acc): acc is UserAccount =>
      Boolean(
        acc &&
          typeof acc.account_id === 'string' &&
          typeof acc.username === 'string' &&
          (acc.role === 'ADMIN' || acc.role === 'THERAPIST') &&
          typeof acc.salt === 'string' &&
          typeof acc.hash === 'string'
      )
  );

  if (validAccounts.length === 0 || !validAccounts.some((a) => a.role === 'ADMIN')) {
    throw new Error('File paket master harus memuat minimal satu akun Admin yang valid.');
  }

  const normalizedAccounts = ensureMasterAccountFlag(validAccounts);
  const rawDbs =
    parsed.databases && typeof parsed.databases === 'object' ? parsed.databases : {};
  const databases: Record<string, AccountDatabase> = {};

  for (const acc of normalizedAccounts) {
    const ownerId = getWorkspaceOwnerId(acc);
    if (databases[ownerId]) continue;
    const ownerAcc = normalizedAccounts.find((a) => a.account_id === ownerId);
    const ownerUsername = ownerAcc?.username ?? acc.username;
    const candidate = rawDbs[ownerId];
    if (
      candidate &&
      Array.isArray(candidate.therapists) &&
      Array.isArray(candidate.services) &&
      Array.isArray(candidate.bookings)
    ) {
      databases[ownerId] = {
        database_id: candidate.database_id || `DB-${ownerId}`,
        owner_account_id: ownerId,
        owner_username: candidate.owner_username || ownerUsername,
        therapists:
          candidate.therapists.length > 0
            ? candidate.therapists
            : DEFAULT_THERAPISTS.map((t) => ({ ...t })),
        services:
          candidate.services.length > 0
            ? candidate.services
            : DEFAULT_SERVICES.map((s) => ({ ...s })),
        bookings: candidate.bookings,
        products:
          Array.isArray(candidate.products) && candidate.products.length > 0
            ? candidate.products
            : DEFAULT_PRODUCTS.map((p) => ({ ...p })),
        product_sales: Array.isArray(candidate.product_sales) ? candidate.product_sales : [],
        updated_at: candidate.updated_at || new Date().toISOString(),
      };
    } else {
      databases[ownerId] = createFreshDatabase(ownerId, ownerUsername);
    }
  }

  return {
    version: 1,
    exported_at:
      typeof parsed.exported_at === 'string' ? parsed.exported_at : new Date().toISOString(),
    accounts: normalizedAccounts,
    databases,
  };
}

export function restoreMasterBundle(bundle: MasterBundlePayload): UserAccount[] {
  clearAllAccountDatabases();
  for (const db of Object.values(bundle.databases)) {
    saveAccountDatabase(db);
  }
  return ensureMasterAccountFlag(bundle.accounts);
}
