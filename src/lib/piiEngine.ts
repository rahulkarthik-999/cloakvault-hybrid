import type { PiiEntity, PiiType } from '../types/vault';

interface MatchSpan {
  start: number;
  end: number;
  text: string;
  type: PiiType;
  source: 'REGEX' | 'GEMINI_NANO' | 'MANUAL';
}

interface PatternRule {
  type: PiiType;
  regex: RegExp;
}

const REGEX_RULES: PatternRule[] = [
  // API keys / secrets
  { type: 'SECRET', regex: /\b(?:sk-(?:live|test|proj)?-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z\-_]{25,}|ghp_[A-Za-z0-9]{20,})\b/g },
  // Emails
  { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  // SSN (US)
  { type: 'GOV_ID', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  // Indian PAN
  { type: 'GOV_ID', regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  // US EIN / Policy IDs
  { type: 'GOV_ID', regex: /\b(?:PSH-\d{6,12}|\d{2}-\d{7})\b/g },
  // Credit cards / hyphenated account numbers
  { type: 'ACCOUNT', regex: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g },
  // IFSC codes (Indian bank routing)
  { type: 'ACCOUNT', regex: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
  // Long numeric bank account numbers & routing numbers (capture digits only)
  { type: 'ACCOUNT', regex: /(?:Account\s*(?:Number|#)?\s*:?\s*|Routing\s*(?:Number)?\s*:?\s*)(\d{9,18})/gi },
  // International & US Phone numbers (supports +1-512-555-0194, +91-98450-11223, (512) 555-0194)
  { type: 'PHONE', regex: /(?:\+\d{1,3}[-\s]\d{5}[-\s]\d{5}\b|(?:\+\d{1,3}[-\s]?)?(?:\(\d{3}\)|\d{3})[-\s]\d{3}[-\s]\d{4}\b)/g },
  // Internal IPs (RFC1918: 10.x.x.x, 172.16-31.x.x, 192.168.x.x)
  { type: 'SECRET', regex: /\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g },
  // Street addresses (heuristic for US/India addresses; single-line safe)
  {
    type: 'ADDRESS',
    regex: /\b\d{2,5}[ \t]+[A-Z][A-Za-z0-9. ]{3,35}(?:Street|St\.?|Road|Rd\.?|Blvd\.?|Terrace|Ave\.?|Avenue|Lane|Ln\.?|Drive|Dr\.?)(?:,[ \t]*(?:Suite|Floor|Apt|Unit)?[ \t]*(?![A-Z]{2}[ \t]+\d{5}\b)[A-Za-z0-9 ]+){0,2}(?:,[ \t]*[A-Z]{2}[ \t]*\d{5}|[ \t]+\d{6})?/g,
  },
];

// Contextual label-based name / org extractor as deterministic baseline before Gemini Nano enhances it
const LABELED_ENTITY_RULES: Array<{ type: PiiType; regex: RegExp; group: number }> = [
  { type: 'PERSON', regex: /\b(?:Principal|Authorized Signatory|Patient Name|Attending Physician|VP of Operations)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\b/g, group: 1 },
  { type: 'PERSON', regex: /\b(?:Dr\.\s+[A-Z](?:\.|[a-z]+)\s+[A-Z][a-z]+)\b/g, group: 0 },
  { type: 'PERSON', regex: /\bWire Transfer to\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g, group: 1 },
  { type: 'ORG', regex: /\b([A-Z][A-Za-z0-9&. ]{2,40}[ \t]+(?:LLC|Inc\.?|Ltd\.?|Pvt\.[ \t]*Ltd\.?|Consulting|Medical Center|PPO|SYNDICATE LTD))\b/g, group: 1 },
];

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractDeterministicPii(rawText: string): PiiEntity[] {
  const candidates: Array<{ text: string; type: PiiType; source: 'REGEX' }> = [];

  for (const rule of REGEX_RULES) {
    rule.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(rawText)) !== null) {
      const val = (match[1] ?? match[0]).trim();
      if (val.length >= 4 && !/^(Account|Routing|IFSC)$/i.test(val)) {
        candidates.push({ text: val, type: rule.type, source: 'REGEX' });
      }
    }
  }

  for (const rule of LABELED_ENTITY_RULES) {
    rule.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(rawText)) !== null) {
      const val = (match[rule.group] ?? match[0]).trim();
      if (val.length >= 4) {
        candidates.push({ text: val, type: rule.type, source: 'REGEX' });
      }
    }
  }

  return buildEntityList(rawText, candidates);
}

export function mergeEntities(
  rawText: string,
  existing: PiiEntity[],
  additions: Array<{ text: string; type: PiiType; source: 'GEMINI_NANO' | 'MANUAL' }>
): PiiEntity[] {
  const combined: Array<{ text: string; type: PiiType; source: PiiEntity['source']; enabled?: boolean }> =
    existing.map((e) => ({
      text: e.original,
      type: e.type,
      source: e.source,
      enabled: e.enabled,
    }));

  for (const add of additions) {
    const cleaned = add.text.trim();
    if (cleaned.length < 3) continue;
    // Only add entities that actually exist in the document
    if (!rawText.toLowerCase().includes(cleaned.toLowerCase())) continue;
    const alreadyExists = combined.some(
      (c) =>
        c.text.toLowerCase() === cleaned.toLowerCase() ||
        (c.text.length > cleaned.length && c.text.toLowerCase().includes(cleaned.toLowerCase()))
    );
    if (!alreadyExists) {
      combined.push({ text: cleaned, type: add.type, source: add.source, enabled: true });
    }
  }

  return buildEntityList(rawText, combined);
}

function buildEntityList(
  rawText: string,
  items: Array<{ text: string; type: PiiType; source: PiiEntity['source']; enabled?: boolean }>
): PiiEntity[] {
  // Deduplicate case-insensitively, preferring longer strings so partial matches don't fragment
  const deduped = new Map<string, { text: string; type: PiiType; source: PiiEntity['source']; enabled: boolean }>();
  const sorted = [...items].sort((a, b) => b.text.length - a.text.length);

  for (const item of sorted) {
    const key = item.text.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, {
        text: item.text,
        type: item.type,
        source: item.source,
        enabled: item.enabled ?? true,
      });
    }
  }

  const counters: Record<PiiType, number> = {
    PERSON: 0,
    ORG: 0,
    EMAIL: 0,
    PHONE: 0,
    ACCOUNT: 0,
    GOV_ID: 0,
    ADDRESS: 0,
    SECRET: 0,
    CUSTOM: 0,
  };

  const entities: PiiEntity[] = [];

  for (const entry of deduped.values()) {
    const regex = new RegExp(escapeRegExp(entry.text), 'gi');
    const matches = rawText.match(regex);
    const occurrences = matches ? matches.length : 0;
    if (occurrences === 0) continue;

    counters[entry.type] += 1;
    const token = `[${entry.type}_${counters[entry.type]}]`;
    entities.push({
      id: `${entry.type}-${counters[entry.type]}-${entry.text.slice(0, 8)}`,
      token,
      type: entry.type,
      original: entry.text,
      enabled: entry.enabled,
      source: entry.source,
      occurrences,
    });
  }

  return entities;
}

export function applyRedaction(
  rawText: string,
  entities: PiiEntity[]
): {
  redactedText: string;
  shieldedBytes: number;
  activeCount: number;
  zeroLeakVerified: boolean;
} {
  const active = entities
    .filter((e) => e.enabled && e.original.trim().length > 0)
    .sort((a, b) => b.original.length - a.original.length);

  let redactedText = rawText;
  let shieldedBytes = 0;

  for (const entity of active) {
    const re = new RegExp(escapeRegExp(entity.original), 'gi');
    redactedText = redactedText.replace(re, (matched) => {
      shieldedBytes += new TextEncoder().encode(matched).length;
      return entity.token;
    });
  }

  // Zero-leak assertion: ensure none of the active PII originals remain in the outbound cloud text
  const zeroLeakVerified = active.every(
    (e) => !redactedText.toLowerCase().includes(e.original.toLowerCase())
  );

  return {
    redactedText,
    shieldedBytes,
    activeCount: active.length,
    zeroLeakVerified,
  };
}

export function rehydrateText(tokenizedText: string, entities: PiiEntity[]): string {
  let result = tokenizedText;
  for (const entity of entities) {
    if (!entity.enabled) continue;
    const re = new RegExp(escapeRegExp(entity.token), 'g');
    result = result.replace(re, entity.original);
  }
  return result;
}

export interface TextSegment {
  text: string;
  entity?: PiiEntity;
}

export function segmentDocumentWithEntities(
  rawText: string,
  entities: PiiEntity[]
): TextSegment[] {
  const active = entities.filter((e) => e.enabled);
  if (active.length === 0) return [{ text: rawText }];

  const spans: Array<MatchSpan & { entity: PiiEntity }> = [];
  for (const entity of active) {
    const re = new RegExp(escapeRegExp(entity.original), 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      spans.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        type: entity.type,
        source: entity.source,
        entity,
      });
    }
  }

  // Sort by start asc, then longer span first; drop overlaps
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const nonOverlapping: Array<MatchSpan & { entity: PiiEntity }> = [];
  let cursor = 0;
  for (const sp of spans) {
    if (sp.start >= cursor) {
      nonOverlapping.push(sp);
      cursor = sp.end;
    }
  }

  const segments: TextSegment[] = [];
  let pos = 0;
  for (const sp of nonOverlapping) {
    if (sp.start > pos) {
      segments.push({ text: rawText.slice(pos, sp.start) });
    }
    segments.push({ text: rawText.slice(sp.start, sp.end), entity: sp.entity });
    pos = sp.end;
  }
  if (pos < rawText.length) {
    segments.push({ text: rawText.slice(pos) });
  }
  return segments;
}

export function segmentTokenizedOutput(
  tokenizedText: string,
  entities: PiiEntity[],
  rehydrate: boolean
): TextSegment[] {
  const active = entities.filter((e) => e.enabled);
  if (active.length === 0) return [{ text: tokenizedText }];

  const tokenMap = new Map(active.map((e) => [e.token, e]));
  const tokenPattern = new RegExp(
    `(${active.map((e) => escapeRegExp(e.token)).join('|')})`,
    'g'
  );

  const parts = tokenizedText.split(tokenPattern);
  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      const entity = tokenMap.get(part);
      if (entity) {
        return {
          text: rehydrate ? entity.original : entity.token,
          entity,
        };
      }
      return { text: part };
    });
}
