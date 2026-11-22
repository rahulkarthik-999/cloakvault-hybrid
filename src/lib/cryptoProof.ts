import { applyRedaction, rehydrateText } from './piiEngine';
import type { VaultDocument } from '../types/vault';

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'document'
  );
}

export function exportRedactedDocument(vault: VaultDocument): void {
  const { redactedText } = applyRedaction(vault.rawText, vault.entities);
  triggerFileDownload(
    `${slugify(vault.title)}-redacted.txt`,
    redactedText,
    'text/plain;charset=utf-8'
  );
}

export function exportAuditMarkdown(vault: VaultDocument, rehydrate: boolean): void {
  const report = vault.auditReport;
  if (!report) return;

  const fmt = (txt: string) => (rehydrate ? rehydrateText(txt, vault.entities) : txt);
  const lines: string[] = [
    `# CloakVault Risk Audit — ${vault.title}`,
    '',
    `- **Risk Score:** ${report.riskScore} / 100 (${report.riskVerdict.replace('_', ' ')})`,
    `- **Inference Source:** ${report.inferenceSource} (${report.modelLabel}) · ${report.latencyMs}ms`,
    `- **PII Protected Locally:** ${report.piiBytesProtected} bytes (0 bytes transmitted)`,
    `- **Original SHA-256:** \`${report.originalSha256}\``,
    `- **Redacted Payload SHA-256:** \`${report.redactedSha256}\``,
    '',
    '## Executive Summary',
    '',
    fmt(report.executiveSummary),
    '',
    '## Findings & Counter-Proposals',
    '',
  ];

  for (const f of report.findings) {
    lines.push(`### [${f.severity}] ${fmt(f.title)}`);
    if (f.clauseQuote) {
      lines.push(`> ${fmt(f.clauseQuote)}`);
      lines.push('');
    }
    lines.push(fmt(f.explanation));
    lines.push('');
    lines.push(`**Recommended Action:** ${fmt(f.recommendedAction)}`);
    if (f.suggestedRedline) {
      lines.push('');
      lines.push('**Proposed Redline:**');
      lines.push('```text');
      lines.push(fmt(f.suggestedRedline));
      lines.push('```');
    }
    lines.push('');
  }

  if (report.missingProtections.length > 0) {
    lines.push('## Missing Safeguards');
    lines.push('');
    for (const mp of report.missingProtections) {
      lines.push(`- ${mp}`);
    }
  }

  triggerFileDownload(
    `${slugify(vault.title)}-audit-${rehydrate ? 'rehydrated' : 'sanitized'}.md`,
    lines.join('\n'),
    'text/markdown;charset=utf-8'
  );
}

export async function exportZeroLeakCertificate(vault: VaultDocument): Promise<void> {
  const { redactedText, shieldedBytes, activeCount, zeroLeakVerified } = applyRedaction(
    vault.rawText,
    vault.entities
  );
  const [originalSha256, redactedSha256] = await Promise.all([
    sha256Hex(vault.rawText),
    sha256Hex(redactedText),
  ]);

  const cert = {
    schema: 'cloakvault.zero-leak-proof/v1',
    generatedAt: new Date().toISOString(),
    documentTitle: vault.title,
    category: vault.category,
    zeroLeakAssertionPassed: zeroLeakVerified,
    entitiesShieldedCount: activeCount,
    entityTokens: vault.entities
      .filter((e) => e.enabled)
      .map((e) => ({
        token: e.token,
        type: e.type,
        detector: e.source,
        occurrences: e.occurrences,
      })),
    piiBytesKeptLocal: shieldedBytes,
    outboundPayloadBytes: new TextEncoder().encode(redactedText).length,
    cryptographicHashes: {
      originalDocumentSha256: originalSha256,
      sanitizedCloudPayloadSha256: redactedSha256,
    },
    auditProvenance: vault.auditReport
      ? {
          inferenceSource: vault.auditReport.inferenceSource,
          modelLabel: vault.auditReport.modelLabel,
          latencyMs: vault.auditReport.latencyMs,
          riskScore: vault.auditReport.riskScore,
        }
      : null,
  };

  triggerFileDownload(
    `${slugify(vault.title)}-zero-leak-certificate.json`,
    JSON.stringify(cert, null, 2),
    'application/json;charset=utf-8'
  );
}
