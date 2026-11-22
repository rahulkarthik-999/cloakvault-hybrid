const nanoBadge = document.getElementById('nano-badge');
const statusText = document.getElementById('status-text');
const piiSummary = document.getElementById('pii-summary');
const outputPreview = document.getElementById('output-preview');
const scanBtn = document.getElementById('scan-btn');
const openAppBtn = document.getElementById('open-app-btn');
const appUrlInput = document.getElementById('app-url');

let lastCapturedText = '';
let lastCapturedTitle = '';

const EXPECTED_OUTPUTS = [{ type: 'text', languages: ['en'] }];

async function initNanoBadge() {
  if (typeof LanguageModel === 'undefined') {
    nanoBadge.textContent = 'Regex Shield Only';
    return;
  }
  try {
    const avail = await LanguageModel.availability({ expectedOutputs: EXPECTED_OUTPUTS });
    nanoBadge.textContent = `Gemini Nano: ${avail}`;
  } catch {
    nanoBadge.textContent = 'Nano Unavailable';
  }
}

function quickLocalRedact(text) {
  let count = 0;
  const rules = [
    { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, tag: '[EMAIL]' },
    { re: /\b\d{3}-\d{2}-\d{4}\b/g, tag: '[GOV_ID]' },
    { re: /\b[A-Z]{5}\d{4}[A-Z]\b/g, tag: '[GOV_ID]' },
    { re: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g, tag: '[ACCOUNT]' },
    { re: /(?:\+\d{1,3}[-\s]?)?(?:\(\d{3}\)|\d{3,5})[-\s]\d{3,5}[-\s]\d{4,5}\b/g, tag: '[PHONE]' },
  ];
  let redacted = text;
  for (const r of rules) {
    redacted = redacted.replace(r.re, () => {
      count += 1;
      return r.tag;
    });
  }
  return { redacted, count };
}

scanBtn.addEventListener('click', async () => {
  statusText.textContent = 'Extracting visible text from active tab…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab available.');

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title || 'Webpage Document',
        text: (window.getSelection()?.toString().trim() || document.body.innerText || '').slice(
          0,
          9000
        ),
      }),
    });

    lastCapturedTitle = result.title;
    lastCapturedText = result.text;
    openAppBtn.disabled = !lastCapturedText;

    const { redacted, count } = quickLocalRedact(lastCapturedText);
    piiSummary.textContent = `Locally shielded ${count} PII items · 0 bytes sent to cloud.`;

    if (typeof LanguageModel !== 'undefined') {
      const avail = await LanguageModel.availability({ expectedOutputs: EXPECTED_OUTPUTS });
      if (avail === 'available') {
        statusText.textContent = 'Running On-Device Gemini Nano instant risk scan…';
        const session = await LanguageModel.create({
          expectedOutputs: EXPECTED_OUTPUTS,
          systemPrompt:
            'You are a local privacy-first contract & billing risk scanner. Give 3 concise bullet points of top red flags.',
        });
        const summary = await session.prompt(
          `Summarize any risky clauses, hidden fees, or auto-renewal traps in this redacted text:\n\n${redacted.slice(
            0,
            4000
          )}`
        );
        session.destroy?.();
        outputPreview.textContent = `ON-DEVICE GEMINI NANO SCAN:\n\n${summary}\n\n--- REDACTED PREVIEW ---\n${redacted.slice(
          0,
          1200
        )}`;
        statusText.textContent = 'Completed 100% on-device with Chrome Gemini Nano.';
        return;
      }
    }

    outputPreview.textContent = redacted.slice(0, 2000);
    statusText.textContent = 'Captured & locally redacted. Open in CloakVault for Hybrid Cloud Audit.';
  } catch (err) {
    statusText.textContent = `Error: ${err.message || err}`;
  }
});

openAppBtn.addEventListener('click', () => {
  if (!lastCapturedText) return;
  const base = (appUrlInput.value || 'https://cloakvault-hybrid.web.app').replace(/\/$/, '');
  const url = `${base}/?title=${encodeURIComponent(lastCapturedTitle)}&clip=${encodeURIComponent(
    lastCapturedText.slice(0, 6000)
  )}`;
  chrome.tabs.create({ url });
});

initNanoBadge();
