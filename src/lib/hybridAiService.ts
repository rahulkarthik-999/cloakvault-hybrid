import {
  getGenerativeModel,
  InferenceMode,
  InferenceSource,
  ThinkingLevel,
  type GenerateContentResult,
} from 'firebase/ai';
import { getFirebaseBundle } from './firebaseClient';
import { sha256Hex } from './cryptoProof';
import {
  DEFAULT_NANO_EXPECTED_OUTPUTS,
  detectNanoCapabilities,
  detectPlatformEnvironment,
  getChromeLanguageModelGlobal,
  shouldExposeDeveloperDiagnostics,
  type NanoCapabilitySnapshot,
} from './nanoPlatform';
import type {
  ActualInferenceSource,
  AuditFinding,
  AuditReport,
  ChatMessage,
  DocumentCategory,
  HybridInferenceMode,
  PiiType,
} from '../types/vault';

export class AIUnavailableError extends Error {
  readonly code: 'NO_ENGINE' | 'NANO_REQUIRED' | 'OFFLINE_NO_NANO' | 'PROVIDER_ERROR' | 'TIMEOUT' | 'CANCELLED';
  constructor(
    message: string,
    code: 'NO_ENGINE' | 'NANO_REQUIRED' | 'OFFLINE_NO_NANO' | 'PROVIDER_ERROR' | 'TIMEOUT' | 'CANCELLED'
  ) {
    super(message);
    this.name = 'AIUnavailableError';
    this.code = code;
  }
}

const DEFAULT_EXPECTED_OUTPUTS = DEFAULT_NANO_EXPECTED_OUTPUTS;

export async function checkChromeNanoAvailability(): Promise<
  'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported'
> {
  const snapshot = await detectNanoCapabilities();
  return snapshot.modelAvailability;
}

export async function getNanoCapabilitySnapshot(): Promise<NanoCapabilitySnapshot> {
  return detectNanoCapabilities();
}

const NANO_DOWNLOAD_STALL_MS = 35_000;
const CLOUD_REQUEST_TIMEOUT_MS = 35_000;

class RequestTimeoutError extends Error {
  constructor() {
    super('REQUEST_TIMED_OUT');
    this.name = 'RequestTimeoutError';
  }
}

class RequestCancelledError extends Error {
  constructor() {
    super('REQUEST_CANCELLED');
    this.name = 'RequestCancelledError';
  }
}

function raceWithTimeoutAndSignal<T>(
  promise: Promise<T>,
  timeoutMs: number,
  abortController: AbortController,
  externalSignal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (externalSignal?.aborted) {
      abortController.abort();
      reject(new RequestCancelledError());
      return;
    }

    const onExternalAbort = () => {
      cleanup();
      abortController.abort();
      reject(new RequestCancelledError());
    };

    const timer = setTimeout(() => {
      cleanup();
      abortController.abort();
      reject(new RequestTimeoutError());
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    };

    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

    promise.then(
      (val) => {
        cleanup();
        resolve(val);
      },
      (err) => {
        cleanup();
        reject(err);
      }
    );
  });
}

export async function downloadChromeNanoModel(
  onProgress: (pct: number) => void,
  stallTimeoutMs: number = NANO_DOWNLOAD_STALL_MS
): Promise<boolean> {
  // Never attempt to download or install Gemini Nano on mobile or unsupported browsers.
  const snapshot = await detectNanoCapabilities();
  if (!snapshot.platform.isChromeDesktop || !snapshot.canDownloadOnDevice) {
    return false;
  }

  const lm = getChromeLanguageModelGlobal();
  if (!lm) return false;

  return new Promise<boolean>((resolve, reject) => {
    let settled = false;
    let lastPct = -1;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;

    const resetStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('NANO_DOWNLOAD_STALLED'));
      }, stallTimeoutMs);
    };

    resetStallTimer();

    lm.create({
      expectedOutputs: DEFAULT_EXPECTED_OUTPUTS,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : Math.round(e.loaded * 100);
          const clamped = Math.min(100, Math.max(0, pct));
          if (clamped > lastPct) {
            lastPct = clamped;
            if (!settled) resetStallTimer();
          }
          if (!settled) onProgress(clamped);
        });
      },
    })
      .then((session) => {
        session.destroy?.();
        if (!settled) {
          settled = true;
          if (stallTimer) clearTimeout(stallTimer);
          resolve(true);
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          if (stallTimer) clearTimeout(stallTimer);
          reject(err);
        }
      });
  });
}

function toSdkInferenceMode(mode: HybridInferenceMode): InferenceMode {
  switch (mode) {
    case 'only_on_device':
      return InferenceMode.ONLY_ON_DEVICE;
    case 'prefer_in_cloud':
      return InferenceMode.PREFER_IN_CLOUD;
    case 'only_in_cloud':
      return InferenceMode.ONLY_IN_CLOUD;
    case 'prefer_on_device':
    default:
      return InferenceMode.PREFER_ON_DEVICE;
  }
}

function resolveInferenceSource(
  result: GenerateContentResult,
  requestedMode: HybridInferenceMode
): ActualInferenceSource {
  const src = result.response.inferenceSource;
  if (src === InferenceSource.ON_DEVICE) return 'ON_DEVICE';
  if (src === InferenceSource.IN_CLOUD) return 'IN_CLOUD';
  return requestedMode === 'only_on_device' ? 'ON_DEVICE' : 'IN_CLOUD';
}

function extractJsonBlock<T>(raw: string): T | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw.trim();
  const startObj = candidate.indexOf('{');
  const startArr = candidate.indexOf('[');
  const start =
    startObj === -1
      ? startArr
      : startArr === -1
      ? startObj
      : Math.min(startObj, startArr);
  if (start === -1) return null;

  const endObj = candidate.lastIndexOf('}');
  const endArr = candidate.lastIndexOf(']');
  const end = Math.max(endObj, endArr);
  if (end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const RETRY_DELAYS_MS = [1200, 2500, 5000];

/** Temporary capacity / rate-limit failures from the Gemini API that are worth retrying. */
export function isTransientProviderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\[(429|500|502|503|504)\b|high demand|overloaded|resource.?exhausted|try again later/i.test(
    msg
  );
}

interface HybridGenerationOutput {
  text: string;
  source: ActualInferenceSource;
  modelLabel: string;
  latencyMs: number;
  ttftMs: number;
}

function isInputTooLargeError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /input is too large|quota.?exceeded|context.?length|too many tokens/i.test(msg);
}

/**
 * Unified, zero-mock hybrid execution helper.
 * Uses Firebase AI Logic SDK (on-device Nano <-> Cloud Gemini) as primary runtime,
 * and Chrome's native LanguageModel API directly when local-only inference is requested
 * before Firebase credentials are added. Never returns hardcoded mock data.
 */
async function executeHybridInference(params: {
  prompt: string;
  localPrompt?: string;
  systemInstruction?: string;
  localSystemInstruction?: string;
  mode: HybridInferenceMode;
  cloudModelName: string;
  allowCloud: boolean;
  thinkingLevel?: 'MINIMAL' | 'LOW';
  responseMimeType?: 'application/json' | 'text/plain';
  timeoutMs?: number;
  signal?: AbortSignal;
  onTokenChunk?: (accumulatedText: string) => void;
  onRetry?: (attempt: number, maxAttempts: number) => void;
}): Promise<HybridGenerationOutput> {
  const started = performance.now();
  const bundle = getFirebaseBundle();
  const platform = detectPlatformEnvironment();
  const lm = getChromeLanguageModelGlobal();
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  const effectiveMode: HybridInferenceMode = !params.allowCloud
    ? 'only_on_device'
    : isOffline
    ? 'only_on_device'
    : platform.isMobile
    ? 'only_in_cloud'
    : params.mode;

  // Never touch cloud / Firebase AI Logic when offline or when strictly on-device without desktop Prompt API.
  const canInvokeFirebaseAi =
    Boolean(bundle.ai) &&
    !isOffline &&
    (effectiveMode !== 'only_on_device' || (platform.isChromeDesktop && lm !== null));

  let lastError: unknown = null;

  // 1. Primary path: Firebase AI Logic SDK (Hybrid Inference)
  // Gemini occasionally answers 429/500/503 ("high demand") for a few seconds; retry those with
  // backoff before surfacing an error. Streams are only retried if no tokens were shown yet.
  for (let attempt = 0; canInvokeFirebaseAi && bundle.ai && attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let streamedAnyToken = false;
    try {
      const isGemini4 = params.cloudModelName.startsWith('gemini-4');
      const supportsThinkingLevel = params.cloudModelName.startsWith('gemini-3') || isGemini4;
      const generationConfig: Record<string, unknown> = {};
      if (supportsThinkingLevel && params.thinkingLevel) {
        // Gemini 4 models support LOW/MEDIUM/HIGH/XHIGH (MINIMAL is rejected with HTTP 400).
        const resolvedLevel =
          isGemini4 && params.thinkingLevel === 'MINIMAL' ? 'LOW' : params.thinkingLevel;
        generationConfig.thinkingConfig = {
          thinkingLevel: ThinkingLevel[resolvedLevel],
        };
      }
      if (params.responseMimeType) {
        generationConfig.responseMimeType = params.responseMimeType;
      }
      const promptForSdk =
        effectiveMode === 'only_on_device' ? params.localPrompt ?? params.prompt : params.prompt;
      const localSystem = params.localSystemInstruction ?? params.systemInstruction;

      const model = getGenerativeModel(bundle.ai, {
        mode: toSdkInferenceMode(effectiveMode),
        inCloudParams: {
          model: params.cloudModelName,
          ...(params.systemInstruction ? { systemInstruction: params.systemInstruction } : {}),
          ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
        },
        onDeviceParams: {
          createOptions: {
            expectedOutputs: DEFAULT_EXPECTED_OUTPUTS,
            ...(localSystem
              ? {
                  initialPrompts: [
                    {
                      role: 'system',
                      content: [{ type: 'text', value: localSystem }],
                    },
                  ],
                }
              : {}),
          },
        },
      });

      const requestTimeoutMs = params.timeoutMs ?? CLOUD_REQUEST_TIMEOUT_MS;
      const attemptAbort = new AbortController();

      if (params.onTokenChunk) {
        const streamRes = await raceWithTimeoutAndSignal(
          model.generateContentStream(promptForSdk, {
            signal: attemptAbort.signal,
            timeout: requestTimeoutMs,
          }),
          requestTimeoutMs,
          attemptAbort,
          params.signal
        );
        let accumulated = '';
        let ttftMs = 0;

        for await (const chunk of streamRes.stream) {
          if (params.signal?.aborted) {
            attemptAbort.abort();
            throw new RequestCancelledError();
          }
          const piece = chunk.text();
          if (piece) {
            streamedAnyToken = true;
            if (!ttftMs) ttftMs = Math.round(performance.now() - started);
            accumulated += piece;
            params.onTokenChunk(accumulated);
          }
        }

        const finalResp = await raceWithTimeoutAndSignal(
          streamRes.response,
          requestTimeoutMs,
          attemptAbort,
          params.signal
        );
        const src =
          finalResp.inferenceSource === InferenceSource.ON_DEVICE
            ? 'ON_DEVICE'
            : finalResp.inferenceSource === InferenceSource.IN_CLOUD
            ? 'IN_CLOUD'
            : effectiveMode === 'only_on_device'
            ? 'ON_DEVICE'
            : 'IN_CLOUD';

        const totalMs = Math.round(performance.now() - started);
        return {
          text: accumulated || finalResp.text(),
          source: src,
          modelLabel: src === 'ON_DEVICE' ? 'Gemini Nano (Firebase AI Logic)' : params.cloudModelName,
          latencyMs: totalMs,
          ttftMs: ttftMs || totalMs,
        };
      }

      const result = await raceWithTimeoutAndSignal(
        model.generateContent(promptForSdk, {
          signal: attemptAbort.signal,
          timeout: requestTimeoutMs,
        }),
        requestTimeoutMs,
        attemptAbort,
        params.signal
      );
      const source = resolveInferenceSource(result, effectiveMode);
      const totalMs = Math.round(performance.now() - started);
      return {
        text: result.response.text(),
        source,
        modelLabel: source === 'ON_DEVICE' ? 'Gemini Nano (Firebase AI Logic)' : params.cloudModelName,
        latencyMs: totalMs,
        ttftMs: totalMs,
      };
    } catch (err) {
      if (err instanceof RequestCancelledError) {
        throw new AIUnavailableError('Request cancelled.', 'CANCELLED');
      }
      if (err instanceof RequestTimeoutError) {
        throw new AIUnavailableError(
          'Cloud AI timed out before responding. If you are using Incognito or blocking third-party cookies/scripts (reCAPTCHA), try a normal browser window or allow cookies for this site and retry.',
          'TIMEOUT'
        );
      }
      lastError = err;
      if (streamedAnyToken || effectiveMode === 'only_on_device' || !isTransientProviderError(err) || attempt === RETRY_DELAYS_MS.length) {
        break;
      }
      params.onRetry?.(attempt + 1, RETRY_DELAYS_MS.length);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }

  // 2. Direct Chrome Built-in Gemini Nano path (desktop Chrome only; allows genuine on-device AI even offline)
  if (effectiveMode !== 'only_in_cloud' && platform.isChromeDesktop && lm) {
    let status: string = 'unavailable';
    try {
      status = await lm.availability({ expectedOutputs: DEFAULT_EXPECTED_OUTPUTS });
    } catch {
      status = 'unavailable';
    }
    if (status === 'available') {
      const localSystem = params.localSystemInstruction ?? params.systemInstruction;
      const primaryLocalPrompt = params.localPrompt ?? params.prompt;
      const promptCandidates = [
        primaryLocalPrompt,
        primaryLocalPrompt.length > 1200 ? primaryLocalPrompt.slice(0, 1200) : null,
      ].filter((p): p is string => Boolean(p));

      for (let i = 0; i < promptCandidates.length; i++) {
        const candidatePrompt = promptCandidates[i];
        const session = await lm.create({
          expectedOutputs: DEFAULT_EXPECTED_OUTPUTS,
          ...(localSystem ? { systemPrompt: localSystem } : {}),
        });
        try {
          if (params.onTokenChunk && typeof session.promptStreaming === 'function') {
            let accumulated = '';
            let ttftMs = 0;
            for await (const chunk of session.promptStreaming(candidatePrompt)) {
              if (!ttftMs) ttftMs = Math.round(performance.now() - started);
              // Chrome Prompt API streaming yields either incremental chunks or cumulative text depending on build
              accumulated = chunk.startsWith(accumulated) ? chunk : accumulated + chunk;
              params.onTokenChunk(accumulated);
            }
            const totalMs = Math.round(performance.now() - started);
            return {
              text: accumulated,
              source: 'ON_DEVICE',
              modelLabel: 'Gemini Nano (Chrome Built-in)',
              latencyMs: totalMs,
              ttftMs: ttftMs || totalMs,
            };
          }

          const text = await session.prompt(candidatePrompt);
          const totalMs = Math.round(performance.now() - started);
          return {
            text,
            source: 'ON_DEVICE',
            modelLabel: 'Gemini Nano (Chrome Built-in)',
            latencyMs: totalMs,
            ttftMs: totalMs,
          };
        } catch (err) {
          lastError = err;
          if (!isInputTooLargeError(err) || i === promptCandidates.length - 1) {
            break;
          }
        } finally {
          session.destroy?.();
        }
      }
    }
  }

  // No silent fake fallback: return a clear, platform-appropriate message without raw capability dumps.
  if (!params.allowCloud) {
    throw new AIUnavailableError(
      'On-device AI is currently unavailable in this browser, so nothing was sent to the cloud. Allow sanitized cloud fallback to continue.',
      'NANO_REQUIRED'
    );
  }
  if (isOffline) {
    throw new AIUnavailableError(
      'You are offline and on-device AI is currently unavailable in this browser. Reconnect to use sanitized cloud AI.',
      'OFFLINE_NO_NANO'
    );
  }
  if (lastError) {
    const rawMsg = lastError instanceof Error ? lastError.message : String(lastError);
    const friendlyMsg = isTransientProviderError(lastError)
      ? 'Cloud AI is temporarily busy. Please try again in a few seconds.'
      : shouldExposeDeveloperDiagnostics()
      ? `Cloud AI request failed: ${rawMsg}`
      : 'Cloud AI could not complete this request right now. Please check your connection and try again.';
    throw new AIUnavailableError(friendlyMsg, 'PROVIDER_ERROR');
  }
  throw new AIUnavailableError(
    'Cloud AI is not connected yet. Open Firebase Setup to connect your project for sanitized cloud inference.',
    'NO_ENGINE'
  );
}

/**
 * STAGE 1 (STRICTLY ON-DEVICE): Contextual PII entity discovery using Chrome Gemini Nano.
 * Never transmits raw unredacted text to cloud (`allowCloud: false`, `ONLY_ON_DEVICE`).
 */
export async function discoverContextualPiiOnDevice(
  rawText: string,
  cloudModelName: string
): Promise<{
  entities: Array<{ text: string; type: PiiType }>;
  source: ActualInferenceSource;
  modelLabel: string;
  latencyMs: number;
}> {
  const prompt = `Identify personal names, organization names, street addresses, account numbers, and confidential IDs in the text below.
Return ONLY a valid JSON array of objects:
[{"text": "exact verbatim substring", "type": "PERSON" | "ORG" | "ADDRESS" | "ACCOUNT" | "GOV_ID" | "EMAIL" | "PHONE"}]
Do not include generic headings or invented values.

TEXT:
${rawText.slice(0, 4200)}`;

  const localPrompt = `Extract personal names, organizations, addresses, account numbers, and IDs from this text as a JSON array [{"text":"exact text","type":"PERSON"|"ORG"|"ADDRESS"|"ACCOUNT"|"GOV_ID"}]:\n${rawText.slice(0, 1600)}`;

  const res = await executeHybridInference({
    prompt,
    localPrompt,
    systemInstruction:
      'You are an on-device PII extraction engine. Output strictly valid JSON array and nothing else.',
    localSystemInstruction: 'Output only a valid JSON array of PII entities.',
    mode: 'only_on_device',
    cloudModelName,
    allowCloud: false,
  });

  const parsed = extractJsonBlock<Array<{ text?: string; type?: string }>>(res.text);
  const validTypes = new Set<PiiType>([
    'PERSON',
    'ORG',
    'EMAIL',
    'PHONE',
    'ACCOUNT',
    'GOV_ID',
    'ADDRESS',
    'SECRET',
    'CUSTOM',
  ]);

  const entities = (Array.isArray(parsed) ? parsed : [])
    .filter((i): i is { text: string; type: string } => Boolean(i?.text && i?.type))
    .map((i) => ({
      text: i.text.trim(),
      type: validTypes.has(i.type.toUpperCase() as PiiType)
        ? (i.type.toUpperCase() as PiiType)
        : ('CUSTOM' as PiiType),
    }))
    .slice(0, 25);

  return {
    entities,
    source: res.source,
    modelLabel: res.modelLabel,
    latencyMs: res.latencyMs,
  };
}

/**
 * STAGE 1B (PREFER ON-DEVICE): Fast triage summary via Firebase AI Logic.
 */
export async function runHybridTriage(params: {
  redactedText: string;
  category: DocumentCategory;
  cloudModelName: string;
  forceOffline?: boolean;
  signal?: AbortSignal;
}): Promise<{
  summary: string;
  documentType: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  source: ActualInferenceSource;
  modelLabel: string;
  latencyMs: number;
}> {
  const prompt = `Analyze this redacted document (placeholders like [ORG_1], [PERSON_1] are redacted entities).
Return ONLY valid JSON:
{
  "documentType": "concise classification (e.g. Commercial MSA & NDA)",
  "urgency": "LOW" | "MEDIUM" | "HIGH",
  "summary": "2 concise sentences explaining what this document is and the most urgent risks, preserving all [TOKEN_N] placeholders verbatim."
}

DOCUMENT:
${params.redactedText.slice(0, 5000)}`;

  const localPrompt = `Triage this redacted document. Preserve [TOKEN_N] placeholders. Return JSON {"documentType":"type","urgency":"LOW"|"MEDIUM"|"HIGH","summary":"2 short sentences on key risks"}:\n${params.redactedText.slice(0, 1600)}`;

  const res = await executeHybridInference({
    prompt,
    localPrompt,
    systemInstruction: 'You are a precise legal/financial triage assistant. Output strictly JSON.',
    localSystemInstruction: 'Output strictly JSON with documentType, urgency, and summary.',
    mode: params.forceOffline ? 'only_on_device' : 'prefer_on_device',
    cloudModelName: params.cloudModelName,
    allowCloud: !params.forceOffline,
    signal: params.signal,
  });

  const parsed = extractJsonBlock<{
    documentType?: string;
    urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
    summary?: string;
  }>(res.text);

  return {
    documentType: parsed?.documentType || `${params.category.toUpperCase()} Document`,
    urgency:
      parsed?.urgency === 'LOW' || parsed?.urgency === 'MEDIUM' || parsed?.urgency === 'HIGH'
        ? parsed.urgency
        : 'MEDIUM',
    summary: parsed?.summary || res.text.trim().slice(0, 320),
    source: res.source,
    modelLabel: res.modelLabel,
    latencyMs: res.latencyMs,
  };
}

/**
 * STAGE 2 (SANITIZED CLOUD ESCALATION WITH ON-DEVICE FALLBACK):
 * Sends ONLY verified zero-PII tokenized text to Gemini Cloud (falling back to Gemini Nano offline).
 */
export async function runHybridDeepAudit(params: {
  rawText: string;
  redactedText: string;
  category: DocumentCategory;
  mode: HybridInferenceMode;
  cloudModelName: string;
  piiBytesProtected: number;
  forceOffline?: boolean;
  signal?: AbortSignal;
}): Promise<AuditReport> {
  const effectiveMode: HybridInferenceMode = params.forceOffline ? 'only_on_device' : params.mode;

  const prompt = `You are a senior legal, financial, and billing risk auditor.
Audit the SANITIZED document below. Preserve every redaction placeholder EXACTLY as written (e.g. [ORG_1], [PERSON_1], [ACCOUNT_1]) so the browser can re-hydrate them locally.

Return ONLY valid JSON matching this exact structure:
{
  "riskScore": 0-100,
  "riskVerdict": "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | "CRITICAL_RISK",
  "executiveSummary": "2-3 sentence executive summary preserving [TOKEN_N] placeholders.",
  "findings": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "title": "concise specific issue title",
      "clauseQuote": "exact short verbatim excerpt copied from the document (20-140 chars)",
      "explanation": "specific legal or financial impact",
      "recommendedAction": "clear concrete negotiation or dispute step",
      "suggestedRedline": "ready-to-send replacement clause or dispute wording preserving [TOKEN_N]"
    }
  ],
  "missingProtections": ["missing safeguard 1", "missing safeguard 2"]
}

Provide 4 to 6 high-impact findings ordered by severity. Every clauseQuote MUST be an exact verbatim substring from the document so the UI can jump to it.

SANITIZED DOCUMENT (${params.category.toUpperCase()}):
${params.redactedText.slice(0, 12000)}`;

  const localPrompt = `Audit this sanitized ${params.category} document. Preserve [TOKEN_N] tokens. Return JSON {"riskScore":0-100,"riskVerdict":"LOW_RISK"|"MODERATE_RISK"|"HIGH_RISK"|"CRITICAL_RISK","executiveSummary":"2 sentences","findings":[{"severity":"CRITICAL"|"HIGH"|"MEDIUM","title":"issue","clauseQuote":"short quote","explanation":"impact","recommendedAction":"fix"}],"missingProtections":["item"]}:\n${params.redactedText.slice(0, 1600)}`;

  const [res, originalSha256, redactedSha256] = await Promise.all([
    executeHybridInference({
      prompt,
      localPrompt,
      systemInstruction:
        'You are an adversarial contract, ledger, and medical-billing auditor. Return strictly valid JSON with exact verbatim clauseQuote excerpts and preserved [TOKEN_N] placeholders.',
      localSystemInstruction:
        'You are a concise risk auditor. Return strictly valid JSON with riskScore, riskVerdict, executiveSummary, findings, and missingProtections.',
      mode: effectiveMode,
      cloudModelName: params.cloudModelName,
      allowCloud: !params.forceOffline,
      thinkingLevel: 'LOW',
      responseMimeType: 'application/json',
      signal: params.signal,
    }),
    sha256Hex(params.rawText),
    sha256Hex(params.redactedText),
  ]);

  const parsed = extractJsonBlock<{
    riskScore?: number;
    riskVerdict?: AuditReport['riskVerdict'];
    executiveSummary?: string;
    findings?: Array<Partial<AuditFinding>>;
    missingProtections?: string[];
  }>(res.text);

  if (!parsed || !Array.isArray(parsed.findings) || parsed.findings.length === 0) {
    // Graceful recovery when small on-device models return prose instead of strict JSON
    return {
      id: `audit-${Date.now()}`,
      createdAt: Date.now(),
      riskScore: 68,
      riskVerdict: 'HIGH_RISK',
      executiveSummary: res.text.trim().slice(0, 500),
      findings: [
        {
          id: 'finding-1',
          severity: 'HIGH',
          title: 'Model Returned Unstructured Analysis',
          clauseQuote: '',
          explanation: res.text.trim(),
          recommendedAction:
            'Escalate to Cloud Gemini (Firebase AI Logic) for structured clause-by-clause redlines.',
        },
      ],
      missingProtections: [],
      inferenceSource: res.source,
      modelLabel: res.modelLabel,
      latencyMs: res.latencyMs,
      sanitizedPayloadSent: params.redactedText,
      piiBytesProtected: params.piiBytesProtected,
      originalSha256,
      redactedSha256,
    };
  }

  const score = Math.min(100, Math.max(0, Math.round(Number(parsed.riskScore ?? 70))));
  return {
    id: `audit-${Date.now()}`,
    createdAt: Date.now(),
    riskScore: score,
    riskVerdict:
      parsed.riskVerdict ||
      (score >= 80
        ? 'CRITICAL_RISK'
        : score >= 60
        ? 'HIGH_RISK'
        : score >= 35
        ? 'MODERATE_RISK'
        : 'LOW_RISK'),
    executiveSummary: parsed.executiveSummary || 'Sanitized hybrid audit complete.',
    findings: parsed.findings.map((f, idx) => ({
      id: `finding-${idx + 1}`,
      severity:
        f.severity === 'CRITICAL' ||
        f.severity === 'HIGH' ||
        f.severity === 'MEDIUM' ||
        f.severity === 'LOW'
          ? f.severity
          : 'HIGH',
      title: f.title || `Finding #${idx + 1}`,
      clauseQuote: f.clauseQuote || '',
      explanation: f.explanation || '',
      recommendedAction: f.recommendedAction || '',
      suggestedRedline: f.suggestedRedline,
    })),
    missingProtections: Array.isArray(parsed.missingProtections) ? parsed.missingProtections : [],
    inferenceSource: res.source,
    modelLabel: res.modelLabel,
    latencyMs: res.latencyMs,
    sanitizedPayloadSent: params.redactedText,
    piiBytesProtected: params.piiBytesProtected,
    originalSha256,
    redactedSha256,
  };
}

/**
 * STAGE 3 (STREAMING HYBRID Q&A):
 * Streams token-by-token responses from either Gemini Nano (on-device) or Cloud Gemini
 * via Firebase AI Logic with real TTFT & inferenceSource provenance.
 */
export async function streamHybridChatTurn(params: {
  redactedText: string;
  history: ChatMessage[];
  question: string;
  mode: HybridInferenceMode;
  cloudModelName: string;
  forceOffline?: boolean;
  onChunk: (accumulatedText: string) => void;
}): Promise<{
  tokenizedAnswer: string;
  source: ActualInferenceSource;
  modelLabel: string;
  latencyMs: number;
  ttftMs: number;
}> {
  const effectiveMode: HybridInferenceMode = params.forceOffline ? 'only_on_device' : params.mode;

  const recentTurns = params.history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.rawTokenizedContent || m.content}`)
    .join('\n');

  const prompt = `Sanitized document (preserve all [TOKEN_N] placeholders verbatim in your answer):
${params.redactedText.slice(0, 7500)}

${recentTurns ? `Recent conversation:\n${recentTurns}\n` : ''}
Question: ${params.question}

Answer clearly and concisely, citing exact clauses or dollar figures from the document. Preserve [TOKEN_N] placeholders verbatim.`;

  const localPrompt = `Document (keep [TOKEN_N] tokens):\n${params.redactedText.slice(0, 1600)}\n\nQuestion: ${params.question}\nAnswer concisely:`;

  const res = await executeHybridInference({
    prompt,
    localPrompt,
    systemInstruction:
      'You are a legal and financial document analyst. Answer strictly from the provided sanitized document. Preserve all [TOKEN_N] placeholders verbatim.',
    localSystemInstruction:
      'Answer concisely from the sanitized document. Keep all [TOKEN_N] tokens intact.',
    mode: effectiveMode,
    cloudModelName: params.cloudModelName,
    allowCloud: !params.forceOffline,
    thinkingLevel: 'LOW',
    onTokenChunk: params.onChunk,
  });

  return {
    tokenizedAnswer: res.text.trim(),
    source: res.source,
    modelLabel: res.modelLabel,
    latencyMs: res.latencyMs,
    ttftMs: res.ttftMs,
  };
}
