import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  // 100% browser-side PDF extraction
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages: string[] = [];

    const maxPages = Math.min(pdf.numPages, 30);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let currentLine = '';
      let lastY: number | null = null;

      for (const rawItem of content.items) {
        if (!('str' in rawItem)) continue;
        const item = rawItem as { str: string; hasEOL?: boolean; transform?: number[] };
        const text = item.str;
        const y = Array.isArray(item.transform) ? item.transform[5] : null;

        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          // Larger vertical gap indicates a new paragraph/section
          if (Math.abs(y - lastY) > 18 && lines.length > 0 && lines[lines.length - 1] !== '') {
            lines.push('');
          }
          currentLine = text;
        } else if (currentLine && text && !currentLine.endsWith(' ') && !text.startsWith(' ')) {
          currentLine += ' ' + text;
        } else {
          currentLine += text;
        }

        if (y !== null) lastY = y;
        if (item.hasEOL) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = '';
          lastY = null;
        }
      }

      if (currentLine.trim()) lines.push(currentLine.trim());
      pages.push(lines.join('\n').replace(/\n{3,}/g, '\n\n'));
    }

    const combined = pages.join('\n\n').trim();
    if (!combined) {
      throw new Error(
        'No selectable text found in this PDF. Upload a text-based PDF, DOCX, TXT, CSV, or Markdown file.'
      );
    }
    return combined;
  }

  // 100% browser-side Microsoft Word (.docx) extraction
  if (
    name.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    const text = result.value.trim();
    if (!text) {
      throw new Error('No readable text found inside this DOCX file.');
    }
    return text;
  }

  // Plain text / Markdown / CSV
  const text = await file.text();
  if (!text.trim()) {
    throw new Error('The uploaded file is empty.');
  }
  return text.trim();
}
