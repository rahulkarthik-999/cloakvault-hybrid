import { useState, useRef, useEffect } from 'react';
import {
  Shield,
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
    <header className="flex h-13 shrink-0 items-center justify-between gap-4 border-b border-[#E4E2DC] bg-[#FFFFFF] px-4">
      {/* Left: Wordmark + Editable Document Title */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#171717] text-white">
            <Shield className="h-3.5 w-3.5" />
          </div>
          <span className="font-serif text-[17px] font-semibold tracking-tight text-[#171717]">
            CloakVault
          </span>
        </div>

        <span className="text-[#D4D1C7]">/</span>

        <input
          id="vault-document-title"
          name="vaultDocumentTitle"
          type="text"
          value={activeVault.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          aria-label="Document title"
          className="min-w-0 max-w-[340px] truncate rounded px-1.5 py-0.5 text-[13px] font-medium text-[#171717] hover:bg-[#F6F5F1] focus:bg-[#F6F5F1] focus:outline-none"
        />

        <span className="hidden rounded border border-[#E4E2DC] bg-[#F6F5F1] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#57534E] xl:inline-block">
          Local IndexedDB
        </span>
      </div>

      {/* Right: Real Runtime Controls */}
      <div className="flex shrink-0 items-center gap-2">
        {/* On-Device Gemini Nano Control */}
        {capabilities.chromeNanoStatus === 'available' ? (
          <div className="flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11.5px] font-medium text-teal-800">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            <span>On-Device Nano Ready</span>
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
            className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-2.5 py-1 text-[11.5px] font-medium text-white transition hover:bg-[#2E2E2B]"
          >
            <Download className="h-3 w-3" />
            <span>Download Gemini Nano</span>
          </button>
        ) : (
          <span
            className="hidden rounded-md border border-[#E4E2DC] bg-[#F6F5F1] px-2.5 py-1 text-[11px] text-[#78716C] md:inline-block"
            title="Chrome Built-in AI (Gemini Nano) requires Chrome desktop with Prompt API support"
          >
            Nano: {capabilities.chromeNanoStatus}
          </span>
        )}

        {/* Network / Air-Gap Segmented Toggle */}
        <button
          onClick={onToggleAirGap}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition ${
            isOfflineEffective
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-[#E4E2DC] bg-white text-[#44403C] hover:bg-[#F6F5F1]'
          }`}
          title="Simulate air-gapped / offline execution to test automatic on-device hybrid fallback"
        >
          {isOfflineEffective ? (
            <>
              <WifiOff className="h-3.5 w-3.5 text-amber-700" />
              <span>Air-Gap</span>
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5 text-[#57534E]" />
              <span>Hybrid Online</span>
            </>
          )}
        </button>

        {/* Export Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="flex items-center gap-1 rounded-md border border-[#E4E2DC] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#171717] transition hover:bg-[#F6F5F1]"
          >
            <FileDown className="h-3.5 w-3.5 text-[#57534E]" />
            <span>Export</span>
            <ChevronDown className="h-3 w-3 text-[#78716C]" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 z-40 mt-1.5 w-60 rounded-lg border border-[#E4E2DC] bg-white p-1 shadow-lg">
              <button
                onClick={() => {
                  onExportRedacted();
                  setExportOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[#171717] hover:bg-[#F6F5F1]"
              >
                <FileCheck2 className="h-3.5 w-3.5 text-teal-700" />
                <div>
                  <div className="font-medium">Redacted Document (.txt)</div>
                  <div className="text-[10.5px] text-[#78716C]">Safe to email externally</div>
                </div>
              </button>
              <button
                onClick={() => {
                  onExportAuditMd();
                  setExportOpen(false);
                }}
                disabled={!activeVault.auditReport}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[#171717] hover:bg-[#F6F5F1] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileDown className="h-3.5 w-3.5 text-blue-700" />
                <div>
                  <div className="font-medium">Redlined Audit Report (.md)</div>
                  <div className="text-[10.5px] text-[#78716C]">Findings &amp; counter-clauses</div>
                </div>
              </button>
              <button
                onClick={() => {
                  onExportCertificate();
                  setExportOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[#171717] hover:bg-[#F6F5F1]"
              >
                <FileCode2 className="h-3.5 w-3.5 text-[#57534E]" />
                <div>
                  <div className="font-medium">Zero-Leak SHA-256 Proof (.json)</div>
                  <div className="text-[10.5px] text-[#78716C]">Cryptographic compliance log</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Firebase Stack Button */}
        <button
          onClick={onOpenFirebaseModal}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition ${
            capabilities.firebaseConfigured
              ? 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100/70'
              : 'border-[#E4E2DC] bg-[#F6F5F1] text-[#171717] hover:bg-[#ECEAE3]'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              capabilities.firebaseConfigured ? 'bg-blue-600' : 'bg-stone-400'
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
