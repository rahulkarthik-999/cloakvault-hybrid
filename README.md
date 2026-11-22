# CloakVault — Zero-Leak Hybrid AI Document Intelligence

> **Built for `#BuildHybridAI 2026`** · Live Demo: **https://cloakvault-hybrid.web.app** · Powered by **Firebase AI Logic** (On-Device Gemini Nano + Cloud `gemini-3.5-flash-lite` Fallback), **App Check (reCAPTCHA Enterprise)**, **Remote Config**, **Firestore**, **Authentication**, **Hosting**, and a **Chrome Side Panel Extension**.

## Why Hybrid AI Is Essential Here

Freelancers, founders, patients, and teams want frontier AI audits on NDAs, SaaS vendor contracts, bank statements, and itemized medical bills—but uploading raw documents exposes sensitive PII (names, PAN/SSN, account numbers, API keys, addresses, phone numbers) to external cloud servers.

**CloakVault** solves this with a 3-stage, zero-mock hybrid pipeline powered by **`firebase/ai`**:

1. **Stage 1 — Strictly On-Device PII Shield (`InferenceMode.ONLY_ON_DEVICE`):**
   - 100% browser-side `.pdf` (`pdfjs-dist`), `.docx` (`mammoth`), `.txt`, `.md`, and `.csv` parsing + deterministic entity scanning + mouse **Select-to-Redact** + **Chrome Built-in Gemini Nano** contextual NER.
   - Replaces every sensitive entity with reversible local tokens (`[PERSON_1]`, `[ORG_1]`, `[ACCOUNT_1]`, `[GOV_ID_1]`).
   - Raw documents and the local keymap stay exclusively in browser IndexedDB/memory—**0 bytes of raw PII ever leave the device**.
2. **Stage 2 — Instant On-Device Triage & Streaming Chat (`InferenceMode.PREFER_ON_DEVICE`):**
   - Quick triage summaries and interactive token-by-token streaming Q&A run locally at zero cloud cost and keep working even in **Air-Gap / Offline Mode**, falling back automatically to Cloud Gemini (`gemini-3.5-flash-lite`, remotely switchable via Firebase Remote Config) only when Nano is unavailable.
3. **Stage 3 — Sanitized Cloud Escalation & Local Re-Hydration (`InferenceMode.PREFER_IN_CLOUD`):**
   - Deep adversarial risk audits (0–100 risk score, predatory clause detection, clickable **Locate ↗** clause jump, strikethrough/proposed inline redlines, duplicate billing analysis) send **only the verified zero-PII tokenized payload** to Gemini Cloud via Firebase AI Logic (falling back to On-Device Gemini Nano automatically if offline).
   - Responses are **re-hydrated locally** in the browser, with a live **X-Ray Toggle** (*Re-Hydrated* vs. *Cloud Tokens*), an **Outbound Cloud Payload** inspector with live Web Crypto **`SHA-256`** hashes, and exportable Redacted `.txt`, Redlined Audit `.md`, and JSON Zero-Leak Compliance Certificates.

## Firebase Products Used

| Firebase Product | Runtime Role in CloakVault | Code Location |
|---|---|---|
| **Firebase AI Logic (`firebase/ai`)** | `getAI(..., { backend: new GoogleAIBackend() })`, `getGenerativeModel(..., { mode: InferenceMode.* })`, streaming `generateContentStream`, real `response.inferenceSource` telemetry | `src/lib/firebaseClient.ts`, `src/lib/hybridAiService.ts` |
| **Firebase App Check** | `initializeAppCheck` with `ReCaptchaEnterpriseProvider` (Google Cloud Fraud Defense) + local-dev-only debug token mode | `src/lib/firebaseClient.ts` |
| **Firebase Remote Config** | Live policy control (`default_qa_inference_mode`, `deep_audit_inference_mode`, `cloud_model_name`, `strict_pii_shield`, `max_local_context_chars`) | `src/lib/firebaseClient.ts` |
| **Cloud Firestore** | Persists **only** zero-PII redacted vaults & aggregate telemetry under `users/{uid}/vaults` (verified by `zeroLeakVerified` guard + `firestore.rules`) | `src/lib/firestoreVault.ts`, `firestore.rules` |
| **Firebase Authentication** | 1-click Anonymous Guest Mode + Google Sign-In | `src/lib/firebaseClient.ts`, `src/components/FirebaseConfigModal.tsx` |
| **Firebase Hosting** | Static production hosting at `https://cloakvault-hybrid.web.app` | `firebase.json` |

## Quick Start

```bash
npm install
cp .env.example .env.local
# Add your Firebase Web App credentials to .env.local (or paste them in the app's "Connect Firebase" modal)
npm run dev
```

### Enabling Chrome Built-in Gemini Nano (On-Device)
1. Open CloakVault in Chrome desktop (Chrome 138+ with Prompt API support).
2. Click **"Enable Gemini Nano"** in the top telemetry bar to download the local model directly in Chrome.
3. Toggle **"Air-Gap Mode ON"** (or turn off Wi-Fi) to test 100% offline local inference and automatic hybrid fallback.

### Loading the Companion Chrome Extension (`chrome-extension/`)
1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Click **Load unpacked** and select the `chrome-extension/` folder.
3. Open any contract, invoice, or Terms of Service webpage, click the **CloakVault** extension icon to open the Side Panel, scan & redact locally with Gemini Nano, and click **"Send to CloakVault Web App"** for a full Hybrid Cloud Deep Audit.

## Testing & Production Build

```bash
npm test          # Vitest unit tests (zero-leak PII redaction & re-hydration verification)
npm run typecheck # Strict TypeScript verification
npm run build     # Production Vite bundle
```

## License

Licensed under the Apache License, Version 2.0. See `LICENSE` for details.
