export type PlatformOS =
  | 'android'
  | 'ios'
  | 'windows'
  | 'macos'
  | 'linux'
  | 'chromeos'
  | 'unknown';

export type BrowserFamily =
  | 'chrome'
  | 'safari'
  | 'edge'
  | 'firefox'
  | 'opera'
  | 'brave'
  | 'samsung'
  | 'other';

export type NanoPromptApiStatus =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'unsupported';

export interface PlatformEnvironment {
  os: PlatformOS;
  isMobile: boolean;
  browser: BrowserFamily;
  isChromeDesktop: boolean;
  isChromeMobile: boolean;
  chromeMajor: number | null;
}

export interface NanoDevDiagnostics {
  cpuCores: number | null;
  deviceMemoryGb: number | null;
  rawAvailability: NanoPromptApiStatus;
  userAgent: string;
}

export interface NanoCapabilitySnapshot {
  platform: PlatformEnvironment;
  hasPromptApi: boolean;
  modelAvailability: NanoPromptApiStatus;
  /** True ONLY when desktop Chrome has the Prompt API AND Nano is ready to run locally. */
  canUseOnDevice: boolean;
  /** True ONLY when desktop Chrome has the Prompt API AND Nano is downloadable or downloading. */
  canDownloadOnDevice: boolean;
  /** True ONLY in dev builds or with explicit developer diagnostics opt-in. */
  shouldExposeDiagnostics: boolean;
  /** Populated ONLY when shouldExposeDiagnostics is true. */
  diagnostics?: NanoDevDiagnostics;
}

export interface ChromeLanguageModelSession {
  prompt(input: string): Promise<string>;
  promptStreaming?: (input: string) => AsyncIterable<string>;
  destroy?: () => void;
}

export interface ChromeLanguageModelDownloadMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (e: { loaded: number; total?: number }) => void
  ): void;
}

export interface ChromeLanguageModelGlobal {
  availability(options?: {
    expectedOutputs?: Array<{ type: 'text'; languages: string[] }>;
  }): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  create(options?: {
    systemPrompt?: string;
    expectedOutputs?: Array<{ type: 'text'; languages: string[] }>;
    monitor?: (m: ChromeLanguageModelDownloadMonitor) => void;
  }): Promise<ChromeLanguageModelSession>;
}

export const DEFAULT_NANO_EXPECTED_OUTPUTS: Array<{ type: 'text'; languages: string[] }> = [
  { type: 'text', languages: ['en'] },
];

export const DEV_DIAGNOSTICS_STORAGE_KEY = 'cloakvault_dev_diagnostics';

export interface DetectionInput {
  userAgent?: string;
  userAgentData?: {
    brands?: Array<{ brand: string; version: string }>;
    mobile?: boolean;
    platform?: string;
  };
  maxTouchPoints?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  languageModel?: ChromeLanguageModelGlobal | null;
  isDev?: boolean;
  search?: string;
  storageGet?: (key: string) => string | null;
}

function readRuntimeDetectionInput(): Required<
  Pick<DetectionInput, 'userAgent' | 'maxTouchPoints' | 'isDev' | 'search'>
> &
  Pick<
    DetectionInput,
    'userAgentData' | 'hardwareConcurrency' | 'deviceMemory' | 'languageModel' | 'storageGet'
  > {
  const nav =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & {
          userAgentData?: {
            brands?: Array<{ brand: string; version: string }>;
            mobile?: boolean;
            platform?: string;
          };
          deviceMemory?: number;
        })
      : undefined;

  const g = globalThis as unknown as { LanguageModel?: ChromeLanguageModelGlobal };
  const lm =
    g.LanguageModel &&
    typeof g.LanguageModel.availability === 'function' &&
    typeof g.LanguageModel.create === 'function'
      ? g.LanguageModel
      : null;

  return {
    userAgent: nav?.userAgent ?? '',
    userAgentData: nav?.userAgentData,
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    hardwareConcurrency: nav?.hardwareConcurrency,
    deviceMemory: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    languageModel: lm,
    isDev: Boolean(import.meta.env?.DEV),
    search: typeof window !== 'undefined' ? window.location.search : '',
    storageGet: (key: string) => {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Pure, reliable platform & browser detection.
 * Distinguishes Android, iOS/iPadOS, Windows, macOS, Linux, ChromeOS, and separates
 * Google Chrome desktop from Chrome mobile and other Chromium/non-Chrome browsers.
 */
export function detectPlatformEnvironment(input?: DetectionInput): PlatformEnvironment {
  const runtime = readRuntimeDetectionInput();
  const ua = input?.userAgent ?? runtime.userAgent;
  const uaData = input?.userAgentData !== undefined ? input.userAgentData : runtime.userAgentData;
  const maxTouchPoints = input?.maxTouchPoints ?? runtime.maxTouchPoints;
  const uaPlatform = (uaData?.platform ?? '').toLowerCase();

  // 1. OS detection
  let os: PlatformOS = 'unknown';
  const isIpadDesktopUa = /Macintosh/i.test(ua) && maxTouchPoints > 1;
  if (/Android/i.test(ua) || uaPlatform === 'android') {
    os = 'android';
  } else if (/iPhone|iPad|iPod/i.test(ua) || uaPlatform === 'ios' || isIpadDesktopUa) {
    os = 'ios';
  } else if (/CrOS/i.test(ua) || uaPlatform === 'chrome os' || uaPlatform === 'chromeos') {
    os = 'chromeos';
  } else if (/Windows/i.test(ua) || uaPlatform === 'windows') {
    os = 'windows';
  } else if (/Macintosh|Mac OS X/i.test(ua) || uaPlatform === 'macos') {
    os = 'macos';
  } else if (/Linux/i.test(ua) || uaPlatform === 'linux') {
    os = 'linux';
  }

  // 2. Mobile detection
  const isMobile =
    os === 'android' ||
    os === 'ios' ||
    Boolean(uaData?.mobile) ||
    /\bMobile\b/i.test(ua);

  // 3. Browser family detection (never confuse Edge/Brave/Opera/Samsung/Safari with Chrome)
  const brands = uaData?.brands ?? [];
  const hasBrand = (pattern: RegExp) => brands.some((b) => pattern.test(b.brand));

  let browser: BrowserFamily = 'other';
  if (/Edg\/|EdgA\/|EdgiOS\//i.test(ua) || hasBrand(/Microsoft Edge/i)) {
    browser = 'edge';
  } else if (/OPR\/|Opera/i.test(ua) || hasBrand(/Opera/i)) {
    browser = 'opera';
  } else if (/SamsungBrowser/i.test(ua) || hasBrand(/Samsung Internet/i)) {
    browser = 'samsung';
  } else if (/Brave/i.test(ua) || hasBrand(/Brave/i)) {
    browser = 'brave';
  } else if (/Firefox\/|FxiOS\//i.test(ua)) {
    browser = 'firefox';
  } else if (
    hasBrand(/^Google Chrome$/i) ||
    ((/Chrome\/|CriOS\//i.test(ua)) && !/Vivaldi|YaBrowser/i.test(ua))
  ) {
    browser = 'chrome';
  } else if (/Safari\//i.test(ua) && !/Chrome\/|Chromium\//i.test(ua)) {
    browser = 'safari';
  }

  // 4. Chrome major version (informational only — NEVER used to assume Nano support)
  const chromeBrand = brands.find((b) => /^Google Chrome$/i.test(b.brand));
  const uaChromeMatch = ua.match(/(?:Chrome|CriOS)\/(\d+)/);
  const parsedMajor = chromeBrand
    ? parseInt(chromeBrand.version, 10)
    : uaChromeMatch
    ? parseInt(uaChromeMatch[1], 10)
    : null;
  const chromeMajor =
    browser === 'chrome' && parsedMajor !== null && Number.isFinite(parsedMajor)
      ? parsedMajor
      : null;

  const isDesktopOs = os === 'windows' || os === 'macos' || os === 'linux' || os === 'chromeos';
  const isChromeDesktop = browser === 'chrome' && !isMobile && isDesktopOs;
  const isChromeMobile = browser === 'chrome' && isMobile;

  return {
    os,
    isMobile,
    browser,
    isChromeDesktop,
    isChromeMobile,
    chromeMajor,
  };
}

/**
 * Developer diagnostics are strictly disabled in production builds unless explicitly opted in
 * via `?debug=nano` or `localStorage.cloakvault_dev_diagnostics = "1"`.
 */
export function shouldExposeDeveloperDiagnostics(input?: DetectionInput): boolean {
  const runtime = readRuntimeDetectionInput();
  const isDev = input?.isDev ?? runtime.isDev;
  if (isDev) return true;

  const search = input?.search ?? runtime.search;
  try {
    const params = new URLSearchParams(search);
    if (params.get('debug') === 'nano') return true;
  } catch {
    // Ignore malformed query strings
  }

  const storageGet = input?.storageGet ?? runtime.storageGet;
  if (storageGet?.(DEV_DIAGNOSTICS_STORAGE_KEY) === '1') return true;

  return false;
}

export function getChromeLanguageModelGlobal(
  input?: Pick<DetectionInput, 'languageModel'>
): ChromeLanguageModelGlobal | null {
  if (input && 'languageModel' in input) {
    const lm = input.languageModel;
    return lm && typeof lm.availability === 'function' && typeof lm.create === 'function'
      ? lm
      : null;
  }
  return readRuntimeDetectionInput().languageModel ?? null;
}

/**
 * Full platform-aware Gemini Nano capability detection.
 * - Checks platform & browser independently from Prompt API presence.
 * - Checks LanguageModel presence independently from model availability / download readiness.
 * - On mobile (Android / iOS), never advertises Nano download or local execution.
 * - Never attaches hardware/raw diagnostics unless developer diagnostics are explicitly enabled.
 */
export async function detectNanoCapabilities(
  input?: DetectionInput
): Promise<NanoCapabilitySnapshot> {
  const runtime = readRuntimeDetectionInput();
  const platform = detectPlatformEnvironment(input);
  const exposeDiag = shouldExposeDeveloperDiagnostics(input);
  const lm = getChromeLanguageModelGlobal(input);
  const hasPromptApi = lm !== null;

  let modelAvailability: NanoPromptApiStatus = 'unsupported';
  if (hasPromptApi && lm) {
    try {
      const raw = await lm.availability({ expectedOutputs: DEFAULT_NANO_EXPECTED_OUTPUTS });
      if (
        raw === 'available' ||
        raw === 'downloadable' ||
        raw === 'downloading' ||
        raw === 'unavailable'
      ) {
        modelAvailability = raw;
      } else {
        modelAvailability = 'unavailable';
      }
    } catch {
      modelAvailability = 'unavailable';
    }
  }

  // Mobile browsers (Android & iOS) always use cloud fallback and never attempt Nano downloads.
  const desktopPromptCapable = platform.isChromeDesktop && hasPromptApi;
  const canUseOnDevice = desktopPromptCapable && modelAvailability === 'available';
  const canDownloadOnDevice =
    desktopPromptCapable &&
    (modelAvailability === 'downloadable' || modelAvailability === 'downloading');

  const snapshot: NanoCapabilitySnapshot = {
    platform,
    hasPromptApi,
    modelAvailability,
    canUseOnDevice,
    canDownloadOnDevice,
    shouldExposeDiagnostics: exposeDiag,
  };

  if (exposeDiag) {
    snapshot.diagnostics = {
      cpuCores: input?.hardwareConcurrency ?? runtime.hardwareConcurrency ?? null,
      deviceMemoryGb: input?.deviceMemory ?? runtime.deviceMemory ?? null,
      rawAvailability: modelAvailability,
      userAgent: input?.userAgent ?? runtime.userAgent,
    };
  }

  return snapshot;
}
