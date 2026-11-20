// Inisialisasi Firebase App, Auth, Firestore (menggunakan firestoreDatabaseId dari konfigurasi), dan uji koneksi awal.

import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app =
  getApps().find((existing) => existing.name === '[DEFAULT]') ??
  initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export function getProvisionerAuth() {
  const appName = 'AccountProvisioner';
  const secondary =
    getApps().find((existing) => existing.name === appName) ??
    initializeApp(firebaseConfig, appName);
  return getAuth(secondary);
}

export function usernameToInternalEmail(username: string): string {
  const clean = username.trim().toLowerCase();
  if (clean.includes('@')) return clean;
  const safeLocal = clean.replace(/[^a-z0-9._-]/g, '');
  return `${safeLocal}@naomi.klinik`;
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
