import { useEffect, useState, type FormEvent } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UserRound,
  ArrowLeft,
} from 'lucide-react';
import {
  formatAuthError,
  sendPasswordReset,
  signInGuest,
  signInWithEmail,
  signInWithGoogleAccount,
  signOutAccount,
  signUpWithEmail,
} from '../lib/firebaseClient';
import { BrandMark } from './BrandMark';
import type { SystemCapabilities } from '../types/vault';

export function GoogleLogo({ className = 'h-4 w-4 shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

export type AuthModalMode = 'signin' | 'signup';

interface AuthModalProps {
  open: boolean;
  initialMode?: AuthModalMode;
  onClose: () => void;
  onAuthSuccess?: () => void;
  capabilities: SystemCapabilities;
  authDomain?: string | null;
}

export function AuthModal({
  open,
  initialMode = 'signin',
  onClose,
  onAuthSuccess,
  capabilities,
  authDomain,
}: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busyAction, setBusyAction] = useState<'google' | 'email' | 'guest' | 'signout' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setNotice(null);
      setPassword('');
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isSignedInAccount = Boolean(capabilities.authUserUid && !capabilities.authIsAnonymous);
  const initials = (
    capabilities.authDisplayName ||
    capabilities.authEmail ||
    'CV'
  )
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const handleGoogleAuth = async () => {
    setError(null);
    setNotice(null);
    setBusyAction('google');
    try {
      const user = await signInWithGoogleAccount();
      if (user) {
        onAuthSuccess?.();
        onClose();
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (mode === 'reset') {
      setBusyAction('email');
      try {
        await sendPasswordReset(trimmedEmail);
        setNotice(`Password reset link sent to ${trimmedEmail}. Check your inbox.`);
      } catch (err) {
        setError(formatAuthError(err));
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setBusyAction('email');
    try {
      if (mode === 'signup') {
        await signUpWithEmail(trimmedEmail, password, displayName);
      } else {
        await signInWithEmail(trimmedEmail, password);
      }
      onAuthSuccess?.();
      onClose();
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleGuestAuth = async () => {
    setError(null);
    setNotice(null);
    setBusyAction('guest');
    try {
      await signInGuest();
      onAuthSuccess?.();
      onClose();
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setNotice(null);
    setBusyAction('signout');
    try {
      await signOutAccount();
      onClose();
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E7EC] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#EEF0F4] bg-[#FAFBFC] px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandMark size={30} />
            <div>
              <h2 id="auth-modal-title" className="font-serif text-lg font-semibold text-[#0E1015]">
                {isSignedInAccount
                  ? 'Your CloakVault Account'
                  : mode === 'signup'
                  ? 'Create your account'
                  : mode === 'reset'
                  ? 'Reset your password'
                  : 'Sign in to CloakVault'}
              </h2>
              <p className="text-[11.5px] text-[#697083]">
                {isSignedInAccount
                  ? 'Zero-leak vault sync enabled across devices'
                  : 'Sync redacted vaults across devices — raw PII still stays local'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close authentication modal"
            className="rounded-md p-1 text-[#697083] transition hover:bg-[#ECEEF2] hover:text-[#0E1015]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {!capabilities.firebaseConfigured ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              Firebase Authentication is not configured in this build. Connect a Firebase project in
              Firebase Setup to enable Sign In and Sign Up.
            </div>
          ) : isSignedInAccount ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 rounded-xl border border-[#E5E7EC] bg-[#FAFBFC] p-4">
                {capabilities.authPhotoUrl ? (
                  <img
                    src={capabilities.authPhotoUrl}
                    alt={capabilities.authDisplayName || 'Account avatar'}
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 rounded-full border border-[#E5E7EC] object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0E1015] font-mono text-sm font-semibold text-white">
                    {initials || 'CV'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#0E1015]">
                    {capabilities.authDisplayName || capabilities.authEmail || 'CloakVault User'}
                  </div>
                  {capabilities.authEmail && (
                    <div className="truncate text-xs text-[#697083]">{capabilities.authEmail}</div>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-800">
                      {capabilities.authProvider === 'google' ? (
                        <>
                          <GoogleLogo className="h-3 w-3" />
                          Google
                        </>
                      ) : (
                        <>
                          <Mail className="h-3 w-3" />
                          Email &amp; Password
                        </>
                      )}
                    </span>
                    {authDomain && (
                      <span className="rounded-full border border-[#E5E7EC] bg-white px-2 py-0.5 font-mono text-[10px] text-[#697083]">
                        {authDomain}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span>
                  Your raw documents and PII keymap stay inside this browser&apos;s IndexedDB. Cloud
                  Firestore only receives zero-leak tokenized vaults scoped to your UID.
                </span>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-[10.5px] text-[#697083]">
                  UID: {capabilities.authUserUid?.slice(0, 12)}…
                </span>
                <button
                  onClick={handleSignOut}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EC] bg-white px-4 py-2 text-xs font-medium text-[#0E1015] transition hover:bg-[#F3F4F7] disabled:opacity-50"
                >
                  {busyAction === 'signout' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" />
                  )}
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Segmented Sign In / Sign Up Tabs */}
              {mode !== 'reset' ? (
                <div className="grid grid-cols-2 rounded-lg border border-[#E5E7EC] bg-[#F3F4F7] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                      setNotice(null);
                    }}
                    className={`rounded-md py-1.5 text-xs font-semibold transition ${
                      mode === 'signin'
                        ? 'bg-white text-[#0E1015] shadow-sm'
                        : 'text-[#697083] hover:text-[#0E1015]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                      setNotice(null);
                    }}
                    className={`rounded-md py-1.5 text-xs font-semibold transition ${
                      mode === 'signup'
                        ? 'bg-white text-[#0E1015] shadow-sm'
                        : 'text-[#697083] hover:text-[#0E1015]'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setNotice(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4A5061] hover:text-[#0E1015]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </button>
              )}

              {/* Google OAuth Button with Official 4-Color Google Logo */}
              {mode !== 'reset' && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={busyAction !== null}
                    className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#D5D9E2] bg-white px-4 py-2.5 text-[13px] font-medium text-[#0E1015] shadow-xs transition hover:border-[#B9C0CE] hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'google' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#4A5061]" />
                    ) : (
                      <GoogleLogo className="h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
                    </span>
                  </button>

                  <div className="relative flex items-center">
                    <div className="flex-1 border-t border-[#E5E7EC]" />
                    <span className="px-3 font-mono text-[10.5px] uppercase tracking-wider text-[#8C93A4]">
                      or continue with email
                    </span>
                    <div className="flex-1 border-t border-[#E5E7EC]" />
                  </div>
                </>
              )}

              {/* Email / Password Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {mode === 'signup' && (
                  <div>
                    <label
                      htmlFor="auth-display-name"
                      className="mb-1 block text-xs font-medium text-[#3A3F4D]"
                    >
                      Full name
                    </label>
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C93A4]" />
                      <input
                        id="auth-display-name"
                        name="displayName"
                        type="text"
                        autoComplete="name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Priya Sharma"
                        className="w-full rounded-lg border border-[#E5E7EC] bg-[#FAFBFC] py-2 pl-9 pr-3 text-sm text-[#0E1015] placeholder-[#9CA2B0] focus:border-[#0E1015] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="mb-1 block text-xs font-medium text-[#3A3F4D]"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C93A4]" />
                    <input
                      id="auth-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-lg border border-[#E5E7EC] bg-[#FAFBFC] py-2 pl-9 pr-3 text-sm text-[#0E1015] placeholder-[#9CA2B0] focus:border-[#0E1015] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {mode !== 'reset' && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label
                        htmlFor="auth-password"
                        className="block text-xs font-medium text-[#3A3F4D]"
                      >
                        Password
                      </label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode('reset');
                            setError(null);
                            setNotice(null);
                          }}
                          className="text-[11.5px] font-medium text-indigo-700 hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C93A4]" />
                      <input
                        id="auth-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'signup' ? 'Minimum 6 characters' : 'Enter password'}
                        className="w-full rounded-lg border border-[#E5E7EC] bg-[#FAFBFC] py-2 pl-9 pr-10 text-sm text-[#0E1015] placeholder-[#9CA2B0] focus:border-[#0E1015] focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#8C93A4] hover:text-[#0E1015]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {notice && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{notice}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busyAction !== null}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0E1015] px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-[#262A35] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === 'email' && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>
                    {mode === 'signup'
                      ? 'Create Account'
                      : mode === 'reset'
                      ? 'Send Password Reset Link'
                      : 'Sign In'}
                  </span>
                </button>
              </form>

              {/* Anonymous Guest Option (preserves zero-signup workbench flow) */}
              {mode !== 'reset' && (
                <div className="border-t border-[#EEF0F4] pt-3 text-center">
                  {capabilities.authIsAnonymous ? (
                    <div className="flex items-center justify-between text-[11.5px] text-[#697083]">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 text-emerald-700" />
                        Signed in as Anonymous Guest
                      </span>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={busyAction !== null}
                        className="font-medium text-[#3A3F4D] hover:text-[#0E1015] hover:underline"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGuestAuth}
                      disabled={busyAction !== null}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4A5061] transition hover:text-[#0E1015] disabled:opacity-50"
                    >
                      {busyAction === 'guest' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserRound className="h-3.5 w-3.5" />
                      )}
                      <span>Continue without an account (Anonymous Guest)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
