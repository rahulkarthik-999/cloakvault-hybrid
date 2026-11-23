import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import {
  getAuth,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import {
  getRemoteConfig,
  fetchAndActivate,
  getString,
  getBoolean,
  getNumber,
  type RemoteConfig,
} from 'firebase/remote-config';
import type { HybridInferenceMode, RemotePolicyConfig } from '../types/vault';

const LOCAL_CONFIG_STORAGE_KEY = 'cloakvault_firebase_override_v1';

export const DEFAULT_REMOTE_POLICY: RemotePolicyConfig = {
  defaultQaMode: 'prefer_on_device',
  deepAuditMode: 'prefer_in_cloud',
  cloudModelName: 'gemini-4-hydrogen',
  strictPiiShield: true,
  maxLocalContextChars: 7500,
  source: 'DEFAULT',
};

export interface FirebaseBundle {
  configured: boolean;
  app: FirebaseApp | null;
  ai: AI | null;
  appCheck: AppCheck | null;
  auth: Auth | null;
  db: Firestore | null;
  remoteConfig: RemoteConfig | null;
  projectId: string | null;
  authDomain: string | null;
  initError: string | null;
}

const CUSTOM_AUTH_HOSTS = new Set(['cloakvault.buzz', 'www.cloakvault.buzz']);

export function resolveAuthDomain(projectId: string, fallbackAuthDomain?: string): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    // Stay on the custom domain so Google OAuth & Firebase Auth popups use
    // https://cloakvault.buzz/__/auth/handler instead of redirecting through web.app / firebaseapp.com.
    if (CUSTOM_AUTH_HOSTS.has(host)) {
      return 'cloakvault.buzz';
    }
  }
  return (
    fallbackAuthDomain?.trim() ||
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ||
    `${projectId}.firebaseapp.com`
  );
}

function readEnvFirebaseConfig(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();

  if (apiKey && projectId && appId) {
    return {
      apiKey,
      authDomain: resolveAuthDomain(projectId),
      projectId,
      storageBucket:
        import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || `${projectId}.firebasestorage.app`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
      appId,
    };
  }

  // Optional localStorage override so judges/testers can connect their own Firebase project from the UI
  try {
    const saved = localStorage.getItem(LOCAL_CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as FirebaseOptions;
      if (parsed.apiKey && parsed.projectId && parsed.appId) {
        return {
          ...parsed,
          authDomain: resolveAuthDomain(parsed.projectId, parsed.authDomain),
        };
      }
    }
  } catch {
    // Ignore invalid storage
  }

  return null;
}

export function saveRuntimeFirebaseConfig(config: FirebaseOptions | null): void {
  if (!config) {
    localStorage.removeItem(LOCAL_CONFIG_STORAGE_KEY);
  } else {
    localStorage.setItem(LOCAL_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }
}

let cachedBundle: FirebaseBundle | null = null;

export function getFirebaseBundle(): FirebaseBundle {
  if (cachedBundle) return cachedBundle;

  const options = readEnvFirebaseConfig();
  if (!options) {
    cachedBundle = {
      configured: false,
      app: null,
      ai: null,
      appCheck: null,
      auth: null,
      db: null,
      remoteConfig: null,
      projectId: null,
      authDomain: null,
      initError: null,
    };
    return cachedBundle;
  }

  try {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(options);

    // Initialize App Check (required by Firebase AI Logic; real reCAPTCHA Enterprise in prod, debug token only in local dev)
    let appCheck: AppCheck | null = null;
    try {
      const debugSetting = import.meta.env.DEV
        ? import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN
        : undefined;
      if (debugSetting && debugSetting !== 'false') {
        (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
          debugSetting === 'true' ? true : debugSetting;
      }
      const siteKey =
        import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY?.trim() ||
        '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // Google public test key for local debug-token mode
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      // Non-fatal in restricted/sandboxed browser contexts
      appCheck = null;
    }

    // Initialize Firebase AI Logic with GoogleAIBackend (supports Hybrid on-device + cloud fallback)
    const ai = getAI(app, { backend: new GoogleAIBackend() });

    const auth = getAuth(app);
    const db = getFirestore(app);

    let remoteConfig: RemoteConfig | null = null;
    try {
      remoteConfig = getRemoteConfig(app);
      remoteConfig.settings.minimumFetchIntervalMillis = 60_000;
      remoteConfig.defaultConfig = {
        default_qa_inference_mode: DEFAULT_REMOTE_POLICY.defaultQaMode,
        deep_audit_inference_mode: DEFAULT_REMOTE_POLICY.deepAuditMode,
        cloud_model_name: DEFAULT_REMOTE_POLICY.cloudModelName,
        strict_pii_shield: DEFAULT_REMOTE_POLICY.strictPiiShield,
        max_local_context_chars: DEFAULT_REMOTE_POLICY.maxLocalContextChars,
      };
    } catch {
      remoteConfig = null;
    }

    cachedBundle = {
      configured: true,
      app,
      ai,
      appCheck,
      auth,
      db,
      remoteConfig,
      projectId: options.projectId ?? null,
      authDomain: options.authDomain ?? null,
      initError: null,
    };
    return cachedBundle;
  } catch (err) {
    cachedBundle = {
      configured: false,
      app: null,
      ai: null,
      appCheck: null,
      auth: null,
      db: null,
      remoteConfig: null,
      projectId: null,
      authDomain: null,
      initError: err instanceof Error ? err.message : String(err),
    };
    return cachedBundle;
  }
}

function parseMode(val: string, fallback: HybridInferenceMode): HybridInferenceMode {
  if (
    val === 'prefer_on_device' ||
    val === 'only_on_device' ||
    val === 'prefer_in_cloud' ||
    val === 'only_in_cloud'
  ) {
    return val;
  }
  return fallback;
}

export async function loadRemotePolicy(): Promise<RemotePolicyConfig> {
  const bundle = getFirebaseBundle();
  if (!bundle.remoteConfig) {
    return DEFAULT_REMOTE_POLICY;
  }

  try {
    await fetchAndActivate(bundle.remoteConfig);
    return {
      defaultQaMode: parseMode(
        getString(bundle.remoteConfig, 'default_qa_inference_mode'),
        DEFAULT_REMOTE_POLICY.defaultQaMode
      ),
      deepAuditMode: parseMode(
        getString(bundle.remoteConfig, 'deep_audit_inference_mode'),
        DEFAULT_REMOTE_POLICY.deepAuditMode
      ),
      cloudModelName:
        getString(bundle.remoteConfig, 'cloud_model_name') ||
        DEFAULT_REMOTE_POLICY.cloudModelName,
      strictPiiShield: getBoolean(bundle.remoteConfig, 'strict_pii_shield'),
      maxLocalContextChars:
        getNumber(bundle.remoteConfig, 'max_local_context_chars') ||
        DEFAULT_REMOTE_POLICY.maxLocalContextChars,
      source: 'REMOTE_CONFIG',
    };
  } catch {
    return DEFAULT_REMOTE_POLICY;
  }
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  const bundle = getFirebaseBundle();
  if (!bundle.auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(bundle.auth, callback);
}

export function getAuthProviderKind(
  user: User | null
): 'anonymous' | 'google' | 'password' | null {
  if (!user) return null;
  if (user.isAnonymous) return 'anonymous';
  const ids = user.providerData.map((p) => p.providerId);
  if (ids.includes('google.com')) return 'google';
  if (ids.includes('password')) return 'password';
  return 'password';
}

export function formatAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Double-check your credentials or reset your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a minute before trying again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in window is already open.';
    case 'auth/unauthorized-domain':
      return `This domain (${typeof window !== 'undefined' ? window.location.hostname : 'unknown'}) is not yet authorized in Firebase Authentication.`;
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase Authentication.';
    case 'auth/network-request-failed':
      return 'Network error — check your internet connection and try again.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  }
}

export async function signInGuest(): Promise<User | null> {
  const bundle = getFirebaseBundle();
  if (!bundle.auth) return null;
  const cred = await signInAnonymously(bundle.auth);
  return cred.user;
}

export async function signInWithGoogleAccount(): Promise<User | null> {
  const bundle = getFirebaseBundle();
  if (!bundle.auth) return null;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(bundle.auth, provider);
  return cred.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User | null> {
  const bundle = getFirebaseBundle();
  if (!bundle.auth) return null;
  const cred = await createUserWithEmailAndPassword(bundle.auth, email.trim(), password);
  const trimmedName = displayName?.trim();
  if (trimmedName) {
    await updateProfile(cred.user, { displayName: trimmedName });
    await cred.user.reload();
  }
  return bundle.auth.currentUser ?? cred.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User | null> {
  const bundle = getFirebaseBundle();
  if (!bundle.auth) return null;
  const cred = await signInWithEmailAndPassword(bundle.auth, email.trim(), password);
  return cred.user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const bundle = getFirebaseBundle();
  if (!bundle.auth) return;
  const continueUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/app` : 'https://cloakvault.buzz/app';
  await sendPasswordResetEmail(bundle.auth, email.trim(), { url: continueUrl });
}

export async function signOutAccount(): Promise<void> {
  const bundle = getFirebaseBundle();
  if (!bundle.auth) return;
  await signOut(bundle.auth);
}
