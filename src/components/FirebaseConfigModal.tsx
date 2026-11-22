import { useState } from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  LogIn,
  LogOut,
  Cloud,
  Shield,
  Sliders,
  Database,
  UserCheck,
} from 'lucide-react';
import {
  saveRuntimeFirebaseConfig,
  signInGuest,
  signInWithGoogleAccount,
  signOutAccount,
} from '../lib/firebaseClient';
import type { RemotePolicyConfig, SystemCapabilities } from '../types/vault';

interface FirebaseConfigModalProps {
  open: boolean;
  onClose: () => void;
  capabilities: SystemCapabilities;
  remotePolicy: RemotePolicyConfig;
  projectId: string | null;
}

export function FirebaseConfigModal({
  open,
  onClose,
  capabilities,
  remotePolicy,
  projectId,
}: FirebaseConfigModalProps) {
  const [configJson, setConfigJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  if (!open) return null;

  const handleSaveConfig = () => {
    setError(null);
    try {
      const parsed = JSON.parse(configJson);
      if (!parsed.apiKey || !parsed.projectId || !parsed.appId) {
        setError('JSON must include apiKey, projectId, and appId.');
        return;
      }
      saveRuntimeFirebaseConfig(parsed);
      window.location.reload();
    } catch {
      setError('Invalid JSON. Paste the Firebase Web App config object as valid JSON.');
    }
  };

  const handleClearConfig = () => {
    saveRuntimeFirebaseConfig(null);
    window.location.reload();
  };

  const handleGuestLogin = async () => {
    setAuthBusy(true);
    setError(null);
    try {
      await signInGuest();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Anonymous sign-in failed. Enable Anonymous provider in Firebase Auth.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthBusy(true);
    setError(null);
    try {
      await signInWithGoogleAccount();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const services = [
    {
      name: 'Firebase AI Logic (Hybrid Inference)',
      active: capabilities.firebaseConfigured,
      icon: Cloud,
      detail: capabilities.firebaseConfigured
        ? `Project: ${projectId} · Cloud model: ${remotePolicy.cloudModelName}`
        : 'Not connected — add .env.local or paste Web Config JSON below',
    },
    {
      name: 'Firebase App Check',
      active: capabilities.appCheckInitialized,
      icon: Shield,
      detail: capabilities.appCheckInitialized
        ? 'Active (ReCaptchaV3 / Debug Token mode)'
        : 'Pending Firebase config',
    },
    {
      name: 'Firebase Remote Config',
      active: capabilities.remoteConfigLoaded,
      icon: Sliders,
      detail: `QA=${remotePolicy.defaultQaMode} · Audit=${remotePolicy.deepAuditMode} (${remotePolicy.source})`,
    },
    {
      name: 'Cloud Firestore (Zero-PII Sync)',
      active: capabilities.firestoreConnected,
      icon: Database,
      detail: 'Persists only redacted tokenized payloads scoped to request.auth.uid',
    },
    {
      name: 'Firebase Authentication',
      active: Boolean(capabilities.authUserUid),
      icon: UserCheck,
      detail: capabilities.authUserUid
        ? `Signed in (${capabilities.authIsAnonymous ? 'Guest' : 'Google'} · ${capabilities.authUserUid.slice(0, 8)}…)`
        : 'Not signed in',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-[#E4E2DC] bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#171717]">
              Firebase Runtime &amp; Remote Config
            </h2>
            <p className="mt-0.5 text-xs text-[#78716C]">
              Live status of Firebase AI Logic, App Check, Remote Config, Firestore &amp; Auth
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[#78716C] hover:bg-[#F6F5F1] hover:text-[#171717]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="divide-y divide-[#ECEAE3] rounded-lg border border-[#E4E2DC]">
          {services.map((svc) => {
            const Icon = svc.icon;
            return (
              <div key={svc.name} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                <div className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 text-[#57534E]" />
                  <div>
                    <div className="text-xs font-semibold text-[#171717]">{svc.name}</div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-[#78716C]">
                      {svc.detail}
                    </div>
                  </div>
                </div>
                {svc.active ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-[#D4D1C7]" />
                )}
              </div>
            );
          })}
        </div>

        {capabilities.firebaseConfigured && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#E4E2DC] bg-[#FAF9F6] p-3">
            {!capabilities.authUserUid ? (
              <>
                <button
                  onClick={handleGuestLogin}
                  disabled={authBusy}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2E2E2B] disabled:opacity-50"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Anonymous Guest Sign-In
                </button>
                <button
                  onClick={handleGoogleLogin}
                  disabled={authBusy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E2DC] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F0EFEA] disabled:opacity-50"
                >
                  Sign in with Google
                </button>
              </>
            ) : (
              <button
                onClick={() => signOutAccount()}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E2DC] bg-white px-3 py-1.5 text-xs font-medium text-[#44403C] hover:bg-[#F0EFEA]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-[#E4E2DC] pt-4">
          <label
            htmlFor="firebase-runtime-json"
            className="block text-xs font-semibold text-[#171717]"
          >
            Connect Firebase Web App Config (JSON)
          </label>
          <p className="mt-0.5 text-[11.5px] text-[#78716C]">
            Paste your Firebase Web App config from Firebase Console → Project Settings to enable
            live Cloud Gemini fallback, Remote Config, App Check, and Firestore immediately.
          </p>
          <textarea
            id="firebase-runtime-json"
            name="firebaseRuntimeJson"
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            rows={5}
            placeholder={`{\n  "apiKey": "AIza...",\n  "authDomain": "your-app.firebaseapp.com",\n  "projectId": "your-project-id",\n  "appId": "1:12345:web:abcdef"\n}`}
            className="mt-2 w-full rounded-lg border border-[#E4E2DC] bg-[#FAF9F6] p-3 font-mono text-[11px] text-[#171717] placeholder-[#A8A29E] focus:border-[#171717] focus:bg-white focus:outline-none"
          />
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={handleClearConfig}
              className="text-xs text-[#78716C] hover:text-[#171717]"
            >
              Clear Saved Override
            </button>
            <button
              onClick={handleSaveConfig}
              className="rounded-md bg-[#171717] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2E2E2B]"
            >
              Save &amp; Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
