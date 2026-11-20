// Utilitas manajemen akun dan verifikasi hash SHA-256 di browser tanpa menyimpan kata sandi asli.

import type { UserAccount, UserRole } from './types';

export interface AdminLockRecord {
  username: string;
  salt: string;
  hash: string;
  createdAt: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRandomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashAccountSecret(
  salt: string,
  username: string,
  password: string
): Promise<string> {
  const normalizedUser = username.trim().toLowerCase();
  const payload = `${salt}:${normalizedUser}:${password}`;
  const encoded = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(digest));
}

export async function createUserAccount(params: {
  username: string;
  display_name: string;
  password: string;
  role: UserRole;
  therapist_id?: string;
  is_active?: boolean;
}): Promise<UserAccount> {
  const cleanUser = params.username.trim();
  const salt = generateRandomSalt();
  const hash = await hashAccountSecret(salt, cleanUser, params.password);
  const nowIso = new Date().toISOString();

  return {
    account_id: `ACC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
    username: cleanUser,
    display_name: params.display_name.trim() || cleanUser,
    role: params.role,
    therapist_id: params.role === 'THERAPIST' ? params.therapist_id : undefined,
    salt,
    hash,
    is_active: params.is_active ?? true,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export async function updateAccountPassword(
  account: UserAccount,
  newPassword: string,
  nextUsername?: string
): Promise<UserAccount> {
  const targetUser = (nextUsername ?? account.username).trim();
  const salt = generateRandomSalt();
  const hash = await hashAccountSecret(salt, targetUser, newPassword);
  return {
    ...account,
    username: targetUser,
    salt,
    hash,
    updated_at: new Date().toISOString(),
  };
}

export type VerifyLoginResult =
  | { ok: true; account: UserAccount }
  | { ok: false; reason: string };

export async function verifyAccountLogin(
  accounts: UserAccount[],
  username: string,
  password: string
): Promise<VerifyLoginResult> {
  const cleanUser = username.trim().toLowerCase();
  const found = accounts.find((acc) => acc.username.trim().toLowerCase() === cleanUser);
  if (!found) {
    return {
      ok: false,
      reason: 'Nama pengguna atau kata sandi tidak sesuai. Periksa kembali isian Anda.',
    };
  }

  const candidateHash = await hashAccountSecret(found.salt, found.username, password);
  if (candidateHash !== found.hash) {
    return {
      ok: false,
      reason: 'Nama pengguna atau kata sandi tidak sesuai. Periksa kembali isian Anda.',
    };
  }

  if (!found.is_active) {
    return {
      ok: false,
      reason: 'Akun ini sedang dinonaktifkan oleh Admin. Hubungi admin klinik untuk mengaktifkan kembali.',
    };
  }

  return { ok: true, account: found };
}

export function migrateLegacyLockToAccount(
  legacyLock: AdminLockRecord | null | undefined
): UserAccount[] {
  if (!legacyLock) return [];
  return [
    {
      account_id: 'ACC-ADMIN-1',
      username: legacyLock.username,
      display_name: 'Admin Klinik',
      role: 'ADMIN',
      salt: legacyLock.salt,
      hash: legacyLock.hash,
      is_active: true,
      created_at: legacyLock.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}
