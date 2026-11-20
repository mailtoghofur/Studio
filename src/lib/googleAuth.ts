// Autentikasi Google melalui Firebase Auth di browser dan penyimpanan token akses hanya di memori.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { OAUTH_SCOPES } from '../config';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let isSigningIn = false;
let cachedAccessToken: string | null = null;

function buildProvider(options?: { loginHint?: string; forceSelectAccount?: boolean }): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of OAUTH_SCOPES) {
    provider.addScope(scope);
  }

  const customParams: Record<string, string> = {};
  if (options?.loginHint && !options.forceSelectAccount) {
    customParams.login_hint = options.loginHint;
  } else {
    customParams.prompt = 'select_account';
  }
  provider.setCustomParameters(customParams);
  return provider;
}

export function initAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthNeedsToken?: (user: User) => void,
  onAuthSignedOut?: () => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthNeedsToken?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthSignedOut?.();
    }
  });
}

export async function googleSignIn(options?: {
  loginHint?: string;
  forceSelectAccount?: boolean;
}): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const provider = buildProvider(options);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Token akses Google Sheets tidak diperoleh saat masuk.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearAccessToken(): void {
  cachedAccessToken = null;
}

export async function logout(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}
