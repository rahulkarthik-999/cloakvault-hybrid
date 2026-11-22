import { useEffect, useState } from 'react';
import {
  Play,
  Cpu,
  Cloud,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Send,
  Loader2,
  AlertCircle,
  Download,
  ArrowUpRight,
  FileCode2,
  ShieldCheck as ShieldCheckIcon,
} from 'lucide-react';
import { segmentTokenizedOutput, rehydrateText } from '../lib/piiEngine';
import type {
  AuditFinding,
  DocumentCategory,
  HybridInferenceMode,
  PiiType,
  SystemCapabilities,
  TelemetryEvent,
  VaultDocument,
} from '../types/vault';

interface InspectorPaneProps {
  vault: VaultDocument;
  capabilities: SystemCapabilities;
  defaultQaMode: HybridInferenceMode;
  airGapMode: boolean;
  telemetry: TelemetryEvent[];
  busyAction: 'pii' | 'triage' | 'audit' | 'sync' | null;
  chatStreaming: boolean;
  aiError: string | null;
  onDismissError: () => void;
  shieldNotice: string | null;
  onDismissShield: () => void;
  onDisableAirGap: () => void;
  onRunNanoPiiScan: () => Promise<void>;
  onRunTriage: () => Promise<void>;
  onRunDeepAudit: () => Promise<void>;
  onSendChat: (question: string, mode: HybridInferenceMode) => Promise<void>;
  onToggleEntity: (entityId: string) => void;
  onAddCustomEntity: (text: string, type: PiiType) => void;
  onSelectClauseQuote: (quote: string) => void;
  onDownloadNano: () => void;
  onOpenFirebaseModal: () => void;
  onExportCertificate: () => void;
}

const SEVERITY_BADGE: Record<AuditFinding['severity'], string> = {
  CRITICAL: 'bg-red-50 text-red-800 border-red-200',
  HIGH: 'bg-amber-50 text-amber-800 border-amber-200',
  MEDIUM: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
};

const SUGGESTED_QUESTIONS: Record<DocumentCategory, string[]> = {
  legal: [
    'Which clause creates the worst financial exposure here?',
    'Draft a concise negotiation email pushing back on liability, IP, and auto-renewal.',
    'What payment withholding risks exist in Section 1?',
  ],
  financial: [
    'Total all recoverable duplicate charges and questionable fees.',
    'Draft a dispute memo for the finance controller covering the unrecognized wire.',
    'Which recurring vendor charges should be cancelled immediately?',
  ],
  medical: [
    'Itemize every billing error and estimate the total amount to dispute.',
    'Draft a billing dispute letter invoking the No Surprises Act.',
    'Why does CPT 99285 conflict with the chart notes?',
  ],
  general: [
    'What are the top 3 concrete risks or obligations in this document?',
    'Identify any hidden fees, lock-ins, or ambiguous deadlines.',
  ],
};

function renderPlainWithBold(raw: string) {
  const parts = raw.split(/(\*\*[^*\n]+\*\*)/g);
  return parts.map((part, idx) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={idx} className="font-semibold text-[#0E1015]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={idx}>{part.replace(/\*\*/g, '')}</span>
    )
  );
}

function RehydratableSpan({
  text,
  vault,
  rehydrate,
}: {
  text: string;
  vault: VaultDocument;
  rehydrate: boolean;
}) {
  const segs = segmentTokenizedOutput(text, vault.entities, rehydrate);
  return (
    <>
      {segs.map((seg, i) =>
        seg.entity ? (
          <span
            key={i}
            title={
              rehydrate
                ? `Re-hydrated locally from ${seg.entity.token}`
                : `Cloud only saw ${seg.entity.token}`
            }
            className={`mx-0.5 inline-block rounded px-1 py-0.2 font-mono text-[11px] font-medium ${
              rehydrate
                ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
                : 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
            }`}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{renderPlainWithBold(seg.text)}</span>
        )
      )}
    </>
  );
}

export function InspectorPane({
  vault,
  capabilities,
  defaultQaMode,
  airGapMode,
  telemetry,
  busyAction,
  chatStreaming,
  aiError,
  onDismissError,
  shieldNotice,
  onDismissShield,
  onDisableAirGap,
  onRunNanoPiiScan,
  onRunTriage,
  onRunDeepAudit,
  onSendChat,
  onToggleEntity,
  onAddCustomEntity,
  onSelectClauseQuote,
  onDownloadNano,
  onOpenFirebaseModal,
  onExportCertificate,
}: InspectorPaneProps) {
  const [tab, setTab] = useState<'audit' | 'entities' | 'ask' | 'telemetry'>('audit');
  const [rehydrate, setRehydrate] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customTerm, setCustomTerm] = useState('');
  const [customType, setCustomType] = useState<PiiType>('CUSTOM');
  const [chatInput, setChatInput] = useState('');
  const [chatMode, setChatMode] = useState<HybridInferenceMode>(defaultQaMode);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!busyAction) {
      setElapsedSec(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [busyAction]);

  const hasAnyLiveEngine =
    capabilities.firebaseConfigured || capabilities.chromeNanoStatus === 'available';

  const activeEntities = vault.entities.filter((e) => e.enabled).length;

  const handleCopyRedline = (f: AuditFinding) => {
    if (!f.suggestedRedline) return;
    const out = rehydrate ? rehydrateText(f.suggestedRedline, vault.entities) : f.suggestedRedline;
    navigator.clipboard.writeText(out);
    setCopiedId(f.id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const handleAddEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTerm.trim()) return;
    onAddCustomEntity(customTerm.trim(), customType);
    setCustomTerm('');
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatStreaming) return;
    const q = chatInput.trim();
    setChatInput('');
    await onSendChat(q, airGapMode ? 'only_on_device' : chatMode);
  };

  return (
    <aside data-pane="inspector" className="flex w-full shrink-0 flex-col border-t border-[#E5E7EC] bg-white lg:w-[440px] lg:border-l lg:border-t-0">
      {/* Inspector Tab Bar */}
      <div className="flex shrink-0 border-b border-[#E5E7EC] bg-[#FAFBFC] px-2 pt-1.5">
        {(
          [
            ['audit', 'Risk Audit', vault.auditReport ? String(vault.auditReport.riskScore) : null],
            ['entities', 'Entities', String(activeEntities)],
            ['ask', 'Ask', vault.chatHistory.length ? String(vault.chatHistory.length) : null],
            ['telemetry', 'Telemetry', telemetry.length ? String(telemetry.length) : null],
          ] as const
        ).map(([id, label, badge]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition ${
              tab === id
                ? 'border-b-2 border-[#0E1015] text-[#0E1015]'
                : 'text-[#697083] hover:text-[#0E1015]'
            }`}
          >
            <span>{label}</span>
            {badge && (
              <span className="rounded bg-[#E8EAEF] px-1.5 py-0.5 font-mono text-[10px] text-[#3A3F4D]">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Inline Actionable Error Banner (Zero silent fake fallbacks) */}
      {shieldNotice && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-950">
          <div className="flex items-start gap-2.5">
            <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div className="flex-1">
              <p className="text-[12.5px] font-semibold">Held on-device — 0 bytes sent</p>
              <p className="mt-0.5 leading-snug text-emerald-900/80">
                {airGapMode ? 'Air-gap mode' : 'This task'} locks inference to this device. Gemini
                Nano isn’t installed in this browser, so CloakVault stopped instead of falling back
                to the cloud.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {capabilities.chromeNanoStatus === 'downloadable' && (
                  <button
                    onClick={onDownloadNano}
                    className="rounded-full bg-emerald-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-800"
                  >
                    Download Gemini Nano
                  </button>
                )}
                {airGapMode && (
                  <button
                    onClick={onDisableAirGap}
                    className="rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100/60"
                  >
                    Allow sanitized cloud fallback
                  </button>
                )}
                <button
                  onClick={onDismissShield}
                  className="px-1 py-1 text-[11px] text-emerald-800/70 underline underline-offset-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {aiError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
            <div className="flex-1">
              <p className="leading-snug">{aiError}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {capabilities.chromeNanoStatus === 'downloadable' && (
                  <button
                    onClick={onDownloadNano}
                    className="rounded bg-[#0E1015] px-2 py-1 text-[11px] font-medium text-white"
                  >
                    Download Gemini Nano
                  </button>
                )}
                {!capabilities.firebaseConfigured && (
                  <button
                    onClick={onOpenFirebaseModal}
                    className="rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-medium text-red-900"
                  >
                    Connect Firebase AI Logic
                  </button>
                )}
                <button
                  onClick={onDismissError}
                  className="text-[11px] font-medium text-red-700 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: RISK AUDIT & REDLINES */}
      {tab === 'audit' && (
        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          {/* Primary Action Bar */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={onRunDeepAudit}
              disabled={busyAction !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#0E1015] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#262A35] disabled:opacity-50"
            >
              {busyAction === 'audit' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>
                {busyAction === 'audit'
                  ? `Auditing via Hybrid AI… ${elapsedSec > 0 ? `${elapsedSec}s` : ''}`
                  : 'Run Hybrid Audit'}
              </span>
            </button>
            <button
              onClick={onRunTriage}
              disabled={busyAction !== null}
              className="rounded-md border border-[#E5E7EC] bg-white px-3 py-2 text-xs font-medium text-[#0E1015] transition hover:bg-[#F3F4F7] disabled:opacity-50"
              title="Run fast on-device triage summary via Gemini Nano"
            >
              {busyAction === 'triage' ? 'Triaging…' : 'Quick Triage'}
            </button>
          </div>

          {/* Honest Runtime Setup Callout when no live AI runtime is ready yet */}
          {!hasAnyLiveEngine && !vault.auditReport && (
            <div className="mb-4 rounded-lg border border-[#E5E7EC] bg-[#FAFBFC] p-4">
              <h3 className="text-xs font-semibold text-[#0E1015]">
                Activate Real Hybrid Inference (No Mock Data)
              </h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#4A5061]">
                CloakVault runs real neural inference—never canned responses. Enable one or both
                engines to audit documents:
              </p>
              <div className="mt-3 space-y-2">
                {capabilities.chromeNanoStatus === 'downloadable' && (
                  <button
                    onClick={onDownloadNano}
                    className="flex w-full items-center justify-between rounded-md border border-[#0E1015] bg-[#0E1015] px-3 py-2 text-xs font-medium text-white hover:bg-[#262A35]"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      1. Download Chrome Gemini Nano (Local)
                    </span>
                    <span className="font-mono text-[10px] opacity-80">Free · Offline</span>
                  </button>
                )}
                <button
                  onClick={onOpenFirebaseModal}
                  className="flex w-full items-center justify-between rounded-md border border-[#E5E7EC] bg-white px-3 py-2 text-xs font-medium text-[#0E1015] hover:bg-[#ECEEF2]"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Cloud className="h-3.5 w-3.5 text-indigo-700" />
                    2. Connect Firebase AI Logic (Cloud Gemini)
                  </span>
                  <span className="font-mono text-[10px] text-[#697083]">Spark Free Tier</span>
                </button>
              </div>
            </div>
          )}

          {!vault.auditReport ? (
            <div className="rounded-xl border border-[#E5E7EC] bg-[#FAFBFC] p-5">
              <p className="font-display text-[22px] leading-tight text-[#0E1015]">
                Your document never left this device.
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[#697083]">
                Personal data is already swapped for local tokens. Here’s the 30-second tour:
              </p>
              <ol className="mt-4 space-y-3">
                {[
                  {
                    n: 1,
                    lane: 'device',
                    t: 'Check the shield',
                    d: 'Black chips in the document are redacted on-device. Highlight any text to redact more.',
                  },
                  {
                    n: 2,
                    lane: 'cloud',
                    t: 'Run Hybrid Audit',
                    d: 'Only tokens go to Gemini via Firebase AI Logic. Findings are re-hydrated here.',
                  },
                  {
                    n: 3,
                    lane: 'device',
                    t: 'Verify the wire',
                    d: 'Open “Outbound Cloud Payload” to see the exact bytes sent and their SHA-256 hashes.',
                  },
                ].map((s) => (
                  <li key={s.n} className="flex gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold ${
                        s.lane === 'device'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {s.n}
                    </span>
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#0E1015]">{s.t}</div>
                      <div className="text-[11.5px] leading-relaxed text-[#697083]">{s.d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Scorecard Summary */}
              <div className="rounded-lg border border-[#E5E7EC] bg-[#FAFBFC] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-mono text-2xl font-bold ${
                        vault.auditReport.riskScore >= 75
                          ? 'text-red-700'
                          : vault.auditReport.riskScore >= 45
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {vault.auditReport.riskScore}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#697083]">
                      / 100 · {vault.auditReport.riskVerdict.replace('_', ' ')}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                      vault.auditReport.inferenceSource === 'ON_DEVICE'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-indigo-200 bg-indigo-50 text-indigo-800'
                    }`}
                  >
                    {vault.auditReport.inferenceSource === 'IN_CLOUD' ? (
                      <Cloud className="h-2.5 w-2.5" />
                    ) : (
                      <Cpu className="h-2.5 w-2.5" />
                    )}
                    {vault.auditReport.inferenceSource} · {vault.auditReport.latencyMs}ms
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-[#1E2129]">
                  <RehydratableSpan
                    text={vault.auditReport.executiveSummary}
                    vault={vault}
                    rehydrate={rehydrate}
                  />
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-[#E5E7EC] pt-2.5">
                  <span className="font-mono text-[10px] text-emerald-800">
                    {vault.auditReport.piiBytesProtected} B PII kept local
                  </span>
                  <div className="flex rounded border border-[#E5E7EC] bg-white p-0.5 text-[10.5px]">
                    <button
                      onClick={() => setRehydrate(true)}
                      className={`rounded px-2 py-0.5 font-medium ${
                        rehydrate ? 'bg-[#0E1015] text-white' : 'text-[#4A5061]'
                      }`}
                    >
                      Re-Hydrated
                    </button>
                    <button
                      onClick={() => setRehydrate(false)}
                      className={`rounded px-2 py-0.5 font-medium ${
                        !rehydrate ? 'bg-[#0E1015] text-white' : 'text-[#4A5061]'
                      }`}
                    >
                      Cloud Tokens
                    </button>
                  </div>
                </div>
              </div>

              {/* Findings & Inline Redline Diffs */}
              <div className="space-y-3">
                {vault.auditReport.findings.map((finding) => (
                  <article
                    key={finding.id}
                    className="rounded-lg border border-[#E5E7EC] bg-white p-3.5 transition hover:border-[#C3C8D2]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${
                            SEVERITY_BADGE[finding.severity]
                          }`}
                        >
                          {finding.severity}
                        </span>
                        <h4 className="text-[12.5px] font-semibold text-[#0E1015]">
                          <RehydratableSpan
                            text={finding.title}
                            vault={vault}
                            rehydrate={rehydrate}
                          />
                        </h4>
                      </div>
                      {finding.clauseQuote && (
                        <button
                          onClick={() =>
                            onSelectClauseQuote(
                              rehydrateText(finding.clauseQuote, vault.entities)
                            )
                          }
                          className="inline-flex shrink-0 items-center gap-0.5 rounded border border-[#E5E7EC] px-1.5 py-0.5 text-[10px] font-medium text-[#4A5061] hover:bg-[#F3F4F7] hover:text-[#0E1015]"
                          title="Scroll to & highlight this clause in the document"
                        >
                          Locate
                          <ArrowUpRight className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>

                    <p className="mt-2 text-[12px] leading-relaxed text-[#3A3F4D]">
                      <RehydratableSpan
                        text={finding.explanation}
                        vault={vault}
                        rehydrate={rehydrate}
                      />
                    </p>

                    {/* Side-by-Side / Stacked Redline Diff */}
                    {(finding.clauseQuote || finding.suggestedRedline) && (
                      <div className="mt-2.5 space-y-1.5 rounded-md border border-[#E8EAEF] bg-[#FAFBFC] p-2.5 font-mono text-[11px]">
                        {finding.clauseQuote && (
                          <div className="rounded bg-red-50/80 px-2 py-1 text-red-900 line-through decoration-red-400">
                            <RehydratableSpan
                              text={finding.clauseQuote}
                              vault={vault}
                              rehydrate={rehydrate}
                            />
                          </div>
                        )}
                        {finding.suggestedRedline && (
                          <div className="rounded bg-emerald-50/90 px-2 py-1.5 text-emerald-950">
                            <div className="mb-1 flex items-center justify-between text-[9.5px] font-semibold uppercase tracking-wider text-emerald-800">
                              <span>Proposed Redline</span>
                              <button
                                onClick={() => handleCopyRedline(finding)}
                                className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-emerald-900 hover:bg-emerald-50"
                              >
                                {copiedId === finding.id ? (
                                  <>
                                    <Check className="h-2.5 w-2.5" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-2.5 w-2.5" />
                                    Copy
                                  </>
                                )}
                              </button>
                            </div>
                            <RehydratableSpan
                              text={finding.suggestedRedline}
                              vault={vault}
                              rehydrate={rehydrate}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-2 text-[11.5px] text-[#1E2129]">
                      <span className="font-semibold">Action: </span>
                      <RehydratableSpan
                        text={finding.recommendedAction}
                        vault={vault}
                        rehydrate={rehydrate}
                      />
                    </div>
                  </article>
                ))}
              </div>

              {vault.auditReport.missingProtections.length > 0 && (
                <div className="rounded-lg border border-[#E5E7EC] bg-[#FAFBFC] p-3">
                  <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#4A5061]">
                    Missing Protections
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-[#1E2129]">
                    {vault.auditReport.missingProtections.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOCAL PII ENTITIES */}
      {tab === 'entities' && (
        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          <button
            onClick={onRunNanoPiiScan}
            disabled={busyAction !== null}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-[#0E1015] bg-[#0E1015] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#262A35] disabled:opacity-50"
          >
            {busyAction === 'pii' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Cpu className="h-3.5 w-3.5" />
            )}
            <span>
              {busyAction === 'pii'
                ? 'Scanning on-device with Gemini Nano…'
                : 'Discover Contextual PII (On-Device Nano)'}
            </span>
          </button>

          <form onSubmit={handleAddEntity} className="mb-3 flex gap-1.5">
            <input
              id="custom-pii-term"
              name="customPiiTerm"
              type="text"
              value={customTerm}
              onChange={(e) => setCustomTerm(e.target.value)}
              placeholder="Add custom phrase to redact…"
              className="min-w-0 flex-1 rounded-md border border-[#E5E7EC] bg-[#FAFBFC] px-2.5 py-1.5 text-xs text-[#0E1015] placeholder-[#9CA2B0] focus:border-[#0E1015] focus:bg-white focus:outline-none"
            />
            <select
              id="custom-pii-type"
              name="customPiiType"
              value={customType}
              onChange={(e) => setCustomType(e.target.value as PiiType)}
              className="rounded-md border border-[#E5E7EC] bg-white px-2 py-1.5 text-[11px] text-[#3A3F4D]"
            >
              <option value="CUSTOM">CUSTOM</option>
              <option value="PERSON">PERSON</option>
              <option value="ORG">ORG</option>
              <option value="SECRET">SECRET</option>
            </select>
            <button
              type="submit"
              className="rounded-md border border-[#E5E7EC] bg-white px-2.5 text-[#0E1015] hover:bg-[#ECEEF2]"
              title="Add custom redaction rule"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </form>

          <div className="divide-y divide-[#E8EAEF] rounded-lg border border-[#E5E7EC]">
            {vault.entities.length === 0 ? (
              <p className="p-4 text-center text-xs text-[#697083]">
                No PII tokens yet. Select any text in the document or run Nano PII Discovery.
              </p>
            ) : (
              vault.entities.map((entity) => (
                <div
                  key={entity.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 ${
                    entity.enabled ? 'bg-white' : 'bg-[#FAFBFC] opacity-55'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-[#0E1015] px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
                        {entity.token}
                      </span>
                      <span className="font-mono text-[9.5px] uppercase text-[#697083]">
                        {entity.source} · ×{entity.occurrences}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11.5px] text-[#1E2129]">
                      {entity.original}
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleEntity(entity.id)}
                    className="rounded p-1.5 text-[#4A5061] hover:bg-[#ECEEF2] hover:text-[#0E1015]"
                    title={entity.enabled ? 'Unredact this term' : 'Redact this term'}
                  >
                    {entity.enabled ? (
                      <EyeOff className="h-3.5 w-3.5 text-emerald-700" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STREAMING HYBRID CHAT */}
      {tab === 'ask' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-[#E8EAEF] bg-[#FAFBFC] px-3 py-2">
            <div className="flex rounded border border-[#E5E7EC] bg-white p-0.5 text-[11px]">
              <button
                onClick={() => setChatMode('prefer_on_device')}
                className={`rounded px-2 py-0.5 font-medium ${
                  chatMode === 'prefer_on_device' || airGapMode
                    ? 'bg-[#0E1015] text-white'
                    : 'text-[#4A5061]'
                }`}
              >
                On-Device First
              </button>
              <button
                onClick={() => setChatMode('prefer_in_cloud')}
                disabled={airGapMode}
                className={`rounded px-2 py-0.5 font-medium disabled:opacity-40 ${
                  chatMode === 'prefer_in_cloud' && !airGapMode
                    ? 'bg-indigo-700 text-white'
                    : 'text-[#4A5061]'
                }`}
              >
                Cloud Gemini
              </button>
            </div>
            <button
              onClick={() => setRehydrate((r) => !r)}
              className="font-mono text-[10.5px] text-[#4A5061] underline underline-offset-2 hover:text-[#0E1015]"
            >
              {rehydrate ? 'Re-Hydrated' : 'Raw Tokens'}
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {vault.chatHistory.length === 0 ? (
              <div className="space-y-2 pt-4">
                <p className="text-xs text-[#697083]">
                  Ask anything about this document. All PII is stripped before inference and
                  streamed responses are re-hydrated locally.
                </p>
                {SUGGESTED_QUESTIONS[vault.category].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendChat(q, airGapMode ? 'only_on_device' : chatMode)}
                    className="block w-full rounded-md border border-[#E5E7EC] bg-[#FAFBFC] px-3 py-2 text-left text-xs text-[#1E2129] transition hover:border-[#0E1015] hover:bg-white"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              vault.chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'ml-6 bg-[#0E1015] text-white'
                      : 'mr-4 border border-[#E5E7EC] bg-[#FAFBFC] text-[#15181F]'
                  }`}
                >
                  {msg.role === 'assistant' && msg.inferenceSource && (
                    <div className="mb-1.5 flex items-center gap-2 border-b border-[#E5E7EC] pb-1 font-mono text-[10px] text-[#4A5061]">
                      <span
                        className={`font-semibold ${
                          msg.inferenceSource === 'ON_DEVICE' ? 'text-emerald-800' : 'text-indigo-800'
                        }`}
                      >
                        {msg.inferenceSource}
                      </span>
                      {msg.ttftMs !== undefined && <span>TTFT {msg.ttftMs}ms</span>}
                      {msg.latencyMs !== undefined && <span>· Total {msg.latencyMs}ms</span>}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">
                    {msg.role === 'assistant' ? (
                      <RehydratableSpan
                        text={msg.rawTokenizedContent || msg.content}
                        vault={vault}
                        rehydrate={rehydrate}
                      />
                    ) : (
                      msg.content
                    )}
                    {msg.streaming && (
                      <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-[#0E1015] align-middle" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleChatSubmit}
            className="border-t border-[#E5E7EC] bg-[#FAFBFC] p-3"
          >
            <div className="flex gap-1.5">
              <input
                id="hybrid-chat-input"
                name="hybridChatInput"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about clauses, numbers, or draft a reply…"
                className="min-w-0 flex-1 rounded-md border border-[#E5E7EC] bg-white px-3 py-2 text-xs text-[#0E1015] placeholder-[#9CA2B0] focus:border-[#0E1015] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatStreaming}
                className="flex items-center justify-center rounded-md bg-[#0E1015] px-3 text-white transition hover:bg-[#262A35] disabled:opacity-40"
              >
                {chatStreaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: TELEMETRY & CRYPTOGRAPHIC PROOF */}
      {tab === 'telemetry' && (
        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4A5061]">
              Firebase AI Logic Routing Log
            </span>
            <button
              onClick={onExportCertificate}
              className="inline-flex items-center gap-1 rounded border border-[#E5E7EC] bg-[#FAFBFC] px-2 py-1 text-[11px] font-medium text-[#0E1015] hover:bg-[#ECEEF2]"
            >
              <FileCode2 className="h-3 w-3" />
              SHA-256 Proof
            </button>
          </div>

          {telemetry.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#D5D9E0] p-5 text-center text-xs text-[#697083]">
              No live inference calls recorded yet. Run Nano PII Discovery, Triage, Hybrid Audit,
              or Chat to record real routing provenance and payload hashes.
            </p>
          ) : (
            <div className="space-y-2">
              {telemetry.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg border border-[#E5E7EC] bg-[#FAFBFC] p-3 font-mono text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#0E1015]">{ev.task}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        ev.actualSource === 'ON_DEVICE'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-indigo-100 text-indigo-900'
                      }`}
                    >
                      {ev.actualSource}
                    </span>
                  </div>
                  <div className="mt-1 text-[10.5px] text-[#4A5061]">
                    Mode: {ev.requestedMode} · {ev.modelLabel}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-[#3A3F4D]">
                    <span>Latency: {ev.latencyMs}ms</span>
                    {ev.ttftMs !== undefined && <span>TTFT: {ev.ttftMs}ms</span>}
                    <span className="text-emerald-800">PII Local: {ev.piiBytesKeptLocal} B</span>
                    <span className="text-indigo-800">
                      Wire: {ev.actualSource === 'IN_CLOUD' ? `${ev.cloudPayloadBytes} B` : '0 B'}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[9.5px] text-[#697083]">
                    Payload SHA-256: {ev.redactedSha256}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
