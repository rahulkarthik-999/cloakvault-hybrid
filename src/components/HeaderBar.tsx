import { useState, useRef, useEffect } from 'react';
import {
  Cpu,
  Download,
  ChevronDown,
  Wifi,
  WifiOff,
  Loader2,
  SlidersHorizontal,
  FileDown,
  FileCode2,
  FileCheck2,
} from 'lucide-react';
import { Wordmark } from './BrandMark';
import type { RemotePolicyConfig, SystemCapabilities, VaultDocument } from '../types/vault';

interface HeaderBarProps {
  activeVault: VaultDocument;
  onUpdateTitle: (title: string) => void;
  capabilities: SystemCapabilities;
  remotePolicy: RemotePolicyConfig;
  airGapMode: boolean;
  onToggleAirGap: () => void;
  onDownloadNano: () => void;
  onOpenFirebaseModal: () => void;
  onExportRedacted: () => void;
  onExportAuditMd: () => void;
  onExportCertificate: () => void;
}

export function HeaderBar({
  activeVault,
  onUpdateTitle,
  capabilities,
  remotePolicy,
  airGapMode,
  onToggleAirGap,
  onDownloadNano,
  onOpenFirebaseModal,
  onExportRedacted,
  onExportAuditMd,
  onExportCertificate,
}: HeaderBarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOfflineEffective = airGapMode || !capabilities.online;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#E5E7EC] bg-white/90 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur lg:h-14 lg:flex-nowrap lg:py-0">
      {/* Left: Wordmark + Editable Document Title */}
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
        <a
          href="/"
          className="flex shrink-0 items-center rounded-md transition hover:opacity-80"
          title="CloakVault home"
        >
          <Wordmark size={26} />
        </a>

        <span className="hidden text-[#CDD2DB] sm:inline">/</span>

        <input
          id="vault-document-title"
          name="vaultDocumentTitle"
          type="text"
          value={activeVault.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          aria-label="Document title"
          className="hidden min-w-0 max-w-[340px] truncate rounded px-1.5 sm:block py-0.5 text-[13px] font-medium text-[#0E1015] hover:bg-[#F3F4F7] focus:bg-[#F3F4F7] focus:outline-none"
        />

        <span className="hidden rounded border border-[#E5E7EC] bg-[#F3F4F7] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#4A5061] xl:inline-block">
          Stored on this device
        </span>
      </div>

      {/* Right: Real Runtime Controls (scrolls sideways on phones) */}
      <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:w-auto lg:shrink-0 lg:overflow-visible lg:px-0 [&>*]:shrink-0">
        {/* On-Device Gemini Nano Control */}
        {capabilities.chromeNanoStatus === 'available' ? (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11.5px] font-medium text-emerald-800">
            <Cpu className="h-3.5 w-3.5" />
            <span>Gemini Nano · on-device</span>
            <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-emerald-500" />
          </div>
        ) : capabilities.chromeNanoStatus === 'downloading' ? (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-800">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="font-mono">
              Downloading Nano {capabilities.chromeNanoDownloadProgress ?? 0}%
            </span>
          </div>
        ) : capabilities.chromeNanoStatus === 'downloadable' ? (
          <button
            onClick={onDownloadNano}
            className="flex items-center gap-1.5 rounded-md border border-[#0E1015] bg-[#0E1015] px-2.5 py-1 text-[11.5px] font-medium text-white transition hover:bg-[#262A35]"
          >
            <Download className="h-3 w-3" />
            <span>Download Gemini Nano</span>
          </button>
        ) : (
          <span
            className="hidden items-center gap-1.5 rounded-full border border-[#E5E7EC] bg-[#F3F4F7] px-3 py-1 text-[11px] text-[#697083] md:flex"
            title="Gemini Nano isn't available in this browser, so Firebase AI Logic routes prompts to Cloud Gemini. Local redaction still runs fully on-device."
          >
            <Cpu className="h-3.5 w-3.5 opacity-60" />
            Nano unavailable · cloud fallback
          </span>
        )}

        {/* Network / Air-Gap Segmented Toggle */}
        <button
          onClick={onToggleAirGap}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium transition ${
            isOfflineEffective
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-[#E5E7EC] bg-white text-[#3A3F4D] hover:bg-[#F3F4F7]'
          }`}
          title="Simulate air-gapped / offline execution to test automatic on-device hybrid fallback"
        >
          {isOfflineEffective ? (
            <>
              <WifiOff className="h-3.5 w-3.5 text-amber-700" />
              <span>Air-gap · device only</span>
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5 text-[#4A5061]" />
              <span>Hybrid routing</span>
            </>
          )}
        </button>

        {/* Export Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="flex items-center gap-1 rounded-full border border-[#E5E7EC] bg-white px-3 py-1 text-[11.5px] font-medium text-[#0E1015] transition hover:bg-[#F3F4F7]"
          >
            <FileDown className="h-3.5 w-3.5 text-[#4A5061]" />
            <span>Export</span>
            <ChevronDown className="h-3 w-3 text-[#697083]" />
          </button>

          {exportOpen && (
            <div className="fixed inset-x-4 top-28 z-40 rounded-lg border border-[#E5E7EC] bg-white p-1 shadow-lg lg:absolute lg:inset-x-auto lg:right-0 lg:top-auto lg:mt-1.5 lg:w-60">
              <button
                onClick={() => {
                  onExportRedacted();
                  setExportOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[#0E1015] hover:bg-[#F3F4F7]"
              >
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-700" />
                <div>
                  <div className="font-medium">Redacted Document (.txt)</div>
                  <div className="text-[10.5px] text-[#697083]">Safe to email externally</div>
                </div>
              </button>
              <button
                onClick={() => {
                  onExportAuditMd();
                  setExportOpen(false);
                }}
                disabled={!activeVault.auditReport}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[#0E1015] hover:bg-[#F3F4F7] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileDown className="h-3.5 w-3.5 text-indigo-700" />
                <div>
                  <div className="font-medium">Redlined Audit Report (.md)</div>
                  <div className="text-[10.5px] text-[#697083]">Findings &amp; counter-clauses</div>
                </div>
              </button>
              <button
                onClick={() => {
                  onExportCertificate();
                  setExportOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[#0E1015] hover:bg-[#F3F4F7]"
              >
                <FileCode2 className="h-3.5 w-3.5 text-[#4A5061]" />
                <div>
                  <div className="font-medium">Zero-Leak SHA-256 Proof (.json)</div>
                  <div className="text-[10.5px] text-[#697083]">Cryptographic compliance log</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Firebase Stack Button */}
        <button
          onClick={onOpenFirebaseModal}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium transition ${
            capabilities.firebaseConfigured
              ? 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100/70'
              : 'border-[#E5E7EC] bg-[#F3F4F7] text-[#0E1015] hover:bg-[#E8EAEF]'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              capabilities.firebaseConfigured ? 'bg-indigo-600' : 'bg-slate-400'
            }`}
          />
          <span>
            {capabilities.firebaseConfigured
              ? `Firebase · ${remotePolicy.cloudModelName}`
              : 'Firebase Setup'}
          </span>
          <SlidersHorizontal className="h-3 w-3 opacity-60" />
        </button>
      </div>
    </header>
  );
}
