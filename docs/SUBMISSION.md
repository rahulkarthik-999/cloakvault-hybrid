# Devpost submission kit — CloakVault (#BuildHybridAI 2026)

## Form fields

| Field | Value |
|---|---|
| Project name | CloakVault — Zero-Leak Hybrid AI Document Workbench |
| Elevator pitch (≤200 chars) | Ask frontier AI about your contracts, bank statements and hospital bills — PII is redacted on-device, Gemini Nano and cloud Gemini are routed by Firebase AI Logic, and zero raw PII leaves the browser. |
| Platform | Web (Chrome) |
| Try it out | https://cloakvault.buzz/ · https://github.com/rahulkarthik-999/cloakvault-hybrid |
| Demo video | _YouTube URL of `marketing/out/cloakvault_demo.mp4`_ |
| Image gallery (in order) | `docs/media/01-hero.jpg` … `07-use-cases.jpg` |

**Built with:** firebase, firebase-ai-logic, gemini, gemini-nano, chrome-built-in-ai, firebase-app-check, recaptcha-enterprise, firebase-remote-config, cloud-firestore, firebase-authentication, firebase-hosting, chrome-extension, react, typescript, vite, tailwindcss, pdf.js, web-crypto

---

## About the project (paste into "Project Story")

## Inspiration

The documents that most need a second opinion are exactly the ones you shouldn't paste into a chatbot. A freelancer's MSA, a family's itemized hospital bill and a startup's bank statement are full of names, tax IDs, account numbers and home addresses. So people skip the review. They sign the uncapped-indemnity clause, pay the duplicate lab panel, and miss the double-billed SaaS seat.

On-device models are private but small. Cloud models are smart but see everything. Hybrid inference lets us have both, as long as we're strict about **what** crosses the boundary.

## What it does

CloakVault is a confidential document workbench with a hard boundary that raw PII never crosses:

1. **Shield on-device (`ONLY_ON_DEVICE`).** PDF, DOCX and TXT files are parsed in the browser. Deterministic detectors plus Gemini Nano NER replace every name, organization, address, email, phone number, tax ID, bank account and secret with a reversible local token such as `[PERSON_1]`. Users can highlight any text to redact it too.
2. **Triage and chat locally (`PREFER_ON_DEVICE`).** Summaries and streaming Q&A run on Gemini Nano, which is free, private and works offline. When Nano isn't on the device, Firebase AI Logic falls back to cloud Gemini automatically, and only tokens are sent.
3. **Escalate only tokens (`PREFER_IN_CLOUD`).** A deep audit sends the verified, tokenized document to Gemini. It returns a 0–100 risk score, severity-ranked findings with exact clause quotes (click **Locate ↗** to jump to each one), missing protections and ready-to-send redlines. Real names are re-hydrated locally.
4. **Prove it.** The Outbound Cloud Payload view shows the exact bytes that were sent, with Web Crypto SHA-256 hashes of the original and redacted text. You can export a JSON zero-leak certificate, a redacted `.txt` or a redlined audit `.md`.

It also includes an **air-gap mode** that locks every task to on-device and refuses rather than leaks, live **telemetry** of the real `inferenceSource`, latency and time-to-first-token for every call, and a **Chrome side-panel extension** that scans any web page's terms locally and hands them to the workbench.

## How we built it (how we use Firebase AI Logic)

- **Firebase AI Logic hybrid inference** (`firebase/ai`): `getAI(app, { backend: new GoogleAIBackend() })` plus one `getGenerativeModel()` per task, each with its own `InferenceMode`, `inCloudParams` (Gemini 4 Hydrogen with system instructions, JSON mode and thinking level) and `onDeviceParams`. Chat uses `generateContentStream`. Every response's `inferenceSource` is shown in the UI and logged.
- **App Check** with reCAPTCHA Enterprise protects every cloud inference. Debug tokens are only used in local development.
- **Remote Config** sets live policy: per-task inference modes, cloud model name, a strict PII shield that blocks escalation if any entity is still exposed, and the maximum local context size.
- **Cloud Firestore** stores only redacted vaults and telemetry. Security rules **require `zeroLeakVerified == true` and an allowlisted field set**, so raw text can't be synced even by a modified client.
- **Authentication**: an invisible anonymous guest for sync and optional Google sign-in. There's no sign-up wall.
- **Hosting** for the web app. React 19, TypeScript, Vite and Tailwind 4, with `pdfjs-dist` and `mammoth` for local parsing.

## Challenges we ran into

- **Small models and strict JSON.** Gemini Nano sometimes returns prose. We parse fenced or loose JSON defensively and degrade gracefully instead of failing.
- **Keeping placeholders intact across the boundary.** Prompts require verbatim `[TOKEN_N]` preservation, and clause quotes must be exact substrings so the UI can locate them after re-hydration.
- **Making the boundary verifiable, not just claimed.** That's why we added SHA-256 receipts, the outbound payload inspector, the strict shield, and server-side Firestore rules.

## Accomplishments we're proud of

- A real three-stage hybrid pipeline in which every task picks the cheapest safe place to run.
- Zero raw PII in any cloud payload, provable by the user in two clicks.
- A finished product rather than a demo: a landing page, a no-sign-up workbench, three realistic case files, exports, an extension, and an offline mode.

## What we learned

Hybrid inference is a privacy architecture, not just a cost optimization. Choosing `ONLY_ON_DEVICE` vs `PREFER_ON_DEVICE` vs `PREFER_IN_CLOUD` per task, and showing users where each answer actually ran, builds trust.

## What's next

- Android with Gemini Nano through the same Firebase AI Logic hybrid SDK, so you can scan a paper bill with the camera and redact on the phone.
- Dispute-letter and negotiation-email generation that stays token-safe.
- Team vaults with shared, redacted-only workspaces.

---

## Submission checklist

- [x] Uses Firebase AI Logic hybrid inference at runtime (`src/lib/hybridAiService.ts`)
- [x] App Check enabled (reCAPTCHA Enterprise)
- [x] Public GitHub repo with an Apache-2.0 license, detected in the repo's About section
- [x] Hosted app: https://cloakvault.buzz
- [x] Demo video ≤ 3:00 in English with English subtitles (`marketing/out/`)
- [ ] Upload the video to YouTube (public or unlisted), add `cloakvault_demo.en.srt` as English subtitles, and set `youtube_thumbnail.jpg` as the thumbnail
- [ ] Paste the YouTube link into Devpost and set `VITE_DEMO_VIDEO_URL` in `.env.local`, then redeploy (this adds a "Watch the demo" button to the landing page)
- [ ] Upload the 7 gallery images from `docs/media/`
