// Utilitas manajemen akun login Google maupun akun lokal SHA-256 di browser.

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

export function createGoogleAccount(params: {
  google_email: string;
  display_name: string;
  role: UserRole;
  therapist_id?: string;
  is_active?: boolean;
}): UserAccount {
  const cleanEmail = params.google_email.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  return {
    account_id: `ACC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
    auth_method: 'GOOGLE',
    google_email: cleanEmail,
    username: cleanEmail,
    display_name: params.display_name.trim() || cleanEmail,
    role: params.role,
    therapist_id: params.role === 'THERAPIST' ? params.therapist_id : undefined,
    salt: '',
    hash: '',
    is_active: params.is_active ?? true,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export async function createUserAccount(params: {
  username: string;
  display_name: string;
  password: string;
  role: UserRole;
  therapist_id?: string;
  is_active?: boolean;
  google_email?: string;
}): Promise<UserAccount> {
  const cleanUser = params.username.trim();
  const cleanEmail = params.google_email?.trim().toLowerCase() || undefined;
  const salt = generateRandomSalt();
  const hash = await hashAccountSecret(salt, cleanUser, params.password);
  const nowIso = new Date().toISOString();

  return {
    account_id: `ACC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
    auth_method: cleanEmail ? 'GOOGLE' : 'LOCAL',
    google_email: cleanEmail,
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
  if (!found || !found.hash || !found.salt) {
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

export type ResolveGoogleLoginResult =
  | {
      ok: true;
      account: UserAccount;
      nextAccounts: UserAccount[];
      isAutoProvisioned: boolean;
    }
  | { ok: false; reason: string };

export function resolveGoogleLogin(
  accounts: UserAccount[],
  googleEmail: string,
  googleDisplayName?: string | null
): ResolveGoogleLoginResult {
  const cleanEmail = googleEmail.trim().toLowerCase();
  if (!cleanEmail) {
    return { ok: false, reason: 'Email akun Google tidak terbaca.' };
  }

  const exactMatch = accounts.find(
    (acc) => acc.google_email?.trim().toLowerCase() === cleanEmail
  );

  if (exactMatch) {
    if (!exactMatch.is_active) {
      return {
        ok: false,
        reason: `Akun Google ${googleEmail} sedang dinonaktifkan oleh Admin klinik.`,
      };
    }
    return {
      ok: true,
      account: exactMatch,
      nextAccounts: accounts,
      isAutoProvisioned: false,
    };
  }

  const hasAnyGoogleAccount = accounts.some((acc) => Boolean(acc.google_email?.trim()));

  // Bila belum ada akun Google terdaftar sama sekali, otomatis tautkan/daftarkan sebagai Admin utama
  if (!hasAnyGoogleAccount) {
    const existingAdmin = accounts.find((acc) => acc.role === 'ADMIN' && acc.is_active);
    if (existingAdmin) {
      const linkedAdmin: UserAccount = {
        ...existingAdmin,
        auth_method: 'GOOGLE',
        google_email: cleanEmail,
        display_name: googleDisplayName?.trim() || existingAdmin.display_name,
        updated_at: new Date().toISOString(),
      };
      return {
        ok: true,
        account: linkedAdmin,
        nextAccounts: accounts.map((acc) =>
          acc.account_id === linkedAdmin.account_id ? linkedAdmin : acc
        ),
        isAutoProvisioned: true,
      };
    }

    const firstAdmin = createGoogleAccount({
      google_email: cleanEmail,
      display_name: googleDisplayName?.trim() || 'Admin Klinik',
      role: 'ADMIN',
      is_active: true,
    });
    return {
      ok: true,
      account: firstAdmin,
      nextAccounts: [...accounts, firstAdmin],
      isAutoProvisioned: true,
    };
  }

  return {
    ok: false,
    reason: `Email Google ${googleEmail} belum terdaftar di sistem klinik. Minta Admin mendaftarkan email tersebut di Manajemen Akun.`,
  };
}

export function migrateLegacyLockToAccount(
  legacyLock: AdminLockRecord | null | undefined
): UserAccount[] {
  if (!legacyLock) return [];
  return [
    {
      account_id: 'ACC-ADMIN-1',
      auth_method: 'LOCAL',
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
