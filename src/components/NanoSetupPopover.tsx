import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Cpu, Download, RefreshCw, X, AlertTriangle, CircleHelp } from 'lucide-react';
import {
  getNanoDeviceReport,
  NANO_MIN_CHROME_VERSION,
  type NanoDeviceReport,
} from '../lib/hybridAiService';
import type { SystemCapabilities } from '../types/vault';

type CheckState = 'pass' | 'fail' | 'unknown';

interface NanoSetupPopoverProps {
  status: SystemCapabilities['chromeNanoStatus'];
  onDownloadNano: () => void;
  onRecheckNano: () => Promise<void>;
}

function CheckRow({ state, label, detail }: { state: CheckState; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2 py-1">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          state === 'pass'
            ? 'bg-emerald-100 text-emerald-700'
            : state === 'fail'
            ? 'bg-rose-100 text-rose-700'
            : 'bg-[#EEF0F4] text-[#697083]'
        }`}
      >
        {state === 'pass' ? (
          <Check className="h-2.5 w-2.5" />
        ) : state === 'fail' ? (
          <X className="h-2.5 w-2.5" />
        ) : (
          <CircleHelp className="h-2.5 w-2.5" />
        )}
      </span>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-[#0E1015]">{label}</div>
        <div className="text-[11px] leading-snug text-[#697083]">{detail}</div>
      </div>
    </li>
  );
}

function CopyLink({ value }: { value: string }) {
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
      className="inline-flex items-center gap-1 rounded border border-[#E5E7EC] bg-[#F3F4F7] px-1.5 py-0.5 font-mono text-[10.5px] text-[#0E1015] hover:bg-[#E8EAEF]"
      title="Copy — Chrome blocks web pages from opening chrome:// links, so paste it into the address bar"
    >
      {value}
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 opacity-60" />}
    </button>
  );
}

export function NanoSetupPopover({ status, onDownloadNano, onRecheckNano }: NanoSetupPopoverProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<NanoDeviceReport | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setReport(getNanoDeviceReport());
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Close automatically once Chrome reports the model as ready or downloadable.
  useEffect(() => {
    if (status === 'available' || status === 'downloading') setOpen(false);
  }, [status]);

  const recheck = async () => {
    setChecking(true);
    try {
      await onRecheckNano();
      setReport(getNanoDeviceReport());
    } finally {
      setChecking(false);
    }
  };

  const r = report;
  const browserState: CheckState = !r ? 'unknown' : r.isGoogleChrome && !r.isMobile ? 'pass' : 'fail';
  const versionState: CheckState =
    !r || r.chromeMajor === null || !r.isGoogleChrome
      ? 'unknown'
      : r.chromeMajor >= NANO_MIN_CHROME_VERSION
      ? 'pass'
      : 'fail';
  const apiState: CheckState = !r ? 'unknown' : r.hasPromptApi ? 'pass' : 'fail';
  const cpuState: CheckState = !r || r.cpuCores === null ? 'unknown' : r.cpuCores >= 4 ? 'pass' : 'fail';

  const headline =
    status === 'downloadable'
      ? 'Gemini Nano is ready to download'
      : status === 'unsupported'
      ? 'This browser doesn’t expose Chrome’s built-in AI'
      : 'Chrome says this device can’t run Gemini Nano yet';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-[#E5E7EC] bg-[#F3F4F7] px-3 py-1 text-[11px] text-[#4A5061] transition hover:border-[#CDD2DB] hover:bg-[#E8EAEF]"
        title="Gemini Nano isn't available in this browser, so Firebase AI Logic routes prompts to Cloud Gemini. Click to set up on-device AI."
      >
        <Cpu className="h-3.5 w-3.5 opacity-60" />
        <span>Nano unavailable · cloud fallback</span>
        <span className="ml-0.5 inline-flex items-center gap-1 rounded-full bg-[#0E1015] px-2 py-0.5 text-[10.5px] font-medium text-white">
          <Download className="h-2.5 w-2.5" />
          Get Nano
        </span>
      </button>

      {open && (
        <div className="fixed inset-x-4 top-28 z-40 rounded-xl border border-[#E5E7EC] bg-white p-3 shadow-xl lg:absolute lg:inset-x-auto lg:left-0 lg:top-auto lg:mt-1.5 lg:w-[22rem]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-semibold text-[#0E1015]">Get Gemini Nano on this device</div>
              <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-amber-800">
                <AlertTriangle className="h-3 w-3" />
                {headline}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-[#697083] hover:bg-[#F3F4F7]"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <ul className="mt-2 border-t border-[#EEF0F4] pt-1.5">
            <CheckRow
              state={browserState}
              label="Google Chrome on desktop"
              detail="Windows 10/11, macOS 13+, Linux or Chromebook Plus. Edge, Brave and mobile browsers don’t ship Gemini Nano."
            />
            <CheckRow
              state={versionState}
              label={`Chrome ${NANO_MIN_CHROME_VERSION} or newer`}
              detail={
                r?.chromeMajor && r.isGoogleChrome
                  ? `You’re on Chrome ${r.chromeMajor}.`
                  : 'Update Chrome to the latest version.'
              }
            />
            <CheckRow
              state={apiState}
              label="Prompt API (LanguageModel) exposed"
              detail={
                r?.hasPromptApi
                  ? 'Built-in AI is switched on in this browser.'
                  : 'Not found — usually fixed by updating Chrome.'
              }
            />
            <CheckRow
              state={cpuState}
              label="GPU with >4 GB VRAM, or 16 GB RAM + 4 cores"
              detail={
                r?.cpuCores
                  ? `${r.cpuCores} CPU threads detected${
                      r.deviceMemoryGb ? `, ≥${r.deviceMemoryGb} GB RAM reported` : ''
                    }. Chrome makes the final call.`
                  : 'Chrome checks this itself when you download.'
              }
            />
            <CheckRow
              state="unknown"
              label="22 GB free disk + unmetered network"
              detail="Needed once for the download; Chrome removes the model if free space drops under 10 GB."
            />
          </ul>

          <ol className="mt-2 space-y-1.5 border-t border-[#EEF0F4] pt-2 text-[11.5px] text-[#3A3F4D]">
            <li>
              <span className="font-medium">1.</span> Update Chrome: <CopyLink value="chrome://settings/help" />
            </li>
            <li>
              <span className="font-medium">2.</span> Check model status: <CopyLink value="chrome://on-device-internals" />
            </li>
            <li>
              <span className="font-medium">3.</span> Come back here and click <em>Check again</em>.
            </li>
          </ol>

          <p className="mt-2 rounded-md bg-[#F7F8FA] px-2 py-1.5 text-[10.5px] leading-snug text-[#697083]">
            Chrome downloads its newest Gemini Nano release and keeps it updated in the background — web
            pages can’t pin a model version. Until it’s on this device, redaction still runs fully locally and
            AI prompts use tokenized text only.
          </p>

          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => void recheck()}
              disabled={checking}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#E5E7EC] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#0E1015] hover:bg-[#F3F4F7] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              Check again
            </button>
            <button
              type="button"
              onClick={onDownloadNano}
              disabled={status !== 'downloadable'}
              title={
                status === 'downloadable'
                  ? 'Download Gemini Nano through Chrome'
                  : 'Available once Chrome reports this device as supported'
              }
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#0E1015] bg-[#0E1015] px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#262A35] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              Download Nano
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
