import { describe, expect, it } from 'vitest';
import {
  buildDocxBytes,
  buildEntitiesAndFindingsCsv,
  buildPdfBytes,
  buildStandaloneHtml,
} from './documentExport';
import { SAMPLE_DOCUMENTS } from '../data/sampleDocuments';
import { applyRedaction, extractDeterministicPii } from './piiEngine';
import type { VaultDocument } from '../types/vault';

describe('CloakVault Multi-Format Document Exporters (PDF, DOCX, HTML, CSV)', () => {
  const sample = SAMPLE_DOCUMENTS[0];
  const entities = extractDeterministicPii(sample.rawText);
  const { redactedText } = applyRedaction(sample.rawText, entities);

  const vault: VaultDocument = {
    id: 'test-vault',
    title: sample.title,
    category: sample.category,
    rawText: sample.rawText,
    entities,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    chatHistory: [],
  };

  it('builds a valid multi-page binary PDF 1.4 without leaking raw PII', () => {
    const blocks = [
      { kind: 'title' as const, text: sample.title },
      { kind: 'paragraph' as const, text: redactedText },
    ];
    const pdf = buildPdfBytes(blocks, 'CloakVault Test');
    const text = new TextDecoder('latin1').decode(pdf);

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('xref');
    expect(text).toContain('[EMAIL_1]');
    expect(text).not.toContain('marcus.vance@apexmeridian.io');
    expect(text).not.toContain('sk-live-94a8f2c019e7b3d54109a2b8c7d6e5f4');
  });

  it('builds a valid OOXML .docx ZIP archive with word/document.xml and zero raw PII', () => {
    const docx = buildDocxBytes([
      { kind: 'title', text: sample.title },
      { kind: 'paragraph', text: redactedText },
    ]);

    // Standard PKZIP local file header signature: 0x50 0x4B 0x03 0x04
    expect(docx[0]).toBe(0x50);
    expect(docx[1]).toBe(0x4b);
    expect(docx[2]).toBe(0x03);
    expect(docx[3]).toBe(0x04);

    const decoded = new TextDecoder().decode(docx);
    expect(decoded).toContain('[Content_Types].xml');
    expect(decoded).toContain('word/document.xml');
    expect(decoded).toContain('[EMAIL_1]');
    expect(decoded).not.toContain('marcus.vance@apexmeridian.io');
    expect(decoded).not.toContain('ABCPS4921K');
  });

  it('builds standalone escaped HTML and zero-PII RFC 4180 CSV', () => {
    const html = buildStandaloneHtml(sample.title, [
      { kind: 'title', text: 'A & B <Contract>' },
      { kind: 'paragraph', text: redactedText },
    ]);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('A &amp; B &lt;Contract&gt;');
    expect(html).not.toContain('marcus.vance@apexmeridian.io');

    const csv = buildEntitiesAndFindingsCsv(vault);
    expect(csv).toContain('SHIELDED_ENTITY');
    expect(csv).toContain('[EMAIL_1]');
    expect(csv).toContain('LOCAL_ONLY');
    expect(csv).not.toContain('marcus.vance@apexmeridian.io');
  });
});
