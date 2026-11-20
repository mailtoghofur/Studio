// Utilitas akun pengguna lokal dengan hashing SHA-256 ber-salt di browser tanpa server atau Firebase.

import type { UserAccount, UserRole } from './types';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRandomSalt(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

export async function hashAccountSecret(secret: string, salt: string): Promise<string> {
  const input = `${salt}:${secret}`;
  if (globalThis.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return bytesToHex(new Uint8Array(digest));
  }

  // Fallback deterministik hanya jika Web Crypto subtle tidak tersedia pada konteks non-standar
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x01000193);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function getWorkspaceOwnerId(account: UserAccount): string {
  return account.owner_account_id || account.account_id;
}

export function ensureMasterAccountFlag(accounts: UserAccount[]): UserAccount[] {
  if (accounts.length === 0) return [];
  const hasMaster = accounts.some((a) => a.role === 'ADMIN' && a.is_master);
  if (hasMaster) {
    return accounts.map((a) => ({
      ...a,
      is_master: Boolean(a.is_master && a.role === 'ADMIN'),
    }));
  }
  let assigned = false;
  return accounts.map((a) => {
    if (!assigned && a.role === 'ADMIN' && a.is_active) {
      assigned = true;
      return { ...a, is_master: true };
    }
    if (!assigned && a.role === 'ADMIN') {
      assigned = true;
      return { ...a, is_master: true, is_active: true };
    }
    return { ...a, is_master: false };
  });
}

export async function createUserAccount(params: {
  account_id?: string;
  username: string;
  display_name: string;
  password: string;
  role: UserRole;
  therapist_id?: string;
  owner_account_id?: string;
  created_by_owner_id?: string;
  is_master?: boolean;
}): Promise<UserAccount> {
  const now = new Date().toISOString();
  const salt = generateRandomSalt();
  const hash = await hashAccountSecret(params.password, salt);
  const id =
    params.account_id ||
    `ACC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  return {
    account_id: id,
    username: params.username.trim(),
    display_name: params.display_name.trim() || params.username.trim(),
    role: params.role,
    therapist_id: params.role === 'THERAPIST' ? params.therapist_id : undefined,
    owner_account_id: params.owner_account_id,
    created_by_owner_id: params.created_by_owner_id,
    is_master: Boolean(params.role === 'ADMIN' && params.is_master),
    salt,
    hash,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

export async function updateAccountPassword(
  account: UserAccount,
  newPassword: string
): Promise<UserAccount> {
  const salt = generateRandomSalt();
  const hash = await hashAccountSecret(newPassword, salt);
  return {
    ...account,
    salt,
    hash,
    updated_at: new Date().toISOString(),
  };
}

export async function verifyAccountLogin(
  accounts: UserAccount[],
  usernameInput: string,
  passwordInput: string
): Promise<{ ok: true; account: UserAccount } | { ok: false; error: string }> {
  const cleanUser = usernameInput.trim().toLowerCase();
  if (!cleanUser || !passwordInput) {
    return { ok: false, error: 'Masukkan nama pengguna dan kata sandi.' };
  }

  const found = accounts.find((acc) => acc.username.trim().toLowerCase() === cleanUser);
  if (!found) {
    return { ok: false, error: 'Nama pengguna atau kata sandi salah.' };
  }

  const computedHash = await hashAccountSecret(passwordInput, found.salt);
  if (computedHash !== found.hash) {
    return { ok: false, error: 'Nama pengguna atau kata sandi salah.' };
  }

  if (!found.is_active) {
    return {
      ok: false,
      error: 'Akun ini sedang dinonaktifkan oleh Admin. Hubungi Admin klinik Anda.',
    };
  }

  return { ok: true, account: found };
}
