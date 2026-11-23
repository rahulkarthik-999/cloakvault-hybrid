import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Wifi,
  WifiOff,
  SlidersHorizontal,
  FileDown,
  FileCode2,
  FileCheck2,
  FileText,
  FileSpreadsheet,
  Globe,
  UserRound,
} from 'lucide-react';
import { Wordmark } from './BrandMark';
import { NanoStatusControl } from './NanoStatusControl';
import type { AuthModalMode } from './AuthModal';
import type { RemotePolicyConfig, SystemCapabilities, VaultDocument } from '../types/vault';

interface HeaderBarProps {
  activeVault: VaultDocument;
  onUpdateTitle: (title: string) => void;
  capabilities: SystemCapabilities;
  remotePolicy: RemotePolicyConfig;
  airGapMode: boolean;
  onToggleAirGap: () => void;
  onDownloadNano: () => void;
  nanoDownloadStalled?: boolean;
  onDismissNanoInstall?: () => void;
  onOpenFirebaseModal: () => void;
  onOpenAuthModal: (mode: AuthModalMode) => void;
  onExportRedactedTxt: () => void;
  onExportRedactedPdf: () => void;
  onExportRedactedDocx: () => void;
  onExportRedactedHtml: () => void;
  onExportAuditPdf: () => void;
  onExportAuditDocx: () => void;
  onExportAuditMd: () => void;
  onExportEntitiesCsv: () => void;
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
  nanoDownloadStalled,
  onDismissNanoInstall,
  onOpenFirebaseModal,
  onOpenAuthModal,
  onExportRedactedTxt,
  onExportRedactedPdf,
  onExportRedactedDocx,
  onExportRedactedHtml,
  onExportAuditPdf,
  onExportAuditDocx,
  onExportAuditMd,
  onExportEntitiesCsv,
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
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
        <a
          href="/"
          className="flex shrink-0 items-center rounded-md transition hover:opacity-80"
          title="CloakVault home"
        >
          <Wordmark size={26} />
        </a>

        <span className="hidden shrink-0 text-[#CDD2DB] sm:inline">/</span>

        <input
          id="vault-document-title"
          name="vaultDocumentTitle"
          type="text"
          value={activeVault.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          aria-label="Document title"
          className="hidden min-w-0 max-w-[130px] truncate rounded px-1.5 py-0.5 text-[13px] font-medium text-[#0E1015] hover:bg-[#F3F4F7] focus:bg-[#F3F4F7] focus:outline-none sm:block xl:max-w-[220px] 2xl:max-w-[340px]"
        />

        <span className="hidden shrink-0 rounded border border-[#E5E7EC] bg-[#F3F4F7] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#4A5061] 2xl:inline-block">
          Stored on this device
        </span>
      </div>

      {/* Right: Real Runtime Controls (scrolls sideways on phones) */}
      <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:w-auto lg:shrink-0 lg:overflow-visible lg:px-0 xl:gap-2 [&>*]:shrink-0">
        {/* Platform-aware AI Runtime Status Control */}
        <NanoStatusControl
          capabilities={capabilities}
          onDownloadNano={onDownloadNano}
          nanoDownloadStalled={nanoDownloadStalled}
          onDismissNanoInstall={onDismissNanoInstall}
        />

        {/* Network / Air-Gap Segmented Toggle */}
        <button
          onClick={onToggleAirGap}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition ${
            isOfflineEffective
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-[#E5E7EC] bg-white text-[#3A3F4D] hover:bg-[#F3F4F7]'
          }`}
          title="Simulate air-gapped / offline execution to test on-device execution"
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
            className="flex items-center gap-1 rounded-full border border-[#E5E7EC] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#0E1015] transition hover:bg-[#F3F4F7]"
          >
            <FileDown className="h-3.5 w-3.5 text-[#4A5061]" />
            <span>Export</span>
            <ChevronDown className="h-3 w-3 text-[#697083]" />
          </button>

          {exportOpen && (
            <div className="fixed inset-x-4 top-28 z-40 rounded-xl border border-[#E5E7EC] bg-white p-2 shadow-xl lg:absolute lg:inset-x-auto lg:right-0 lg:top-auto lg:mt-1.5 lg:w-72">
              {/* Section 1: Redacted Document (0 B raw PII) */}
              <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[#697083]">
                Redacted Document (0 B PII)
              </div>
              <div className="grid grid-cols-2 gap-1 px-1 pb-2">
                <button
                  onClick={() => {
                    onExportRedactedPdf();
                    setExportOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-md border border-[#E5E7EC] bg-[#FAFBFC] px-2.5 py-2 text-left text-xs font-medium text-[#0E1015] transition hover:border-emerald-300 hover:bg-emerald-50/60"
                >
                  <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                  <span>PDF (.pdf)</span>
                </button>
                <button
                  onClick={() => {
                    onExportRedactedDocx();
                    setExportOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-md border border-[#E5E7EC] bg-[#FAFBFC] px-2.5 py-2 text-left text-xs font-medium text-[#0E1015] transition hover:border-emerald-300 hover:bg-emerald-50/60"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-blue-700" />
                  <span>Word (.docx)</span>
                </button>
                <button
                  onClick={() => {
                    onExportRedactedTxt();
                    setExportOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-md border border-[#E5E7EC] bg-[#FAFBFC] px-2.5 py-2 text-left text-xs font-medium text-[#0E1015] transition hover:border-emerald-300 hover:bg-emerald-50/60"
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                  <span>Text (.txt)</span>
                </button>
                <button
                  onClick={() => {
                    onExportRedactedHtml();
                    setExportOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-md border border-[#E5E7EC] bg-[#FAFBFC] px-2.5 py-2 text-left text-xs font-medium text-[#0E1015] transition hover:border-emerald-300 hover:bg-emerald-50/60"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>HTML (.html)</span>
                </button>
              </div>

              {/* Section 2: Redlined Risk Audit */}
              <div className="border-t border-[#EEF0F4] px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#697083]">
                Redlined Risk Audit Report
              </div>
              <div className="grid grid-cols-3 gap-1 px-1 pb-2">
                <button
                  onClick={() => {
                    onExportAuditPdf();
                    setExportOpen(false);
                  }}
                  disabled={!activeVault.auditReport}
                  className="flex items-center justify-center gap-1 rounded-md border border-[#E5E7EC] bg-[#FAFBFC] px-2 py-1.5 text-xs font-medium text-[#0E1015] transition hover:border-indigo-300 hover:bg-indigo-50/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>.pdf</span>
                </button>
                <button
                  onClick={() => {
                    onExportAuditDocx();
                    setExportOpen(false);
                  }}
                  disabled={!activeVault.auditReport}
                  className="flex items-center justify-center gap-1 rounded-md border border-[#E5E7EC] bg-[#FAFBFC] px-2 py-1.5 text-xs font-medium text-[#0E1015] transition hover:border-indigo-300 hover:bg-indigo-50/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>.docx</span>
                </button>
                <button
                  onClick={() => {
                    onExportAuditMd();
                    setExportOpen(false);
                  }}
                  disabled={!activeVault.auditReport}
                  className="flex items-center justify-center gap-1 rounded-md border border-[#E5E7EC] bg-[#FAFBFC] px-2 py-1.5 text-xs font-medium text-[#0E1015] transition hover:border-indigo-300 hover:bg-indigo-50/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>.md</span>
                </button>
              </div>

              {/* Section 3: Compliance & Spreadsheets */}
              <div className="border-t border-[#EEF0F4] pt-1.5">
                <button
                  onClick={() => {
                    onExportEntitiesCsv();
                    setExportOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[#0E1015] hover:bg-[#F3F4F7]"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                  <div>
                    <div className="font-medium">Entities &amp; Findings (.csv)</div>
                    <div className="text-[10.5px] text-[#697083]">Excel / Sheets compliance log</div>
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
                    <div className="text-[10.5px] text-[#697083]">Cryptographic verification receipt</div>
                  </div>
                </button>
              </div>
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
            {capabilities.firebaseConfigured ? (
              <>
                Firebase
                <span className="hidden xl:inline"> · {remotePolicy.cloudModelName}</span>
              </>
            ) : (
              'Firebase Setup'
            )}
          </span>
          <SlidersHorizontal className="h-3 w-3 opacity-60" />
        </button>

        {/* Account / Sign In Control */}
        {capabilities.firebaseConfigured && (
          capabilities.authUserUid && !capabilities.authIsAnonymous ? (
            <button
              onClick={() => onOpenAuthModal('signin')}
              title={capabilities.authEmail || 'Account settings'}
              className="flex items-center gap-1.5 rounded-full border border-[#E5E7EC] bg-white py-0.5 pl-1 pr-2.5 text-[11.5px] font-medium text-[#0E1015] transition hover:border-[#CDD2DB] hover:bg-[#F3F4F7]"
            >
              {capabilities.authPhotoUrl ? (
                <img
                  src={capabilities.authPhotoUrl}
                  alt={capabilities.authDisplayName || 'Account avatar'}
                  referrerPolicy="no-referrer"
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0E1015] font-mono text-[9.5px] font-semibold text-white">
                  {(capabilities.authDisplayName || capabilities.authEmail || 'U')
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
              )}
              <span className="max-w-[110px] truncate">
                {capabilities.authDisplayName?.split(' ')[0] ||
                  capabilities.authEmail?.split('@')[0] ||
                  'Account'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onOpenAuthModal('signin')}
              className="flex items-center gap-1.5 rounded-full bg-[#0E1015] px-3 py-1 text-[11.5px] font-medium text-white transition hover:bg-[#262A35]"
            >
              <UserRound className="h-3.5 w-3.5" />
              <span>Sign in</span>
            </button>
          )
        )}
      </div>
    </header>
  );
}
