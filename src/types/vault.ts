import type { NanoCapabilitySnapshot } from '../lib/nanoPlatform';

export type DocumentCategory = 'legal' | 'financial' | 'medical' | 'general';

export type PiiType =
  | 'PERSON'
  | 'ORG'
  | 'EMAIL'
  | 'PHONE'
  | 'ACCOUNT'
  | 'GOV_ID'
  | 'ADDRESS'
  | 'SECRET'
  | 'CUSTOM';

export interface PiiEntity {
  id: string;
  token: string;
  type: PiiType;
  original: string;
  enabled: boolean;
  source: 'REGEX' | 'GEMINI_NANO' | 'MANUAL';
  occurrences: number;
}

export type HybridInferenceMode =
  | 'prefer_on_device'
  | 'only_on_device'
  | 'prefer_in_cloud'
  | 'only_in_cloud';

export type ActualInferenceSource = 'ON_DEVICE' | 'IN_CLOUD';

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  task: 'PII_DISCOVERY' | 'TRIAGE' | 'DEEP_AUDIT' | 'HYBRID_CHAT' | 'REDLINE';
  requestedMode: HybridInferenceMode;
  actualSource: ActualInferenceSource;
  modelLabel: string;
  latencyMs: number;
  ttftMs?: number;
  piiItemsShielded: number;
  piiBytesKeptLocal: number;
  cloudPayloadBytes: number;
  offline: boolean;
  redactedSha256: string;
}

export interface AuditFinding {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  clauseQuote: string;
  explanation: string;
  recommendedAction: string;
  suggestedRedline?: string;
}

export interface AuditReport {
  id: string;
  createdAt: number;
  riskScore: number;
  riskVerdict: 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK' | 'CRITICAL_RISK';
  executiveSummary: string;
  findings: AuditFinding[];
  missingProtections: string[];
  inferenceSource: ActualInferenceSource;
  modelLabel: string;
  latencyMs: number;
  sanitizedPayloadSent: string;
  piiBytesProtected: number;
  originalSha256: string;
  redactedSha256: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rawTokenizedContent?: string;
  timestamp: number;
  inferenceSource?: ActualInferenceSource;
  latencyMs?: number;
  ttftMs?: number;
  requestedMode?: HybridInferenceMode;
  streaming?: boolean;
}

export interface VaultDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  rawText: string;
  fileName?: string;
  createdAt: number;
  updatedAt: number;
  entities: PiiEntity[];
  auditReport?: AuditReport;
  localTriageSummary?: {
    summary: string;
    documentType: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    inferenceSource: ActualInferenceSource;
    latencyMs: number;
  };
  chatHistory: ChatMessage[];
}

export interface RemotePolicyConfig {
  defaultQaMode: HybridInferenceMode;
  deepAuditMode: HybridInferenceMode;
  cloudModelName: string;
  strictPiiShield: boolean;
  maxLocalContextChars: number;
  source: 'REMOTE_CONFIG' | 'DEFAULT';
}

export interface SystemCapabilities {
  online: boolean;
  firebaseConfigured: boolean;
  appCheckInitialized: boolean;
  remoteConfigLoaded: boolean;
  firestoreConnected: boolean;
  authUserUid: string | null;
  authIsAnonymous: boolean;
  authEmail: string | null;
  authDisplayName: string | null;
  authPhotoUrl: string | null;
  authProvider: 'anonymous' | 'google' | 'password' | null;
  chromeNanoStatus:
    | 'available'
    | 'downloadable'
    | 'downloading'
    | 'unavailable'
    | 'unsupported';
  chromeNanoDownloadProgress: number | null;
  nanoCapability: NanoCapabilitySnapshot;
}
