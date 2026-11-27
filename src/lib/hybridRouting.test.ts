import { afterEach, describe, expect, it, vi } from 'vitest';

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn((..._args: unknown[]) => ({
  generateContent: mockGenerateContent,
}));

vi.mock('firebase/ai', () => ({
  getGenerativeModel: (...args: unknown[]) => mockGetGenerativeModel(...args),
  InferenceMode: {
    PREFER_ON_DEVICE: 'prefer_on_device',
    ONLY_ON_DEVICE: 'only_on_device',
    PREFER_IN_CLOUD: 'prefer_in_cloud',
    ONLY_IN_CLOUD: 'only_in_cloud',
  },
  InferenceSource: {
    ON_DEVICE: 'on_device',
    IN_CLOUD: 'in_cloud',
  },
  ThinkingLevel: {
    MINIMAL: 'MINIMAL',
    LOW: 'LOW',
  },
}));

vi.mock('./firebaseClient', () => ({
  getFirebaseBundle: () => ({
    configured: true,
    app: {},
    ai: { __mockAi: true },
    appCheck: null,
    auth: null,
    db: null,
    remoteConfig: null,
    projectId: 'cloakvault-hybrid',
    authDomain: 'cloakvault.buzz',
    initError: null,
  }),
}));

import {
  AIUnavailableError,
  downloadChromeNanoModel,
  runHybridTriage,
} from './hybridAiService';

function stubNavigator(props: { userAgent: string; onLine: boolean; maxTouchPoints?: number }) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userAgent: props.userAgent,
      onLine: props.onLine,
      maxTouchPoints: props.maxTouchPoints ?? 0,
    },
  });
}

describe('hybrid inference routing & actual inferenceSource verification', () => {
  const originalNavigator = globalThis.navigator;
  const originalLanguageModel = (globalThis as Record<string, unknown>).LanguageModel;

  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
    if (originalLanguageModel === undefined) {
      delete (globalThis as Record<string, unknown>).LanguageModel;
    } else {
      (globalThis as Record<string, unknown>).LanguageModel = originalLanguageModel;
    }
  });

  it('Android Chrome routes to cloud fallback (IN_CLOUD) and refuses Nano downloads', async () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
      onLine: true,
    });
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: vi.fn(async () => 'downloadable'),
      create: vi.fn(),
    };
    mockGenerateContent.mockResolvedValue({
      response: {
        inferenceSource: 'in_cloud',
        text: () => '{"summary":"Sanitized cloud summary","documentType":"MSA","urgency":"HIGH"}',
      },
    });

    expect(await downloadChromeNanoModel(() => {})).toBe(false);

    const res = await runHybridTriage({
      redactedText: 'Agreement between [ORG_1] and [PERSON_1].',
      category: 'legal',
      cloudModelName: 'gemini-4-hydrogen',
      forceOffline: false,
    });

    expect(res.source).toBe('IN_CLOUD');
    expect(res.modelLabel).toBe('gemini-4-hydrogen');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mode: 'only_in_cloud' })
    );
  });

  it('iOS Safari routes to cloud fallback (IN_CLOUD) without claiming ON_DEVICE', async () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
      onLine: true,
      maxTouchPoints: 5,
    });
    delete (globalThis as Record<string, unknown>).LanguageModel;
    mockGenerateContent.mockResolvedValue({
      response: {
        inferenceSource: 'in_cloud',
        text: () => '{"summary":"iOS cloud triage","documentType":"Medical Bill","urgency":"MEDIUM"}',
      },
    });

    const res = await runHybridTriage({
      redactedText: 'Bill for [PERSON_1].',
      category: 'medical',
      cloudModelName: 'gemini-4-hydrogen',
      forceOffline: false,
    });

    expect(res.source).toBe('IN_CLOUD');
    expect(res.modelLabel).toBe('gemini-4-hydrogen');
  });

  it('Falls back to gemini-3.8-flash when gemini-4-hydrogen hangs or errors', async () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
      onLine: true,
      maxTouchPoints: 5,
    });
    delete (globalThis as Record<string, unknown>).LanguageModel;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGenerateContent
      .mockRejectedValueOnce(new Error('Timeout has expired.'))
      .mockResolvedValueOnce({
        response: {
          inferenceSource: 'in_cloud',
          text: () => '{"summary":"Fallback cloud triage","documentType":"MSA","urgency":"HIGH"}',
        },
      });

    const res = await runHybridTriage({
      redactedText: 'Agreement between [ORG_1] and [PERSON_1].',
      category: 'legal',
      cloudModelName: 'gemini-4-hydrogen',
      forceOffline: false,
    });

    expect(res.source).toBe('IN_CLOUD');
    expect(res.modelLabel).toBe('gemini-3.8-flash');
    expect(mockGetGenerativeModel).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ inCloudParams: expect.objectContaining({ model: 'gemini-4-hydrogen' }) })
    );
    expect(mockGetGenerativeModel).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ inCloudParams: expect.objectContaining({ model: 'gemini-3.8-flash' }) })
    );
  });

  it('Desktop Chrome with Nano available executes genuinely ON_DEVICE', async () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      onLine: true,
    });
    const promptSpy = vi.fn(
      async () => '{"summary":"Local Nano triage","documentType":"Contract","urgency":"LOW"}'
    );
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({ prompt: promptSpy, destroy: vi.fn() })),
    };
    mockGenerateContent.mockResolvedValue({
      response: {
        inferenceSource: 'on_device',
        text: () => '{"summary":"Firebase Nano triage","documentType":"Contract","urgency":"LOW"}',
      },
    });

    const res = await runHybridTriage({
      redactedText: 'Contract for [ORG_1].',
      category: 'legal',
      cloudModelName: 'gemini-4-hydrogen',
      forceOffline: false,
    });

    expect(res.source).toBe('ON_DEVICE');
    expect(res.modelLabel).toContain('Gemini Nano');
  });

  it('Offline mode makes ZERO cloud requests when Nano is unavailable and runs locally when Nano is available', async () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      onLine: false,
    });
    delete (globalThis as Record<string, unknown>).LanguageModel;

    await expect(
      runHybridTriage({
        redactedText: 'Offline doc for [ORG_1].',
        category: 'legal',
        cloudModelName: 'gemini-4-hydrogen',
        forceOffline: true,
      })
    ).rejects.toThrow(AIUnavailableError);
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();

    // Now simulate Nano available offline on desktop Chrome: still ZERO cloud calls, genuine ON_DEVICE execution
    const promptSpy = vi.fn(
      async () => '{"summary":"Offline Nano summary","documentType":"Ledger","urgency":"HIGH"}'
    );
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({ prompt: promptSpy, destroy: vi.fn() })),
    };

    const offlineRes = await runHybridTriage({
      redactedText: 'Offline ledger for [ORG_1].',
      category: 'financial',
      cloudModelName: 'gemini-4-hydrogen',
      forceOffline: true,
    });

    expect(offlineRes.source).toBe('ON_DEVICE');
    expect(offlineRes.modelLabel).toBe('Gemini Nano (Chrome Built-in)');
    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('Stalled Nano download times out cleanly instead of spinning forever, and Cancel aborts in-flight cloud calls', async () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      onLine: true,
    });
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: vi.fn(async () => 'downloading'),
      // Never-resolving create() simulates Incognito or low disk stall
      create: vi.fn(() => new Promise(() => {})),
    };

    await expect(downloadChromeNanoModel(() => {}, 30)).rejects.toThrow('NANO_DOWNLOAD_STALLED');

    // In-flight cloud request that stalls is aborted cleanly when cancelled
    mockGenerateContent.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = runHybridTriage({
      redactedText: 'Doc for [ORG_1].',
      category: 'general',
      cloudModelName: 'gemini-4-hydrogen',
      forceOffline: false,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('Automatically retries with a compact Nano prompt if Chrome reports "The input is too large."', async () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      onLine: false,
    });
    const promptSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error('The input is too large.'))
      .mockResolvedValueOnce(
        '{"summary":"Compact local Nano summary","documentType":"MSA","urgency":"HIGH"}'
      );
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({ prompt: promptSpy, destroy: vi.fn() })),
    };

    const res = await runHybridTriage({
      redactedText: 'A'.repeat(2500),
      category: 'legal',
      cloudModelName: 'gemini-4-hydrogen',
      forceOffline: true,
    });

    expect(res.source).toBe('ON_DEVICE');
    expect(res.summary).toBe('Compact local Nano summary');
    expect(promptSpy).toHaveBeenCalledTimes(2);
    expect(promptSpy.mock.calls[1][0].length).toBeLessThanOrEqual(1200);
  });
});
