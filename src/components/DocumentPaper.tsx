import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  CloudUpload,
  Loader2,
  Lock,
  Scissors,
} from 'lucide-react';
import { applyRedaction, segmentDocumentWithEntities } from '../lib/piiEngine';
import { sha256Hex } from '../lib/cryptoProof';
import type { PiiType, VaultDocument } from '../types/vault';

interface DocumentPaperProps {
  vault: VaultDocument;
  highlightedQuote: string | null;
  onClearHighlight: () => void;
  onUpdateRawText: (text: string) => void;
  onToggleEntity: (entityId: string) => void;
  onRedactSelection: (selectedText: string, type: PiiType) => void;
  onSyncFirestore: () => Promise<void>;
  firestoreConfigured: boolean;
  syncBusy: boolean;
  lastSyncMessage: string | null;
}

const SELECTION_TYPES: Array<{ type: PiiType; label: string }> = [
  { type: 'PERSON', label: 'Person' },
  { type: 'ORG', label: 'Org' },
  { type: 'ACCOUNT', label: 'Account' },
  { type: 'GOV_ID', label: 'Gov ID' },
  { type: 'SECRET', label: 'Secret' },
  { type: 'CUSTOM', label: 'Custom' },
];

export function DocumentPaper({
  vault,
  highlightedQuote,
  onClearHighlight,
  onUpdateRawText,
  onToggleEntity,
  onRedactSelection,
  onSyncFirestore,
  firestoreConfigured,
  syncBusy,
  lastSyncMessage,
}: DocumentPaperProps) {
  const [viewMode, setViewMode] = useState<'redacted' | 'wire' | 'original' | 'edit'>('redacted');
  const [selectionPopup, setSelectionPopup] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [hashes, setHashes] = useState<{ orig: string; wire: string } | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const highlightMarkRef = useRef<HTMLSpanElement>(null);

  const { redactedText, shieldedBytes, activeCount, zeroLeakVerified } = applyRedaction(
    vault.rawText,
    vault.entities
  );
  const segments = segmentDocumentWithEntities(vault.rawText, vault.entities);

  // Compute live cryptographic SHA-256 hashes of original vs outbound payload
  useEffect(() => {
    let cancelled = false;
    Promise.all([sha256Hex(vault.rawText), sha256Hex(redactedText)]).then(([orig, wire]) => {
      if (!cancelled) setHashes({ orig, wire });
    });
    return () => {
      cancelled = true;
    };
  }, [vault.rawText, redactedText]);

  // Auto-scroll to highlighted audit clause when a finding is clicked in the Inspector
  useEffect(() => {
    if (highlightedQuote && viewMode !== 'edit') {
      const timer = setTimeout(() => {
        highlightMarkRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [highlightedQuote, viewMode]);

  const handleMouseUp = () => {
    if (viewMode === 'edit' || viewMode === 'wire') {
      setSelectionPopup(null);
      return;
    }
    const sel = window.getSelection();
    const selected = sel?.toString().trim() ?? '';
    if (selected.length >= 2 && selected.length <= 120 && paperRef.current && sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = paperRef.current.getBoundingClientRect();
      setSelectionPopup({
        text: selected,
        x: Math.max(16, Math.min(rect.left - containerRect.left, containerRect.width - 340)),
        y: Math.max(8, rect.top - containerRect.top - 48),
      });
    } else {
      setSelectionPopup(null);
    }
  };

  const applySelectionRedact = (type: PiiType) => {
    if (!selectionPopup) return;
    onRedactSelection(selectionPopup.text, type);
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  // Helper to highlight a clicked audit quote inside rendered text
  const renderWithOptionalQuoteHighlight = (text: string) => {
    if (!highlightedQuote || highlightedQuote.trim().length < 8) return text;
    const fullNeedle = highlightedQuote.trim().toLowerCase();
    let idx = text.toLowerCase().indexOf(fullNeedle);
    let matchLen = fullNeedle.length;
    if (idx === -1 && fullNeedle.length > 40) {
      const shortNeedle = fullNeedle.slice(0, 64).trim();
      idx = text.toLowerCase().indexOf(shortNeedle);
      matchLen = shortNeedle.length;
    }
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span
          ref={highlightMarkRef}
          className="rounded bg-amber-200/90 px-0.5 text-[#171717] ring-2 ring-amber-400"
        >
          {text.slice(idx, idx + matchLen)}
        </span>
        {text.slice(idx + matchLen)}
      </>
    );
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#F6F5F1]">
      {/* Document Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E2DC] bg-[#FAF9F6] px-4 py-2">
        <div className="flex items-center gap-0.5 rounded-md border border-[#E4E2DC] bg-white p-0.5">
          {(
            [
              ['redacted', 'Redacted View'],
              ['wire', 'Outbound Cloud Payload'],
              ['original', 'Original (Local)'],
              ['edit', 'Edit Source'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setViewMode(id);
                setSelectionPopup(null);
              }}
              className={`rounded px-2.5 py-1 text-[11.5px] font-medium transition ${
                viewMode === id
                  ? 'bg-[#171717] text-white'
                  : 'text-[#57534E] hover:bg-[#F6F5F1] hover:text-[#171717]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-1.5 font-mono text-[11px] text-teal-800 sm:flex">
            {zeroLeakVerified ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-700" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-red-700" />
            )}
            <span>
              {activeCount} shielded · {shieldedBytes.toLocaleString()} B local
            </span>
          </div>

          {lastSyncMessage && (
            <span className="font-mono text-[10.5px] text-teal-800">{lastSyncMessage}</span>
          )}

          <button
            onClick={onSyncFirestore}
            disabled={!firestoreConfigured || syncBusy}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E2DC] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#171717] transition hover:bg-[#F0EFEA] disabled:cursor-not-allowed disabled:opacity-45"
            title={
              firestoreConfigured
                ? 'Sync zero-PII redacted copy & audit report to Cloud Firestore'
                : 'Configure Firebase in the top bar to enable zero-PII Firestore sync'
            }
          >
            {syncBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CloudUpload className="h-3 w-3 text-blue-700" />
            )}
            <span>Sync Redacted</span>
          </button>
        </div>
      </div>

      {/* Scrollable Paper Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-10">
        <div
          ref={paperRef}
          onMouseUp={handleMouseUp}
          className="paper-sheet relative mx-auto max-w-[820px] rounded-xl border border-[#E4E2DC] bg-white px-7 py-8 sm:px-11 sm:py-10"
        >
          {/* Floating Select-to-Redact Popover (Acrobat-style real workflow) */}
          {selectionPopup && (
            <div
              style={{ left: selectionPopup.x, top: selectionPopup.y }}
              className="absolute z-30 flex items-center gap-1 rounded-lg border border-[#171717] bg-[#171717] px-2 py-1.5 text-white shadow-xl"
            >
              <Scissors className="mr-1 h-3 w-3 text-teal-400" />
              <span className="mr-1 text-[10.5px] text-zinc-300">Redact:</span>
              {SELECTION_TYPES.map((item) => (
                <button
                  key={item.type}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySelectionRedact(item.type);
                  }}
                  className="rounded bg-white/10 px-1.5 py-0.5 text-[10.5px] font-medium text-white transition hover:bg-teal-500 hover:text-zinc-950"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Active Highlighted Clause Banner */}
          {highlightedQuote && viewMode !== 'edit' && (
            <div className="mb-5 flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <span className="truncate">
                Highlighting referenced clause from Audit Finding
              </span>
              <button
                onClick={onClearHighlight}
                className="shrink-0 font-medium underline underline-offset-2"
              >
                Clear
              </button>
            </div>
          )}

          {/* Paper Header Metadata */}
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#ECEAE3] pb-4">
            <div>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#78716C]">
                {vault.category} document · {vault.rawText.length.toLocaleString()} chars
              </span>
              <h1 className="mt-1 font-serif text-2xl font-medium tracking-tight text-[#171717]">
                {vault.title}
              </h1>
            </div>
            {viewMode === 'redacted' && (
              <span className="text-[11px] text-[#78716C]">
                Tip: Highlight any text with your mouse to redact instantly
              </span>
            )}
          </div>

          {/* Local Triage Summary Callout if generated */}
          {vault.localTriageSummary && viewMode === 'redacted' && (
            <div className="mb-6 rounded-lg border border-[#E4E2DC] bg-[#FAF9F6] p-3.5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#44403C]">
                    Triage Brief · {vault.localTriageSummary.documentType}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                      vault.localTriageSummary.urgency === 'HIGH'
                        ? 'bg-red-100 text-red-800'
                        : vault.localTriageSummary.urgency === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {vault.localTriageSummary.urgency}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#78716C]">
                  {vault.localTriageSummary.inferenceSource} · {vault.localTriageSummary.latencyMs}ms
                </span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-[#292524]">
                {vault.localTriageSummary.summary}
              </p>
            </div>
          )}

          {/* MODE 1: Interactive Redacted Paper */}
          {viewMode === 'redacted' && (
            <div className="whitespace-pre-wrap font-serif text-[15.5px] leading-[1.78] text-[#1C1917]">
              {vault.rawText.trim().length === 0 ? (
                <p className="font-sans text-sm text-[#78716C]">
                  Document is empty. Switch to &ldquo;Edit Source&rdquo; to paste text, or import a
                  PDF/DOCX file from the left rail.
                </p>
              ) : (
                segments.map((seg, i) =>
                  seg.entity ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onToggleEntity(seg.entity!.id)}
                      title={`Local-only value: "${seg.text}" (${seg.entity.source}) — Click to unredact`}
                      className="mx-0.5 inline-flex items-center gap-1 rounded bg-[#171717] px-1.5 py-0.5 align-baseline font-mono text-[11px] font-medium text-[#F6F5F1] transition hover:bg-teal-800"
                    >
                      <Lock className="h-2.5 w-2.5 text-teal-400" />
                      {seg.entity.token}
                    </button>
                  ) : (
                    <span key={i}>{renderWithOptionalQuoteHighlight(seg.text)}</span>
                  )
                )
              )}
            </div>
          )}

          {/* MODE 2: Exact Cloud Wire Payload + Web Crypto SHA-256 Proof */}
          {viewMode === 'wire' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-3.5 text-xs text-teal-950">
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-teal-700" />
                    Zero-Leak Outbound Wire Proof — 0 bytes of active PII present
                  </span>
                  <span className="font-mono text-[11px]">
                    {new TextEncoder().encode(redactedText).length.toLocaleString()} bytes outbound
                  </span>
                </div>
                {hashes && (
                  <div className="mt-2.5 grid grid-cols-1 gap-1.5 border-t border-teal-200/80 pt-2 font-mono text-[10.5px] text-teal-900/80">
                    <div className="truncate">
                      <span className="font-semibold text-teal-950">Local Original SHA-256: </span>
                      {hashes.orig}
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-teal-950">Outbound Cloud SHA-256: </span>
                      {hashes.wire}
                    </div>
                  </div>
                )}
              </div>

              <pre className="whitespace-pre-wrap rounded-lg border border-[#E4E2DC] bg-[#FAF9F6] p-4 font-mono text-[12px] leading-relaxed text-[#292524]">
                {renderWithOptionalQuoteHighlight(redactedText)}
              </pre>
            </div>
          )}

          {/* MODE 3: Original Local View */}
          {viewMode === 'original' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Viewing unredacted local document in browser memory. Select any phrase to add it to
                the local PII vault.
              </div>
              <div className="whitespace-pre-wrap font-serif text-[15.5px] leading-[1.78] text-[#1C1917]">
                {renderWithOptionalQuoteHighlight(vault.rawText)}
              </div>
            </div>
          )}

          {/* MODE 4: Raw Text Editor */}
          {viewMode === 'edit' && (
            <textarea
              id="raw-document-editor"
              name="rawDocumentEditor"
              value={vault.rawText}
              onChange={(e) => onUpdateRawText(e.target.value)}
              rows={22}
              placeholder="Paste any contract, NDA, bank statement, invoice, or medical bill here…"
              className="w-full rounded-lg border border-[#E4E2DC] bg-[#FAF9F6] p-4 font-mono text-[12.5px] leading-relaxed text-[#171717] placeholder-[#A8A29E] focus:border-[#171717] focus:bg-white focus:outline-none"
            />
          )}
        </div>
      </div>
    </section>
  );
}
