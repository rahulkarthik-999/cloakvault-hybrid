import { applyRedaction, rehydrateText } from './piiEngine';
import { sha256Hex, triggerFileDownload } from './cryptoProof';
import type { VaultDocument } from '../types/vault';

export interface DocBlock {
  kind: 'title' | 'subtitle' | 'heading' | 'subheading' | 'paragraph' | 'quote' | 'redline' | 'meta' | 'bullet' | 'divider';
  text: string;
  accent?: 'critical' | 'high' | 'medium' | 'low' | 'emerald' | 'indigo' | 'muted';
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

export function triggerBinaryDownload(filename: string, bytes: Uint8Array, mimeType: string): void {
  const safeCopy = new Uint8Array(bytes.byteLength);
  safeCopy.set(bytes);
  const blob = new Blob([safeCopy.buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/*  Document Block Builders (Shared across PDF, DOCX, and HTML exporters)     */
/* -------------------------------------------------------------------------- */

function buildRedactedDocBlocks(vault: VaultDocument, redactedText: string, shieldedBytes: number, activeCount: number): DocBlock[] {
  const blocks: DocBlock[] = [
    { kind: 'title', text: vault.title },
    {
      kind: 'subtitle',
      text: `CloakVault Zero-Leak Redacted Copy · ${vault.category.toUpperCase()} · ${activeCount} entities shielded (${shieldedBytes} B kept local · 0 B PII exposed)`,
    },
    { kind: 'divider', text: '' },
  ];

  const paragraphs = redactedText.replace(/\r\n/g, '\n').split(/\n{2,}/);
  for (const para of paragraphs) {
    const lines = para.split('\n').map((l) => l.trimEnd());
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^[-•*]\s+/.test(trimmed)) {
        blocks.push({ kind: 'bullet', text: trimmed.replace(/^[-•*]\s+/, '') });
      } else if (/^\d+\.\s+[A-Z0-9\s&/()-]{4,}$/.test(trimmed) || /^[A-Z][A-Z0-9\s—–:/&-]{6,}$/.test(trimmed)) {
        blocks.push({ kind: 'subheading', text: trimmed });
      } else {
        blocks.push({ kind: 'paragraph', text: trimmed });
      }
    }
  }

  return blocks;
}

function buildAuditReportBlocks(vault: VaultDocument, rehydrate: boolean): DocBlock[] {
  const report = vault.auditReport;
  if (!report) return [];
  const fmt = (txt: string) => (rehydrate ? rehydrateText(txt, vault.entities) : txt);
  const verdictAccent: DocBlock['accent'] =
    report.riskScore >= 75 ? 'critical' : report.riskScore >= 45 ? 'high' : 'emerald';

  const blocks: DocBlock[] = [
    { kind: 'title', text: `Risk Audit Report — ${vault.title}` },
    {
      kind: 'subtitle',
      text: `Risk Score: ${report.riskScore} / 100 (${report.riskVerdict.replace(/_/g, ' ')}) · ${report.inferenceSource} (${report.modelLabel}) · ${report.latencyMs}ms`,
      accent: verdictAccent,
    },
    {
      kind: 'meta',
      text: `PII Protected Locally: ${report.piiBytesProtected} bytes (0 bytes transmitted) | View: ${rehydrate ? 'Re-Hydrated Locally' : 'Sanitized Cloud Tokens'}`,
    },
    {
      kind: 'meta',
      text: `Original SHA-256: ${report.originalSha256}`,
    },
    {
      kind: 'meta',
      text: `Outbound Cloud SHA-256: ${report.redactedSha256}`,
    },
    { kind: 'divider', text: '' },
    { kind: 'heading', text: 'Executive Summary' },
    { kind: 'paragraph', text: fmt(report.executiveSummary) },
    { kind: 'heading', text: `Findings & Proposed Redlines (${report.findings.length})` },
  ];

  for (const f of report.findings) {
    const sevAccent: DocBlock['accent'] =
      f.severity === 'CRITICAL'
        ? 'critical'
        : f.severity === 'HIGH'
          ? 'high'
          : f.severity === 'MEDIUM'
            ? 'medium'
            : 'low';
    blocks.push({ kind: 'subheading', text: `[${f.severity}] ${fmt(f.title)}`, accent: sevAccent });
    blocks.push({ kind: 'paragraph', text: fmt(f.explanation) });
    if (f.clauseQuote) {
      blocks.push({ kind: 'quote', text: `Current clause: "${fmt(f.clauseQuote)}"`, accent: 'critical' });
    }
    if (f.suggestedRedline) {
      blocks.push({ kind: 'redline', text: `Proposed redline: ${fmt(f.suggestedRedline)}`, accent: 'emerald' });
    }
    if (f.recommendedAction) {
      blocks.push({ kind: 'meta', text: `Recommended action: ${fmt(f.recommendedAction)}`, accent: 'indigo' });
    }
  }

  if (report.missingProtections.length > 0) {
    blocks.push({ kind: 'heading', text: 'Missing Safeguards' });
    for (const mp of report.missingProtections) {
      blocks.push({ kind: 'bullet', text: fmt(mp) });
    }
  }

  return blocks;
}

/* -------------------------------------------------------------------------- */
/*  Pure TypeScript Standards-Compliant PDF 1.4 Generator (Zero Dependencies) */
/* -------------------------------------------------------------------------- */

function toPdfAscii(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/\u2022|\u00B7/g, '*')
    .replace(/\u2192|\u2197/g, '->')
    .replace(/\u21C4/g, '<->')
    .replace(/\u2026/g, '...')
    .replace(/\u20B9/g, 'INR ')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function escapePdfString(text: string): string {
  return toPdfAscii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = toPdfAscii(text).trim();
  if (!clean) return [];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      if (word.length > maxChars) {
        let rest = word;
        while (rest.length > maxChars) {
          lines.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars);
        }
        current = rest;
      } else {
        current = word;
      }
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      if (word.length > maxChars) {
        let rest = word;
        while (rest.length > maxChars) {
          lines.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars);
        }
        current = rest;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function accentRgb(accent?: DocBlock['accent']): string {
  switch (accent) {
    case 'critical':
      return '0.72 0.11 0.11';
    case 'high':
      return '0.71 0.33 0.04';
    case 'medium':
      return '0.26 0.22 0.79';
    case 'emerald':
      return '0.02 0.47 0.34';
    case 'indigo':
      return '0.22 0.25 0.65';
    case 'muted':
    case 'low':
      return '0.38 0.41 0.49';
    default:
      return '0.06 0.07 0.09';
  }
}

export function buildPdfBytes(blocks: DocBlock[], footerLabel: string): Uint8Array {
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN_X = 52;
  const TOP_Y = 740;
  const BOTTOM_Y = 62;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  const pageStreams: string[][] = [[]];
  let y = TOP_Y;

  const ensureSpace = (needed: number) => {
    if (y - needed < BOTTOM_Y) {
      pageStreams.push([]);
      y = TOP_Y;
    }
  };

  const currentOps = () => pageStreams[pageStreams.length - 1];

  for (const block of blocks) {
    if (block.kind === 'divider') {
      ensureSpace(14);
      y -= 4;
      currentOps().push(`0.86 0.88 0.91 RG 0.8 w ${MARGIN_X} ${y.toFixed(1)} m ${(PAGE_W - MARGIN_X).toFixed(1)} ${y.toFixed(1)} l S`);
      y -= 12;
      continue;
    }

    let font = 'F1';
    let fontSize = 10.5;
    let leading = 15;
    let indent = 0;
    let spaceBefore = 0;
    let spaceAfter = 5;
    let color = accentRgb(block.accent);

    switch (block.kind) {
      case 'title':
        font = 'F2';
        fontSize = 18;
        leading = 23;
        spaceAfter = 6;
        break;
      case 'subtitle':
        font = 'F1';
        fontSize = 9.5;
        leading = 13.5;
        color = block.accent ? accentRgb(block.accent) : '0.32 0.36 0.44';
        spaceAfter = 8;
        break;
      case 'heading':
        font = 'F2';
        fontSize = 13;
        leading = 18;
        spaceBefore = 10;
        spaceAfter = 5;
        break;
      case 'subheading':
        font = 'F2';
        fontSize = 11;
        leading = 15.5;
        spaceBefore = 8;
        spaceAfter = 3;
        break;
      case 'meta':
        font = 'F3';
        fontSize = 8.5;
        leading = 12;
        color = block.accent ? accentRgb(block.accent) : '0.36 0.40 0.48';
        spaceAfter = 4;
        break;
      case 'quote':
        font = 'F1';
        fontSize = 9.5;
        leading = 14;
        indent = 12;
        color = '0.60 0.12 0.12';
        spaceAfter = 5;
        break;
      case 'redline':
        font = 'F1';
        fontSize = 9.5;
        leading = 14;
        indent = 12;
        color = '0.02 0.44 0.31';
        spaceAfter = 5;
        break;
      case 'bullet':
        font = 'F1';
        fontSize = 10;
        leading = 14.5;
        indent = 14;
        spaceAfter = 3;
        break;
      default:
        break;
    }

    const avgCharWidth = font === 'F3' ? fontSize * 0.6 : fontSize * 0.51;
    const maxChars = Math.max(24, Math.floor((CONTENT_W - indent) / avgCharWidth));
    const prefix = block.kind === 'bullet' ? '* ' : '';
    const wrapped = wrapText(prefix + block.text, maxChars);
    if (wrapped.length === 0) continue;

    ensureSpace(spaceBefore + leading * Math.min(wrapped.length, 3));
    y -= spaceBefore;

    const startY = y;
    for (const line of wrapped) {
      ensureSpace(leading);
      currentOps().push(
        `BT /${font} ${fontSize} Tf ${color} rg ${(MARGIN_X + indent).toFixed(1)} ${y.toFixed(1)} Td (${escapePdfString(line)}) Tj ET`
      );
      y -= leading;
    }

    // Left accent bar for quotes & proposed redlines on the same page
    if ((block.kind === 'quote' || block.kind === 'redline') && startY >= y) {
      const barColor = block.kind === 'quote' ? '0.86 0.24 0.24' : '0.06 0.65 0.48';
      const barTop = startY + fontSize * 0.85;
      const barBottom = y + leading * 0.4;
      currentOps().push(`${barColor} RG 2 w ${(MARGIN_X + 4).toFixed(1)} ${barBottom.toFixed(1)} m ${(MARGIN_X + 4).toFixed(1)} ${barTop.toFixed(1)} l S`);
    }

    y -= spaceAfter;
  }

  // Add clean running footer to every page
  const totalPages = pageStreams.length;
  for (let i = 0; i < totalPages; i++) {
    const ops = pageStreams[i];
    ops.push(`0.88 0.90 0.92 RG 0.5 w ${MARGIN_X} 44 m ${PAGE_W - MARGIN_X} 44 l S`);
    ops.push(
      `BT /F3 8 Tf 0.45 0.48 0.55 rg ${MARGIN_X} 32 Td (${escapePdfString(`${footerLabel} | Page ${i + 1} of ${totalPages}`)}) Tj ET`
    );
  }

  // Assemble PDF objects
  const objects: string[] = [];
  // 1: Catalog, 2: Pages, 3: F1 Helvetica, 4: F2 Helvetica-Bold, 5: F3 Courier
  const pageObjNums: number[] = [];
  const firstPageObj = 6;
  for (let i = 0; i < totalPages; i++) {
    pageObjNums.push(firstPageObj + i * 2);
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${totalPages} >>\nendobj\n`
  );
  objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`);

  const encoder = new TextEncoder();
  for (let i = 0; i < totalPages; i++) {
    const pageNum = firstPageObj + i * 2;
    const contentNum = pageNum + 1;
    const streamStr = pageStreams[i].join('\n');
    const streamLen = encoder.encode(streamStr).byteLength;

    objects.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`
    );
    objects.push(`${contentNum} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamStr}\nendstream\nendobj\n`);
  }

  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const parts: Uint8Array[] = [encoder.encode(header)];
  let offset = parts[0].byteLength;
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(offset);
    const bytes = encoder.encode(obj);
    parts.push(bytes);
    offset += bytes.byteLength;
  }

  const xrefOffset = offset;
  const xrefLines = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`];
  for (let i = 1; i <= objects.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  xrefLines.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );
  parts.push(encoder.encode(xrefLines.join('')));

  const totalLen = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const out = new Uint8Array(totalLen);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.byteLength;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Pure TypeScript Genuine OOXML .docx Generator (Zero Dependencies)         */
/* -------------------------------------------------------------------------- */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZipStore(files: Array<{ name: string; content: string }>): Uint8Array {
  const enc = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const dataBytes = enc.encode(file.content);
    const crc = crc32(dataBytes);

    // Local file header (30 bytes + name)
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // store (no compression)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    // Central directory header (46 bytes + name)
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);

    localChunks.push(lh, dataBytes);
    centralChunks.push(cd);
    offset += lh.length + dataBytes.length;
  }

  const centralSize = centralChunks.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const all = [...localChunks, ...centralChunks, eocd];
  const total = all.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of all) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function accentHex(accent?: DocBlock['accent']): string {
  switch (accent) {
    case 'critical':
      return 'B91C1C';
    case 'high':
      return 'B45309';
    case 'medium':
      return '4338CA';
    case 'emerald':
      return '047857';
    case 'indigo':
      return '3730A3';
    case 'muted':
    case 'low':
      return '5B6474';
    default:
      return '0E1015';
  }
}

export function buildDocxBytes(blocks: DocBlock[]): Uint8Array {
  const paragraphsXml: string[] = [];

  for (const b of blocks) {
    if (b.kind === 'divider') {
      paragraphsXml.push(
        `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="D8DCE4"/></w:pBdr><w:spacing w:after="160"/></w:pPr></w:p>`
      );
      continue;
    }

    const txt = escapeXml(b.kind === 'bullet' ? `•  ${b.text}` : b.text);
    const color = accentHex(b.accent);

    switch (b.kind) {
      case 'title':
        paragraphsXml.push(
          `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="0E1015"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
        );
        break;
      case 'subtitle':
        paragraphsXml.push(
          `<w:p><w:pPr><w:spacing w:after="140"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="${b.accent ? color : '525866'}"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
        );
        break;
      case 'heading':
        paragraphsXml.push(
          `<w:p><w:pPr><w:spacing w:before="220" w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="0E1015"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
        );
        break;
      case 'subheading':
        paragraphsXml.push(
          `<w:p><w:pPr><w:spacing w:before="180" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="23"/><w:color w:val="${color}"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
        );
        break;
      case 'meta':
        paragraphsXml.push(
          `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:color w:val="${b.accent ? color : '525866'}"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
        );
        break;
      case 'quote':
        paragraphsXml.push(
          `<w:p><w:pPr><w:ind w:left="320"/><w:spacing w:after="90"/></w:pPr><w:r><w:rPr><w:i/><w:strike/><w:sz w:val="20"/><w:color w:val="991B1B"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
        );
        break;
      case 'redline':
        paragraphsXml.push(
          `<w:p><w:pPr><w:ind w:left="320"/><w:spacing w:after="90"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="047857"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
        );
        break;
      case 'bullet':
        paragraphsXml.push(
          `<w:p><w:pPr><w:ind w:left="320"/><w:spacing w:after="70"/></w:pPr><w:r><w:rPr><w:sz w:val="21"/><w:color w:val="1E2129"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
        );
        break;
      default:
        paragraphsXml.push(
          `<w:p><w:pPr><w:spacing w:after="110"/></w:pPr><w:r><w:rPr><w:sz w:val="21"/><w:color w:val="1E2129"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
        );
        break;
    }
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return buildZipStore([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: relsXml },
    { name: 'word/_rels/document.xml.rels', content: docRelsXml },
    { name: 'word/document.xml', content: documentXml },
  ]);
}

/* -------------------------------------------------------------------------- */
/*  Standalone Styled HTML & RFC 4180 CSV Generators                          */
/* -------------------------------------------------------------------------- */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildStandaloneHtml(title: string, blocks: DocBlock[]): string {
  const bodyHtml = blocks
    .map((b) => {
      const t = escapeHtml(b.text);
      switch (b.kind) {
        case 'title':
          return `<h1>${t}</h1>`;
        case 'subtitle':
          return `<p class="subtitle">${t}</p>`;
        case 'heading':
          return `<h2>${t}</h2>`;
        case 'subheading':
          return `<h3 class="accent-${b.accent ?? 'default'}">${t}</h3>`;
        case 'meta':
          return `<p class="meta">${t}</p>`;
        case 'quote':
          return `<blockquote class="quote">${t}</blockquote>`;
        case 'redline':
          return `<blockquote class="redline">${t}</blockquote>`;
        case 'bullet':
          return `<p class="bullet">&bull; ${t}</p>`;
        case 'divider':
          return `<hr />`;
        default:
          return `<p>${t}</p>`;
      }
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — CloakVault Export</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; background: #F7F8FA; color: #0E1015; margin: 0; padding: 36px 20px; }
    main { max-width: 780px; margin: 0 auto; background: #FFF; border: 1px solid #E5E7EC; border-radius: 10px; padding: 48px 52px; box-shadow: 0 2px 12px rgba(14,16,21,.04); }
    h1 { font-size: 26px; margin: 0 0 8px; line-height: 1.2; }
    h2 { font-family: system-ui, -apple-system, sans-serif; font-size: 16px; margin: 28px 0 10px; border-bottom: 1px solid #EEF0F4; padding-bottom: 6px; }
    h3 { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; margin: 20px 0 6px; }
    p { font-size: 14.5px; line-height: 1.65; margin: 0 0 10px; white-space: pre-wrap; }
    .subtitle { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #525866; margin-bottom: 14px; }
    .meta { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #525866; margin-bottom: 6px; }
    .quote { border-left: 3px solid #DC2626; background: #FEF2F2; color: #991B1B; padding: 8px 12px; margin: 8px 0; font-size: 13px; text-decoration: line-through; }
    .redline { border-left: 3px solid #059669; background: #ECFDF5; color: #065F46; padding: 8px 12px; margin: 8px 0; font-size: 13px; font-weight: 500; }
    .bullet { padding-left: 16px; }
    .accent-critical { color: #B91C1C; }
    .accent-high { color: #B45309; }
    .accent-medium { color: #4338CA; }
    .accent-emerald { color: #047857; }
    hr { border: 0; border-top: 1px solid #E5E7EC; margin: 18px 0; }
    @media print { body { background: #FFF; padding: 0; } main { border: 0; box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <main>
    ${bodyHtml}
  </main>
</body>
</html>`;
}

function csvCell(val: string | number | boolean): string {
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildEntitiesAndFindingsCsv(vault: VaultDocument): string {
  const rows: string[] = [
    ['Section', 'Token / Severity', 'Type / Title', 'Detector / Action', 'Occurrences / Redline', 'Zero-PII Verified'].join(','),
  ];

  for (const e of vault.entities) {
    if (!e.enabled) continue;
    rows.push(
      [
        csvCell('SHIELDED_ENTITY'),
        csvCell(e.token),
        csvCell(e.type),
        csvCell(e.source),
        csvCell(e.occurrences),
        csvCell('LOCAL_ONLY'),
      ].join(',')
    );
  }

  if (vault.auditReport) {
    for (const f of vault.auditReport.findings) {
      rows.push(
        [
          csvCell('AUDIT_FINDING'),
          csvCell(f.severity),
          csvCell(f.title),
          csvCell(f.recommendedAction),
          csvCell(f.suggestedRedline || ''),
          csvCell(vault.auditReport.inferenceSource),
        ].join(',')
      );
    }
  }

  return rows.join('\r\n');
}

/* -------------------------------------------------------------------------- */
/*  Public One-Click Export Actions                                           */
/* -------------------------------------------------------------------------- */

export async function exportRedactedPdf(vault: VaultDocument): Promise<void> {
  const { redactedText, shieldedBytes, activeCount } = applyRedaction(vault.rawText, vault.entities);
  const hash = (await sha256Hex(redactedText)).slice(0, 16);
  const blocks = buildRedactedDocBlocks(vault, redactedText, shieldedBytes, activeCount);
  const pdfBytes = buildPdfBytes(blocks, `CloakVault Zero-Leak PDF | SHA-256: ${hash}...`);
  triggerBinaryDownload(`${slugify(vault.title)}-redacted.pdf`, pdfBytes, 'application/pdf');
}

export function exportRedactedDocx(vault: VaultDocument): void {
  const { redactedText, shieldedBytes, activeCount } = applyRedaction(vault.rawText, vault.entities);
  const blocks = buildRedactedDocBlocks(vault, redactedText, shieldedBytes, activeCount);
  const docxBytes = buildDocxBytes(blocks);
  triggerBinaryDownload(
    `${slugify(vault.title)}-redacted.docx`,
    docxBytes,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export function exportRedactedHtml(vault: VaultDocument): void {
  const { redactedText, shieldedBytes, activeCount } = applyRedaction(vault.rawText, vault.entities);
  const blocks = buildRedactedDocBlocks(vault, redactedText, shieldedBytes, activeCount);
  const html = buildStandaloneHtml(`${vault.title} (Redacted)`, blocks);
  triggerFileDownload(`${slugify(vault.title)}-redacted.html`, html, 'text/html;charset=utf-8');
}

export function exportAuditPdf(vault: VaultDocument, rehydrate: boolean): void {
  if (!vault.auditReport) return;
  const blocks = buildAuditReportBlocks(vault, rehydrate);
  const pdfBytes = buildPdfBytes(
    blocks,
    `CloakVault Risk Audit (${vault.auditReport.inferenceSource}) | Risk ${vault.auditReport.riskScore}/100`
  );
  triggerBinaryDownload(
    `${slugify(vault.title)}-audit-${rehydrate ? 'rehydrated' : 'sanitized'}.pdf`,
    pdfBytes,
    'application/pdf'
  );
}

export function exportAuditDocx(vault: VaultDocument, rehydrate: boolean): void {
  if (!vault.auditReport) return;
  const blocks = buildAuditReportBlocks(vault, rehydrate);
  const docxBytes = buildDocxBytes(blocks);
  triggerBinaryDownload(
    `${slugify(vault.title)}-audit-${rehydrate ? 'rehydrated' : 'sanitized'}.docx`,
    docxBytes,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export function exportEntitiesCsv(vault: VaultDocument): void {
  const csv = buildEntitiesAndFindingsCsv(vault);
  triggerFileDownload(`${slugify(vault.title)}-shield-and-audit.csv`, csv, 'text/csv;charset=utf-8');
}
