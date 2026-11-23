import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  detectNanoCapabilities,
  detectPlatformEnvironment,
  DEV_DIAGNOSTICS_STORAGE_KEY,
  type ChromeLanguageModelGlobal,
  type NanoCapabilitySnapshot,
} from './nanoPlatform';
import { NanoStatusControl } from '../components/NanoStatusControl';
import { DeveloperNanoDiagnostics } from '../components/DeveloperNanoDiagnostics';
import type { SystemCapabilities } from '../types/vault';

function makeMockLanguageModel(
  status: 'available' | 'downloadable' | 'downloading' | 'unavailable'
): ChromeLanguageModelGlobal {
  return {
    availability: async () => status,
    create: async () => ({
      prompt: async () => 'ok',
      destroy: () => {},
    }),
  };
}

function makeSystemCaps(
  nanoCapability: NanoCapabilitySnapshot,
  downloadProgress: number | null = null
): SystemCapabilities {
  return {
    online: true,
    firebaseConfigured: true,
    appCheckInitialized: true,
    remoteConfigLoaded: true,
    firestoreConnected: true,
    authUserUid: null,
    authIsAnonymous: false,
    authEmail: null,
    authDisplayName: null,
    authPhotoUrl: null,
    authProvider: null,
    chromeNanoStatus: nanoCapability.modelAvailability,
    chromeNanoDownloadProgress: downloadProgress,
    nanoCapability,
  };
}

describe('platform-aware Gemini Nano capability detection & production UX', () => {
  it('1. Android Chrome: detects mobile Android, enforces cloud fallback, hides Nano download & diagnostics', async () => {
    const snap = await detectNanoCapabilities({
      userAgent:
        'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
      userAgentData: {
        brands: [{ brand: 'Google Chrome', version: '149' }],
        mobile: true,
        platform: 'Android',
      },
      // Even if an experimental Prompt API stub existed on mobile, mobile must not advertise Nano download/local mode
      languageModel: makeMockLanguageModel('downloadable'),
      isDev: false,
      search: '',
      storageGet: () => null,
    });

    expect(snap.platform.os).toBe('android');
    expect(snap.platform.isMobile).toBe(true);
    expect(snap.platform.isChromeMobile).toBe(true);
    expect(snap.platform.isChromeDesktop).toBe(false);
    expect(snap.canUseOnDevice).toBe(false);
    expect(snap.canDownloadOnDevice).toBe(false);
    expect(snap.shouldExposeDiagnostics).toBe(false);
    expect(snap.diagnostics).toBeUndefined();

    const html = renderToStaticMarkup(
      createElement(NanoStatusControl, {
        capabilities: makeSystemCaps(snap),
        onDownloadNano: () => {},
      })
    );
    expect(html).toContain('Cloud AI active');
    expect(html).not.toContain('Download Gemini Nano');
    expect(html).not.toContain('Get Gemini Nano');
    expect(html).not.toContain('Enable on-device AI');
    expect(html).not.toContain('chrome://');
  });

  it('2. iOS Safari & iPadOS desktop-UA Safari: detects iOS mobile, uses cloud fallback, never shows Nano modal', async () => {
    const iphoneSnap = await detectNanoCapabilities({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
      maxTouchPoints: 5,
      languageModel: null,
      isDev: false,
      search: '',
      storageGet: () => null,
    });

    expect(iphoneSnap.platform.os).toBe('ios');
    expect(iphoneSnap.platform.browser).toBe('safari');
    expect(iphoneSnap.platform.isMobile).toBe(true);
    expect(iphoneSnap.platform.isChromeDesktop).toBe(false);
    expect(iphoneSnap.canUseOnDevice).toBe(false);
    expect(iphoneSnap.canDownloadOnDevice).toBe(false);

    // Modern iPadOS sends Macintosh UA with touch points > 1
    const ipadPlatform = detectPlatformEnvironment({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
      maxTouchPoints: 5,
    });
    expect(ipadPlatform.os).toBe('ios');
    expect(ipadPlatform.isMobile).toBe(true);
    expect(ipadPlatform.isChromeDesktop).toBe(false);

    const html = renderToStaticMarkup(
      createElement(NanoStatusControl, {
        capabilities: makeSystemCaps(iphoneSnap),
        onDownloadNano: () => {},
      })
    );
    expect(html).toContain('Cloud AI active');
    expect(html).not.toContain('Get Nano');
    expect(html).not.toContain('Download');
  });

  it('3. Desktop Chrome (Windows/macOS/Linux) without Nano: does not assume version means support and falls back cleanly', async () => {
    const winNoApi = await detectNanoCapabilities({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      userAgentData: {
        brands: [{ brand: 'Google Chrome', version: '150' }],
        mobile: false,
        platform: 'Windows',
      },
      languageModel: null,
      isDev: false,
      search: '',
      storageGet: () => null,
    });

    expect(winNoApi.platform.os).toBe('windows');
    expect(winNoApi.platform.isChromeDesktop).toBe(true);
    expect(winNoApi.hasPromptApi).toBe(false);
    expect(winNoApi.modelAvailability).toBe('unsupported');
    expect(winNoApi.canUseOnDevice).toBe(false);
    expect(winNoApi.canDownloadOnDevice).toBe(false);

    const macUnavailable = await detectNanoCapabilities({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      maxTouchPoints: 0,
      languageModel: makeMockLanguageModel('unavailable'),
      isDev: false,
      search: '',
      storageGet: () => null,
    });

    expect(macUnavailable.platform.os).toBe('macos');
    expect(macUnavailable.hasPromptApi).toBe(true);
    expect(macUnavailable.modelAvailability).toBe('unavailable');
    expect(macUnavailable.canUseOnDevice).toBe(false);
    expect(macUnavailable.canDownloadOnDevice).toBe(false);

    const linuxPlatform = detectPlatformEnvironment({
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    });
    expect(linuxPlatform.os).toBe('linux');
    expect(linuxPlatform.isChromeDesktop).toBe(true);

    // Edge on Windows must NOT be treated as Google Chrome desktop
    const edgePlatform = detectPlatformEnvironment({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0',
    });
    expect(edgePlatform.browser).toBe('edge');
    expect(edgePlatform.isChromeDesktop).toBe(false);

    const html = renderToStaticMarkup(
      createElement(NanoStatusControl, {
        capabilities: makeSystemCaps(macUnavailable),
        onDownloadNano: () => {},
      })
    );
    expect(html).toContain('Cloud AI active');
    expect(html).not.toContain('chrome://');
    expect(html).not.toContain('VRAM');
    expect(html).not.toContain('CPU');
  });

  it('4. Desktop Chrome with Nano available: enables genuine on-device inference state', async () => {
    const snap = await detectNanoCapabilities({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      languageModel: makeMockLanguageModel('available'),
      isDev: false,
      search: '',
      storageGet: () => null,
    });

    expect(snap.platform.isChromeDesktop).toBe(true);
    expect(snap.hasPromptApi).toBe(true);
    expect(snap.modelAvailability).toBe('available');
    expect(snap.canUseOnDevice).toBe(true);
    expect(snap.canDownloadOnDevice).toBe(false);

    const html = renderToStaticMarkup(
      createElement(NanoStatusControl, {
        capabilities: makeSystemCaps(snap),
        onDownloadNano: () => {},
      })
    );
    expect(html).toContain('Gemini Nano · on-device');
  });

  it('5. Desktop Chrome with Nano downloadable & downloading: shows clean guided install & progress states', async () => {
    const downloadable = await detectNanoCapabilities({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      languageModel: makeMockLanguageModel('downloadable'),
      isDev: false,
      search: '',
      storageGet: () => null,
    });

    expect(downloadable.canUseOnDevice).toBe(false);
    expect(downloadable.canDownloadOnDevice).toBe(true);
    const downloadableHtml = renderToStaticMarkup(
      createElement(NanoStatusControl, {
        capabilities: makeSystemCaps(downloadable),
        onDownloadNano: () => {},
      })
    );
    expect(downloadableHtml).toContain('Enable on-device AI');
    expect(downloadableHtml).not.toContain('chrome://');

    const downloading = await detectNanoCapabilities({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      languageModel: makeMockLanguageModel('downloading'),
      isDev: false,
      search: '',
      storageGet: () => null,
    });
    expect(downloading.canDownloadOnDevice).toBe(true);
    const downloadingHtml = renderToStaticMarkup(
      createElement(NanoStatusControl, {
        capabilities: makeSystemCaps(downloading, 42),
        onDownloadNano: () => {},
      })
    );
    expect(downloadingHtml).toContain('Installing Nano 42%');
  });

  it('7. Production build hides developer diagnostics by default; dev or explicit opt-in exposes them', async () => {
    const prodSnap = await detectNanoCapabilities({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      hardwareConcurrency: 12,
      deviceMemory: 8,
      languageModel: null,
      isDev: false,
      search: '',
      storageGet: () => null,
    });
    expect(prodSnap.shouldExposeDiagnostics).toBe(false);
    expect(prodSnap.diagnostics).toBeUndefined();

    const prodDiagHtml = renderToStaticMarkup(
      createElement(DeveloperNanoDiagnostics, {
        snapshot: prodSnap,
        onRecheck: async () => {},
      })
    );
    expect(prodDiagHtml).toBe('');

    const optInSnap = await detectNanoCapabilities({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      hardwareConcurrency: 12,
      deviceMemory: 8,
      languageModel: null,
      isDev: false,
      search: '?debug=nano',
      storageGet: () => null,
    });
    expect(optInSnap.shouldExposeDiagnostics).toBe(true);
    expect(optInSnap.diagnostics?.cpuCores).toBe(12);
    expect(optInSnap.diagnostics?.deviceMemoryGb).toBe(8);

    const optInDiagHtml = renderToStaticMarkup(
      createElement(DeveloperNanoDiagnostics, {
        snapshot: optInSnap,
        onRecheck: async () => {},
      })
    );
    expect(optInDiagHtml).toContain('Developer Diagnostics');
    expect(optInDiagHtml).toContain('chrome://on-device-internals');

    const storageOptIn = await detectNanoCapabilities({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      isDev: false,
      search: '',
      storageGet: (k) => (k === DEV_DIAGNOSTICS_STORAGE_KEY ? '1' : null),
    });
    expect(storageOptIn.shouldExposeDiagnostics).toBe(true);
  });
});
