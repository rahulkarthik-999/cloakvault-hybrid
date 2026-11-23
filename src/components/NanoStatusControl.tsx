import { useEffect, useRef, useState } from 'react';
import { Cloud, Cpu, Download, Loader2, ShieldCheck, X } from 'lucide-react';
import type { SystemCapabilities } from '../types/vault';

interface NanoStatusControlProps {
  capabilities: SystemCapabilities;
  onDownloadNano: () => void;
  nanoDownloadStalled?: boolean;
  onDismissNanoInstall?: () => void;
}

/**
 * Production-safe, platform-aware AI runtime status indicator.
 *
 * - Compatible desktop Chrome with Nano available -> "Gemini Nano · on-device"
 * - Compatible desktop Chrome downloading Nano    -> "Installing on-device AI" progress pill + calm info popover
 * - Compatible desktop Chrome with Nano ready to download -> "Enable on-device AI" + guided installation popover
 * - Mobile (Android/iOS) or unsupported desktop   -> subtle "Cloud AI active" status pill + short privacy note
 *
 * Never exposes raw API errors, CPU/RAM diagnostics, chrome:// URLs, or desktop install instructions.
 */
export function NanoStatusControl({
  capabilities,
  onDownloadNano,
  nanoDownloadStalled = false,
  onDismissNanoInstall,
}: NanoStatusControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { nanoCapability, chromeNanoStatus, chromeNanoDownloadProgress } = capabilities;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (nanoCapability.canUseOnDevice) {
      setOpen(false);
    }
  }, [nanoCapability.canUseOnDevice]);

  // 1. Desktop Chrome with Gemini Nano active on-device
  if (nanoCapability.canUseOnDevice && chromeNanoStatus === 'available') {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11.5px] font-medium text-emerald-800">
        <Cpu className="h-3.5 w-3.5" />
        <span>Gemini Nano · on-device</span>
        <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-emerald-500" />
      </div>
    );
  }

  // 2. Desktop Chrome actively downloading Gemini Nano (auto-falls back to Cloud AI if stalled)
  if (
    nanoCapability.canDownloadOnDevice &&
    chromeNanoStatus === 'downloading' &&
    !nanoDownloadStalled
  ) {
    const pct = chromeNanoDownloadProgress;
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-900 transition hover:bg-amber-100/70"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="font-mono">
            {pct !== null && pct > 0 ? `Installing Nano ${pct}%` : 'Installing on-device AI…'}
          </span>
        </button>

        {open && (
          <div className="fixed inset-x-4 top-28 z-40 rounded-xl border border-[#E5E7EC] bg-white p-3.5 shadow-xl lg:absolute lg:inset-x-auto lg:right-0 lg:top-auto lg:mt-1.5 lg:w-72">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[12.5px] font-semibold text-[#0E1015]">
                Installing on-device AI
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-0.5 text-[#697083] hover:bg-[#F3F4F7]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#4A5061]">
              Chrome is preparing Gemini Nano for local inference on this device. You can continue
              auditing documents with sanitized Cloud AI while this completes.
            </p>
            {pct !== null && pct > 0 && (
              <div className="mt-2.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                  />
                </div>
                <div className="mt-1 font-mono text-[10.5px] text-[#697083]">{pct}% complete</div>
              </div>
            )}
            {onDismissNanoInstall && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onDismissNanoInstall();
                  }}
                  className="rounded-md border border-[#E5E7EC] bg-white px-2.5 py-1 text-[11px] font-medium text-[#3A3F4D] hover:bg-[#F3F4F7]"
                >
                  Use Cloud AI instead
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. Compatible desktop Chrome where Gemini Nano is ready to download
  if (nanoCapability.canDownloadOnDevice && chromeNanoStatus === 'downloadable') {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full border border-[#0E1015] bg-[#0E1015] px-2.5 py-1 text-[11.5px] font-medium text-white transition hover:bg-[#262A35]"
        >
          <Download className="h-3 w-3" />
          <span>Enable on-device AI</span>
        </button>

        {open && (
          <div className="fixed inset-x-4 top-28 z-40 rounded-xl border border-[#E5E7EC] bg-white p-4 shadow-xl lg:absolute lg:inset-x-auto lg:right-0 lg:top-auto lg:mt-1.5 lg:w-80">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Cpu className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[13px] font-semibold text-[#0E1015]">
                    Enable on-device AI
                  </div>
                  <div className="text-[11px] text-[#697083]">Gemini Nano · local in Chrome</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-0.5 text-[#697083] hover:bg-[#F3F4F7]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="mt-2.5 text-[12px] leading-relaxed text-[#4A5061]">
              Download Chrome&apos;s built-in Gemini Nano model to run summaries, document Q&amp;A,
              and air-gapped offline audits directly on this computer.
            </p>

            <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-[#F7F8FA] p-2.5 text-[11px] text-[#4A5061]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
              <span>
                You don&apos;t have to wait — sanitized Cloud AI remains active while the local
                model installs.
              </span>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-[#697083] hover:bg-[#F3F4F7] hover:text-[#0E1015]"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onDownloadNano();
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0E1015] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#262A35]"
              >
                <Download className="h-3.5 w-3.5" />
                Download &amp; enable
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. Mobile (Android / iOS) and desktop browsers without local Nano: subtle Cloud AI indicator
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-[#E5E7EC] bg-[#F7F8FA] px-2.5 py-1 text-[11.5px] font-medium text-[#3A3F4D] transition hover:border-[#CDD2DB] hover:bg-[#EEF0F4]"
        title="Cloud AI active — on-device AI is currently unavailable in this browser."
      >
        <Cloud className="h-3.5 w-3.5 text-indigo-600" />
        <span>Cloud AI active</span>
      </button>

      {open && (
        <div className="fixed inset-x-4 top-28 z-40 rounded-xl border border-[#E5E7EC] bg-white p-3.5 shadow-xl lg:absolute lg:inset-x-auto lg:right-0 lg:top-auto lg:mt-1.5 lg:w-72">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#0E1015]">
              <Cloud className="h-3.5 w-3.5 text-indigo-600" />
              <span>Cloud AI active</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded p-0.5 text-[#697083] hover:bg-[#F3F4F7]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#4A5061]">
            On-device AI is currently unavailable in this browser. Your personal data is still
            redacted locally on this device before any tokenized text is sent to Cloud AI.
          </p>
        </div>
      )}
    </div>
  );
}
