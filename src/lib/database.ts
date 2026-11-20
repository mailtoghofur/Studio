// Sistem database sederhana di browser yang tersimpan terpisah sesuai akun pemilik (owner_account_id).

import { DB_KEY_PREFIX, DEFAULT_SERVICES, DEFAULT_THERAPISTS } from '../config';
import type { AccountDatabase, Booking, Service, Therapist } from './types';

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
  if (!Array.isArray(parsed.therapists) || !Array.isArray(parsed.services) || !Array.isArray(parsed.bookings)) {
    throw new Error('File JSON harus memuat daftar terapis, layanan, dan reservasi.');
  }
  return {
    database_id: `DB-${ownerAccountId}`,
    owner_account_id: ownerAccountId,
    owner_username: ownerUsername,
    therapists: parsed.therapists.length > 0 ? parsed.therapists : DEFAULT_THERAPISTS.map((t) => ({ ...t })),
    services: parsed.services.length > 0 ? parsed.services : DEFAULT_SERVICES.map((s) => ({ ...s })),
    bookings: parsed.bookings,
    updated_at: new Date().toISOString(),
  };
}
