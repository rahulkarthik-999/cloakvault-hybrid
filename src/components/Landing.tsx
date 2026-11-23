import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  Cloud,
  Cpu,
  Database,
  FileLock2,
  Fingerprint,
  Github,
  Globe,
  HeartPulse,
  KeyRound,
  Landmark,
  Lock,
  PanelRight,
  Play,
  Plane,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { BrandMark, Wordmark } from './BrandMark';

const REPO_URL = 'https://github.com/rahulkarthik-999/cloakvault-hybrid';
const DEMO_URL = import.meta.env.VITE_DEMO_VIDEO_URL as string | undefined;

function go(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

/* ─────────────────────────── Hero visual ─────────────────────────── */

const LENS_SEGMENTS: Array<{ text: string; token?: string; kind?: 'person' | 'org' | 'acct' | 'id' }> = [
  { text: 'Between ' },
  { text: 'Apex Meridian Holdings LLC', token: '[ORG_1]', kind: 'org' },
  { text: ', represented by ' },
  { text: 'Marcus Vance', token: '[PERSON_1]', kind: 'person' },
  { text: ', and ' },
  { text: 'Priya Sharma', token: '[PERSON_2]', kind: 'person' },
  { text: ' (PAN ' },
  { text: 'ABCPS4921K', token: '[GOV_ID_1]', kind: 'id' },
  { text: '). Fees are wired to account ' },
  { text: '50100482917364', token: '[ACCOUNT_1]', kind: 'acct' },
  { text: ' Net-90, with NO CAP on Contractor liability.' },
];

function HeroLens() {
  const [redacted, setRedacted] = useState(false);
  const [route, setRoute] = useState(0);

  useEffect(() => {
    const a = window.setInterval(() => setRedacted((r) => !r), 2600);
    const b = window.setInterval(() => setRoute((r) => (r + 1) % 3), 1800);
    return () => {
      window.clearInterval(a);
      window.clearInterval(b);
    };
  }, []);

  const routes = [
    { task: 'PII discovery', mode: 'ONLY_ON_DEVICE', lane: 'device' as const },
    { task: 'Streaming Q&A', mode: 'PREFER_ON_DEVICE', lane: 'device' as const },
    { task: 'Deep risk audit', mode: 'PREFER_IN_CLOUD', lane: 'cloud' as const },
  ];

  return (
    <div className="relative">
      <div className="glow-device pointer-events-none absolute -left-16 -top-10 h-72 w-72" />
      <div className="glow-cloud pointer-events-none absolute -bottom-12 -right-10 h-80 w-80" />

      <div className="relative overflow-hidden rounded-2xl border border-[#E5E7EC] bg-white shadow-[0_30px_80px_-30px_rgba(14,16,21,0.35)]">
        <div className="flex items-center justify-between border-b border-[#E5E7EC] bg-[#FAFBFC] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EC]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EC]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EC]" />
          </div>
          <div className="flex rounded-full border border-[#E5E7EC] bg-white p-0.5 font-mono text-[10.5px]">
            <span
              className={`rounded-full px-2.5 py-0.5 transition ${
                !redacted ? 'bg-[#0E1015] text-white' : 'text-[#697083]'
              }`}
            >
              Original · local
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 transition ${
                redacted ? 'bg-emerald-600 text-white' : 'text-[#697083]'
              }`}
            >
              Cloud payload
            </span>
          </div>
        </div>

        <div className="px-6 pb-5 pt-6">
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#697083]">
            Master Services Agreement · §1 Parties &amp; Fees
          </div>
          <p className="font-serif text-[17px] leading-[1.75] text-[#1E2129]">
            {LENS_SEGMENTS.map((seg, i) =>
              seg.token ? (
                redacted ? (
                  <span
                    key={`t${i}`}
                    className="inline-flex animate-fade-up items-center gap-1 rounded-md bg-[#0E1015] px-1.5 py-[1px] align-[1px] font-mono text-[11.5px] text-emerald-300 [animation-duration:0.45s]"
                  >
                    <Lock className="h-2.5 w-2.5" />
                    {seg.token}
                  </span>
                ) : (
                  <span key={`r${i}`} className="animate-fade-up rounded bg-amber-100 px-0.5 [animation-duration:0.45s]">
                    {seg.text}
                  </span>
                )
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </p>
        </div>

        <div className="border-t border-[#E5E7EC] bg-[#FAFBFC] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#697083]">
              Firebase AI Logic · hybrid router
            </span>
            <span className="font-mono text-[10.5px] text-emerald-700">0 B raw PII outbound</span>
          </div>
          <div className="space-y-1.5">
            {routes.map((r, i) => {
              const active = i === route;
              const device = r.lane === 'device';
              return (
                <div
                  key={r.task}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-300 ${
                    active
                      ? device
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-indigo-200 bg-indigo-50'
                      : 'border-transparent'
                  }`}
                >
                  <span className="shrink-0 text-[12.5px] font-medium text-[#1E2129] sm:w-28">{r.task}</span>
                  <svg viewBox="0 0 120 8" className="hidden h-2 flex-1 sm:block" preserveAspectRatio="none">
                    <line
                      x1="0"
                      y1="4"
                      x2="120"
                      y2="4"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      className={`${active ? 'animate-flow' : ''} ${
                        device ? 'stroke-emerald-500' : 'stroke-indigo-500'
                      }`}
                      opacity={active ? 1 : 0.25}
                    />
                  </svg>
                  <span
                    className={`ml-auto flex shrink-0 items-center justify-end gap-1.5 font-mono text-[10.5px] sm:w-36 ${
                      device ? 'text-emerald-700' : 'text-indigo-700'
                    }`}
                  >
                    {device ? <Cpu className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                    {r.mode}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute -bottom-9 right-6 hidden items-center gap-3 rounded-xl border border-[#E5E7EC] bg-white px-4 py-3 shadow-lg md:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <Fingerprint className="h-4.5 w-4.5" />
        </span>
        <div>
          <div className="text-[12px] font-semibold text-[#0E1015]">SHA-256 zero-leak receipt</div>
          <div className="font-mono text-[10.5px] text-[#697083]">9f2c…a71e · verified in-browser</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

const STACK = [
  { icon: Sparkles, label: 'Firebase AI Logic' },
  { icon: Cpu, label: 'Gemini Nano (on-device)' },
  { icon: Cloud, label: 'Gemini 3.5 Flash-Lite' },
  { icon: ShieldCheck, label: 'App Check' },
  { icon: SlidersHorizontal, label: 'Remote Config' },
  { icon: Database, label: 'Cloud Firestore' },
  { icon: UserRound, label: 'Authentication' },
  { icon: Globe, label: 'Hosting' },
];

const AUDIENCES = [
  {
    icon: Briefcase,
    who: 'Freelancers & founders',
    doc: 'NDAs, MSAs, SOWs',
    pain: 'Uncapped indemnity, 120-day auto-renewal traps and IP grabs hide in contracts they can’t afford a lawyer to read.',
  },
  {
    icon: HeartPulse,
    who: 'Patients & caregivers',
    doc: 'Itemized hospital bills, EOBs',
    pain: 'Upcoded ER visits and duplicate lab panels are easy to dispute — if you can share the bill without exposing a medical record.',
  },
  {
    icon: Landmark,
    who: 'Small finance teams',
    doc: 'Bank statements, ledgers',
    pain: 'Duplicate SaaS charges and hidden wire fees surface fast — but statements carry account numbers that must never leave the laptop.',
  },
];

const STAGES = [
  {
    n: '01',
    icon: ScanSearch,
    title: 'Shield on-device',
    mode: 'ONLY_ON_DEVICE',
    lane: 'device' as const,
    body: 'PDF, DOCX and TXT are parsed in the browser. Deterministic detectors plus Gemini Nano NER swap names, IDs, accounts and addresses for reversible tokens like [PERSON_1]. Select any text to redact it by hand.',
  },
  {
    n: '02',
    icon: Cpu,
    title: 'Triage & chat locally',
    mode: 'PREFER_ON_DEVICE',
    lane: 'device' as const,
    body: 'Quick summaries and streaming Q&A run on Gemini Nano at zero cost — even in air-gap mode. When Nano isn’t on the device, Firebase AI Logic falls back to cloud Gemini automatically.',
  },
  {
    n: '03',
    icon: Cloud,
    title: 'Escalate only tokens',
    mode: 'PREFER_IN_CLOUD',
    lane: 'cloud' as const,
    body: 'Deep clause-by-clause audits send only the verified, tokenized payload to cloud Gemini. Findings come back with redlines and are re-hydrated locally — the cloud never sees a real name.',
  },
];

const ROUTING = [
  ['Contextual PII discovery', 'ONLY_ON_DEVICE', 'Raw text must never leave the device — no cloud fallback by design.'],
  ['Triage summary', 'PREFER_ON_DEVICE', 'Fast, free and private; cloud only if Nano is missing.'],
  ['Streaming document Q&A', 'PREFER_ON_DEVICE', 'Token-by-token answers with real TTFT and inferenceSource telemetry.'],
  ['Deep risk audit + redlines', 'PREFER_IN_CLOUD', 'Needs frontier reasoning over 12k chars; falls back to Nano offline.'],
  ['Policy per task', 'Remote Config', 'Modes, model name and strict-shield flag change live without a deploy.'],
];

const FAQ = [
  {
    q: 'Do I need an account?',
    a: 'No. Open the workbench and start — documents live in your browser’s IndexedDB. Firebase Anonymous Auth is used silently only if you choose to sync a redacted vault to Firestore; Google sign-in is optional.',
  },
  {
    q: 'What if my browser doesn’t have Gemini Nano?',
    a: 'Redaction still runs 100% locally with deterministic detectors. AI prompts are routed by Firebase AI Logic to cloud Gemini — and only the tokenized text is ever sent. On Chrome with built-in AI, one click downloads Nano.',
  },
  {
    q: 'How can I verify nothing leaked?',
    a: 'Open the “Outbound Cloud Payload” tab: it shows the exact bytes sent, plus SHA-256 hashes of the original and redacted text computed with Web Crypto. Export the JSON receipt for your records.',
  },
  {
    q: 'Is it open source?',
    a: 'Yes — Apache-2.0. The full source, including the Chrome side-panel extension and Firestore rules, is on GitHub.',
  },
];


const TRUST = [
  { icon: Lock, title: '0 bytes of raw PII to the cloud', proof: 'Tokenized before any cloud call', href: 'src/lib/piiEngine.ts' },
  { icon: Fingerprint, title: 'SHA-256 verifiable', proof: 'Web Crypto receipt per audit', href: 'src/lib/cryptoProof.ts' },
  { icon: ShieldCheck, title: 'App Check protected', proof: 'reCAPTCHA Enterprise on every AI call', href: 'src/lib/firebaseClient.ts' },
  { icon: Database, title: 'Server-enforced rules', proof: 'Firestore rejects non-zero-leak writes', href: 'firestore.rules' },
  { icon: WifiOff, title: 'Works air-gapped', proof: 'On-device only, refuses rather than leaks', href: 'src/lib/hybridAiService.ts' },
  { icon: UserRound, title: 'No account required', proof: 'Docs stay in your browser’s IndexedDB', href: 'src/lib/localVaultStore.ts' },
  { icon: Github, title: 'Open source · Apache-2.0', proof: 'Every claim here is auditable', href: 'LICENSE' },
  { icon: BadgeCheck, title: 'Tested redaction core', proof: 'Vitest suite for redact & re-hydrate', href: 'src/lib/piiEngine.test.ts' },
];

function TrustBadges() {
  return (
    <section aria-label="Trust and verification" className="mx-auto max-w-6xl px-5 pt-16">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-700">Trust, verified</div>
          <h2 className="mt-2 font-display text-[32px] leading-tight">Every promise links to the code that keeps it.</h2>
        </div>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] font-medium text-[#4A5061] hover:text-[#0E1015]">
          Audit the repo <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {TRUST.map(({ icon: Icon, title, proof, href }) => (
          <a
            key={title}
            href={`${REPO_URL}/blob/main/${href}`}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start gap-3 rounded-2xl border border-[#E5E7EC] bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_16px_32px_-20px_rgba(5,150,105,0.45)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold leading-snug text-[#0E1015]">{title}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-[#697083]">{proof}</span>
              <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10.5px] text-emerald-700 opacity-70 transition group-hover:opacity-100">
                verify <ArrowUpRight className="h-3 w-3" />
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const openApp = () => go('/app');

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#0E1015]">
      {/* Nav */}
      <header
        className={`sticky top-0 z-50 transition ${
          scrolled ? 'border-b border-[#E5E7EC] bg-white/85 backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="/" aria-label="CloakVault home">
            <Wordmark size={30} />
          </a>
          <div className="hidden items-center gap-7 text-[13.5px] text-[#4A5061] md:flex">
            <a href="#demo" className="transition hover:text-[#0E1015]">Demo</a>
            <a href="#how" className="transition hover:text-[#0E1015]">How it works</a>
            <a href="#routing" className="transition hover:text-[#0E1015]">Hybrid routing</a>
            <a href="#proof" className="transition hover:text-[#0E1015]">Proof</a>
            <a href="#faq" className="transition hover:text-[#0E1015]">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden h-9 items-center gap-1.5 rounded-full border border-[#E5E7EC] bg-white px-3.5 text-[13px] font-medium text-[#1E2129] transition hover:border-[#CDD2DB] sm:flex"
            >
              <Github className="h-4 w-4" /> Source
            </a>
            <button
              onClick={openApp}
              className="flex h-9 items-center gap-1.5 rounded-full bg-[#0E1015] px-4 text-[13px] font-medium text-white transition hover:bg-[#262A35]"
            >
              Open workbench <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-fade pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-14 grid-cols-1 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="min-w-0 animate-fade-up">
            <a
              href="https://firebasehybridaihackathon.devpost.com/"
              target="_blank"
              rel="noreferrer"
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E5E7EC] bg-white px-3 py-1 text-[12px] font-medium text-[#4A5061] shadow-sm transition hover:border-[#CDD2DB]"
            >
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Built for #BuildHybridAI 2026 · Firebase AI Logic
              <ArrowUpRight className="h-3 w-3" />
            </a>
            <h1 className="text-balance font-display text-[52px] leading-[1.02] tracking-[-0.01em] sm:text-[68px]">
              Frontier AI for your contracts.{' '}
              <em className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text pr-1 text-transparent">
                Zero
              </em>{' '}
              secrets in the cloud.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[#4A5061]">
              CloakVault redacts personal data on your device, routes every prompt between
              on-device <strong className="font-semibold text-[#0E1015]">Gemini Nano</strong> and
              cloud <strong className="font-semibold text-[#0E1015]">Gemini</strong> with Firebase AI
              Logic, and hands you a SHA-256 receipt proving no raw PII left your browser.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={openApp}
                className="group flex h-12 items-center gap-2 rounded-full bg-[#0E1015] px-6 text-[15px] font-medium text-white shadow-[0_10px_30px_-10px_rgba(14,16,21,0.6)] transition hover:bg-[#262A35]"
              >
                Open the workbench
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
              <a
                href="#demo"
                className="flex h-12 items-center gap-2 rounded-full border border-[#E5E7EC] bg-white px-5 text-[15px] font-medium text-[#1E2129] transition hover:border-[#CDD2DB]"
              >
                <Play className="h-4 w-4 fill-current" /> Watch the demo
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-[#697083]">
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> No sign-up</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Sample contract, ledger &amp; medical bill preloaded</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Open source · Apache-2.0</span>
            </div>
          </div>
          <div className="min-w-0 animate-fade-up [animation-delay:120ms]">
            <HeroLens />
          </div>
        </div>
      </section>

      {/* Demo video */}
      <section id="demo" className="scroll-mt-20 px-5 pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-indigo-700">See it work · under 3 minutes</div>
              <h2 className="mt-2 font-display text-[34px] leading-tight">Redaction, hybrid routing and the wire proof, live.</h2>
            </div>
            {DEMO_URL && (
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[13px] font-medium text-[#4A5061] hover:text-[#0E1015]"
              >
                Watch on YouTube <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EC] bg-[#0E1015] shadow-[0_40px_90px_-40px_rgba(14,16,21,0.55)]">
            <video
              className="block aspect-video w-full"
              controls
              playsInline
              preload="metadata"
              poster="/media/demo-poster.jpg"
            >
              <source src="/media/cloakvault-demo.mp4" type="video/mp4" />
              <track kind="captions" src="/media/cloakvault-demo.en.vtt" srcLang="en" label="English" />
            </video>
          </div>
          <p className="mt-3 text-center text-[12.5px] text-[#697083]">
            Recorded from the real app with live Firebase AI Logic calls. English narration and captions.
          </p>
        </div>
      </section>

      {/* Stack strip */}
      <section className="border-y border-[#E5E7EC] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-6">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#9CA2B0]">Runs on</span>
          {STACK.map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-[13px] font-medium text-[#3A3F4D]">
              <Icon className="h-4 w-4 text-[#697083]" /> {label}
            </span>
          ))}
        </div>
      </section>

      <TrustBadges />

      {/* Problem / audience */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="max-w-2xl">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-700">The privacy tax on AI</div>
          <h2 className="mt-3 text-balance font-display text-[42px] leading-[1.08]">
            The documents that most need a second opinion are the ones you can’t paste into a chatbot.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[#4A5061]">
            Uploading a contract or a hospital bill to a cloud model ships names, government IDs,
            bank accounts and addresses to someone else’s servers. So people skip the review — and
            sign the bad clause or pay the duplicate charge.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {AUDIENCES.map(({ icon: Icon, who, doc, pain }) => (
            <div key={who} className="rounded-2xl border border-[#E5E7EC] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(14,16,21,0.25)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4F7] text-[#0E1015]">
                <Icon className="h-5 w-5" />
              </span>
              <div className="mt-5 text-[16px] font-semibold">{who}</div>
              <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-[#697083]">{doc}</div>
              <p className="mt-3 text-[14px] leading-relaxed text-[#4A5061]">{pain}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 bg-[#0E1015] text-white">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="max-w-2xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-400">How it works</div>
            <h2 className="mt-3 text-balance font-display text-[42px] leading-[1.08]">
              Three stages. One hybrid SDK. A hard boundary raw PII never crosses.
            </h2>
          </div>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {STAGES.map(({ n, icon: Icon, title, mode, lane, body }) => (
              <div key={n} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] text-white/40">{n}</span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] ${
                      lane === 'device' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-indigo-400/15 text-indigo-300'
                    }`}
                  >
                    {lane === 'device' ? <Cpu className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                    {mode}
                  </span>
                </div>
                <span
                  className={`mt-8 flex h-11 w-11 items-center justify-center rounded-xl ${
                    lane === 'device' ? 'bg-emerald-500 text-[#0E1015]' : 'bg-indigo-500 text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-[19px] font-semibold">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/65">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: WifiOff, t: 'Air-gap mode', d: 'Force on-device only and keep working offline.' },
              { icon: PanelRight, t: 'Chrome side panel', d: 'Scan any web page’s Terms locally, then hand off for a deep audit.' },
              { icon: FileLock2, t: 'Exports that are safe to share', d: 'Redacted .txt, redlined audit .md and a JSON zero-leak certificate.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-3 rounded-2xl border border-white/10 p-5">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-white/60" />
                <div>
                  <div className="text-[14.5px] font-medium">{t}</div>
                  <div className="mt-1 text-[13px] text-white/55">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Routing matrix */}
      <section id="routing" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-indigo-700">Hybrid routing</div>
            <h2 className="mt-3 text-balance font-display text-[42px] leading-[1.08]">
              Every task picks the cheapest place it can safely run.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[#4A5061]">
              One <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px] ring-1 ring-[#E5E7EC]">getGenerativeModel()</code>{' '}
              call per task, each with its own <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px] ring-1 ring-[#E5E7EC]">InferenceMode</code>.
              The workbench records the real <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px] ring-1 ring-[#E5E7EC]">inferenceSource</code>,
              latency and time-to-first-token for every call, so you can see exactly where each answer came from.
            </p>
            <div className="mt-6 flex gap-3 text-[12.5px]">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800 ring-1 ring-emerald-200">
                <Cpu className="h-3.5 w-3.5" /> On-device
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-800 ring-1 ring-indigo-200">
                <Cloud className="h-3.5 w-3.5" /> Cloud
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EC] bg-white">
            {ROUTING.map(([task, mode, why], i) => {
              const device = mode.includes('DEVICE');
              const cfg = mode === 'Remote Config';
              return (
                <div key={task} className={`grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-4 ${i ? 'border-t border-[#E5E7EC]' : ''}`}>
                  <div className="text-[14.5px] font-medium">{task}</div>
                  <span
                    className={`row-span-2 self-center rounded-full px-2.5 py-1 font-mono text-[10.5px] ${
                      cfg
                        ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                        : device
                        ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                        : 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200'
                    }`}
                  >
                    {mode}
                  </span>
                  <div className="text-[13px] text-[#697083]">{why}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Proof */}
      <section id="proof" className="scroll-mt-20 border-y border-[#E5E7EC] bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
          <div className="order-2 overflow-hidden rounded-2xl bg-[#0E1015] p-6 font-mono text-[12.5px] leading-relaxed text-white/80 shadow-[0_30px_80px_-40px_rgba(14,16,21,0.6)] lg:order-1">
            <div className="mb-4 flex items-center justify-between text-[11px] text-white/40">
              <span>outbound_payload.json · example</span>
              <span className="text-emerald-400">● zeroLeakVerified</span>
            </div>
            <pre className="whitespace-pre-wrap">
{`{
  "mode": "PREFER_IN_CLOUD",
  "model": "gemini-3.5-flash-lite",
  "payload": "Between `}<span className="text-emerald-300">[ORG_1]</span>{`, represented by `}<span className="text-emerald-300">[PERSON_1]</span>{` … wired to `}<span className="text-emerald-300">[ACCOUNT_1]</span>{` Net-90 …",
  "rawPiiBytesSent": `}<span className="text-emerald-300">0</span>{`,
  "piiBytesKeptLocal": 336,
  "originalSha256": "e3b4…19c2",
  "redactedSha256": "9f2c…a71e",
  "appCheck": "reCAPTCHA Enterprise ✓"
}`}
            </pre>
          </div>
          <div className="order-1 lg:order-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-700">Proof, not promises</div>
            <h2 className="mt-3 text-balance font-display text-[42px] leading-[1.08]">
              Inspect the exact bytes that leave your browser.
            </h2>
            <ul className="mt-6 space-y-4 text-[15px] text-[#4A5061]">
              {[
                [KeyRound, 'The token keymap lives only in memory and IndexedDB — answers are re-hydrated locally.'],
                [Fingerprint, 'Web Crypto SHA-256 hashes of the original and redacted text form a verifiable receipt.'],
                [ShieldCheck, 'Strict PII Shield (a Remote Config flag) blocks escalation if any entity is still exposed.'],
                [Database, 'Firestore rules only accept vaults flagged zeroLeakVerified — raw text can’t be synced.'],
              ].map(([Icon, text], i) => {
                const I = Icon as typeof KeyRound;
                return (
                  <li key={i} className="flex gap-3">
                    <I className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <span>{text as string}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-24">
        <h2 className="text-center font-display text-[42px] leading-[1.08]">Questions</h2>
        <div className="mt-10 divide-y divide-[#E5E7EC] rounded-2xl border border-[#E5E7EC] bg-white">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[15.5px] font-medium">
                {q}
                <span className="ml-4 text-[20px] leading-none text-[#9CA2B0] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[14.5px] leading-relaxed text-[#4A5061]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#0E1015] px-8 py-16 text-center text-white">
          <div className="glow-device pointer-events-none absolute -left-20 -top-20 h-96 w-96" />
          <div className="glow-cloud pointer-events-none absolute -bottom-24 -right-16 h-96 w-96" />
          <div className="relative">
            <BrandMark size={48} className="mx-auto" />
            <h2 className="mx-auto mt-6 max-w-2xl text-balance font-display text-[46px] leading-[1.05]">
              Get the second opinion. Keep the secrets.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[16px] text-white/65">
              Three sample case files are preloaded. Run a hybrid audit in under 15 seconds — no account needed.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={openApp}
                className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-[#0E1015] transition hover:bg-white/90"
              >
                Open the workbench <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center gap-2 rounded-full border border-white/20 px-6 text-[15px] font-medium text-white transition hover:bg-white/5"
              >
                <Github className="h-4 w-4" /> Read the source
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#E5E7EC]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-[13px] text-[#697083] sm:flex-row">
          <Wordmark size={22} />
          <div className="flex items-center gap-1.5">
            <Plane className="h-3.5 w-3.5 -rotate-45" /> Works offline with Gemini Nano · Apache-2.0
          </div>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#0E1015]">
            GitHub <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
