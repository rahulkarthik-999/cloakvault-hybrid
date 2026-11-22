import { describe, expect, it } from 'vitest';
import {
  applyRedaction,
  extractDeterministicPii,
  mergeEntities,
  rehydrateText,
  segmentTokenizedOutput,
} from './piiEngine';
import { SAMPLE_DOCUMENTS } from '../data/sampleDocuments';

describe('CloakVault Local PII Redaction & Re-Hydration Engine', () => {
  it('detects sensitive legal, contact, financial, and secret PII in the sample MSA', () => {
    const msa = SAMPLE_DOCUMENTS[0].rawText;
    const entities = extractDeterministicPii(msa);

    const originals = entities.map((e) => e.original);
    expect(originals).toContain('marcus.vance@apexmeridian.io');
    expect(originals).toContain('priya.sharma@sharmadev.co');
    expect(originals).toContain('Marcus Vance');
    expect(originals).toContain('Priya Sharma');
    expect(originals).toContain('+91-98450-11223');
    expect(originals).toContain('50100482917364');
    expect(originals).toContain('HDFC0001204');
    expect(originals).toContain('ABCPS4921K');
    expect(originals).toContain('sk-live-94a8f2c019e7b3d54109a2b8c7d6e5f4');
    expect(originals).toContain('10.42.88.19');
  });

  it('guarantees zero active PII remains in outbound cloud payload and cleanly re-hydrates', () => {
    const msa = SAMPLE_DOCUMENTS[0].rawText;
    const entities = extractDeterministicPii(msa);
    const { redactedText, shieldedBytes, activeCount, zeroLeakVerified } = applyRedaction(
      msa,
      entities
    );

    expect(activeCount).toBeGreaterThanOrEqual(6);
    expect(shieldedBytes).toBeGreaterThan(100);
    expect(zeroLeakVerified).toBe(true);
    expect(redactedText).not.toContain('marcus.vance@apexmeridian.io');
    expect(redactedText).not.toContain('ABCPS4921K');
    expect(redactedText).not.toContain('sk-live-94a8f2c019e7b3d54109a2b8c7d6e5f4');

    const restored = rehydrateText(redactedText, entities);
    expect(restored).toContain('marcus.vance@apexmeridian.io');
    expect(restored).toContain('ABCPS4921K');
  });

  it('merges on-device Gemini Nano entities without duplicating existing matches', () => {
    const text = 'Agreement between Quantum Harbor Ventures and Rohan Mehta regarding Project Helios.';
    const base = extractDeterministicPii(text);
    const merged = mergeEntities(text, base, [
      { text: 'Quantum Harbor Ventures', type: 'ORG', source: 'GEMINI_NANO' },
      { text: 'Rohan Mehta', type: 'PERSON', source: 'GEMINI_NANO' },
      { text: 'Nonexistent Hallucination', type: 'ORG', source: 'GEMINI_NANO' },
    ]);

    expect(merged.some((e) => e.original === 'Quantum Harbor Ventures')).toBe(true);
    expect(merged.some((e) => e.original === 'Rohan Mehta')).toBe(true);
    expect(merged.some((e) => e.original === 'Nonexistent Hallucination')).toBe(false);

    const segs = segmentTokenizedOutput('Risk found for [ORG_1] and [PERSON_1].', merged, true);
    expect(segs.map((s) => s.text).join('')).toBe(
      'Risk found for Quantum Harbor Ventures and Rohan Mehta.'
    );
  });

  it('extracts clean single-line addresses without bleeding across newlines', () => {
    const ledger = SAMPLE_DOCUMENTS[1].rawText;
    const ledgerEntities = extractDeterministicPii(ledger);
    const ledgerAddr = ledgerEntities.find((e) => e.type === 'ADDRESS');
    expect(ledgerAddr?.original).toBe('1290 Market Street, Floor 6, San Francisco, CA 94103');

    const medical = SAMPLE_DOCUMENTS[2].rawText;
    const medicalEntities = extractDeterministicPii(medical);
    const medicalAddr = medicalEntities.find((e) => e.type === 'ADDRESS');
    expect(medicalAddr?.original).toBe('880 Harbor View Blvd, Seattle, WA 98104');
  });
});
