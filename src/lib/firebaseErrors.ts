// Penanganan terstruktur error Firestore (OperationType & FirestoreErrorInfo) serta terjemahan error autentikasi Firebase.

import { FirebaseError } from 'firebase/app';
import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isAuthProviderDisabledError(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    return (
      error.code === 'auth/operation-not-allowed' ||
      error.code === 'auth/admin-restricted-operation'
    );
  }
  return false;
}

export function formatFirebaseAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Nama pengguna atau kata sandi tidak sesuai. Periksa kembali isian Anda.';
      case 'auth/email-already-in-use':
        return 'Username tersebut sudah terdaftar di database cloud. Pilih username lain.';
      case 'auth/weak-password':
        return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
      case 'auth/operation-not-allowed':
      case 'auth/admin-restricted-operation':
        return 'Metode login Email/Password belum diaktifkan di Firebase Console proyek ini.';
      case 'auth/too-many-requests':
        return 'Terlalu banyak percobaan masuk. Tunggu beberapa saat lalu coba lagi.';
      case 'auth/network-request-failed':
        return 'Koneksi internet terputus. Periksa jaringan Anda lalu coba lagi.';
      case 'auth/requires-recent-login':
        return 'Sesi terlalu lama. Silakan keluar lalu masuk kembali sebelum mengubah kata sandi.';
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses autentikasi.';
}
