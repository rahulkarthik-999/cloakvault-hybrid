import { useState } from 'react';
import { Check, Copy, RefreshCw, Terminal } from 'lucide-react';
import type { NanoCapabilitySnapshot } from '../lib/nanoPlatform';

interface DeveloperNanoDiagnosticsProps {
  snapshot: NanoCapabilitySnapshot;
  onRecheck: () => Promise<void>;
}

function CopySnippet({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded border border-[#E5E7EC] bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-[#0E1015] hover:bg-[#EEF0F4]"
    >
      {value}
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 opacity-60" />}
    </button>
  );
}

/**
 * Development-only / explicit opt-in (`?debug=nano`) technical diagnostics for on-device Gemini Nano.
 * Never rendered for ordinary production users.
 */
export function DeveloperNanoDiagnostics({
  snapshot,
  onRecheck,
}: DeveloperNanoDiagnosticsProps) {
  const [checking, setChecking] = useState(false);

  if (!snapshot.shouldExposeDiagnostics) return null;

  const { platform, hasPromptApi, modelAvailability, canUseOnDevice, canDownloadOnDevice, diagnostics } =
    snapshot;

  const handleRecheck = async () => {
    setChecking(true);
    try {
      await onRecheck();
    } finally {
      setChecking(false);
    }
  };

  return (
    <details className="mt-5 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 text-xs">
      <summary className="flex cursor-pointer items-center justify-between font-semibold text-amber-950">
        <span className="inline-flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5 text-amber-700" />
          Developer Diagnostics — On-Device Gemini Nano
        </span>
        <span className="font-mono text-[10px] font-normal text-amber-800">DEV / ?debug=nano</span>
      </summary>

      <div className="mt-3 space-y-2 border-t border-amber-200/80 pt-2.5 font-mono text-[11px] text-[#1E2129]">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <div>
            OS: <span className="font-semibold">{platform.os}</span>
          </div>
          <div>
            Browser: <span className="font-semibold">{platform.browser}</span>
          </div>
          <div>
            Mobile: <span className="font-semibold">{String(platform.isMobile)}</span>
          </div>
          <div>
            Chrome Desktop: <span className="font-semibold">{String(platform.isChromeDesktop)}</span>
          </div>
          <div>
            Chrome Major: <span className="font-semibold">{platform.chromeMajor ?? 'n/a'}</span>
          </div>
          <div>
            Prompt API: <span className="font-semibold">{String(hasPromptApi)}</span>
          </div>
          <div>
            availability(): <span className="font-semibold">{modelAvailability}</span>
          </div>
          <div>
            canUse / canDownload:{' '}
            <span className="font-semibold">
              {String(canUseOnDevice)} / {String(canDownloadOnDevice)}
            </span>
          </div>
          <div>
            CPU threads: <span className="font-semibold">{diagnostics?.cpuCores ?? 'unknown'}</span>
          </div>
          <div>
            Device RAM:{' '}
            <span className="font-semibold">
              {diagnostics?.deviceMemoryGb ? `>=${diagnostics.deviceMemoryGb} GB` : 'unknown'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1.5 font-sans text-[11px] text-[#4A5061]">
          <span>Internal pages:</span>
          <CopySnippet value="chrome://on-device-internals" />
          <CopySnippet value="chrome://components" />
          <CopySnippet value="chrome://settings/help" />
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => void handleRecheck()}
            disabled={checking}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EC] bg-white px-2.5 py-1 font-sans text-[11px] font-medium text-[#0E1015] hover:bg-[#F3F4F7] disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
            Recheck LanguageModel.availability()
          </button>
        </div>
      </div>
    </details>
  );
}
