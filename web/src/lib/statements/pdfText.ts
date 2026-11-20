/** Woorden met posities uit een PDF halen met PDF.js (werkt in de browser en in tests). */

export type Word = { text: string; x0: number; x1: number; top: number };
export type PdfPage = { words: Word[]; text: string };

type TextItem = { str: string; transform: number[]; width: number; height: number };
type PdfjsLike = {
  getDocument: (src: { data: Uint8Array; isEvalSupported?: boolean; disableFontFace?: boolean }) => { promise: Promise<PdfDoc> };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPageProxy>; destroy: () => Promise<void> };
type PdfPageProxy = {
  getViewport: (o: { scale: number }) => { height: number };
  getTextContent: () => Promise<{ items: unknown[] }>;
};

/** Groepeert woorden op (ongeveer) dezelfde hoogte tot regels. */
export function groupLines(words: Word[], tolerance = 3): Word[][] {
  const sorted = [...words].sort((a, b) => Math.round(a.top) - Math.round(b.top) || a.x0 - b.x0);
  const lines: Word[][] = [];
  for (const w of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].top - w.top) <= tolerance) last.push(w);
    else lines.push([w]);
  }
  return lines.map((l) => l.sort((a, b) => a.x0 - b.x0));
}

export async function extractPdf(pdfjs: PdfjsLike, data: Uint8Array): Promise<PdfPage[]> {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise;
  const pages: PdfPage[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const height = page.getViewport({ scale: 1 }).height;
      const content = await page.getTextContent();
      const words: Word[] = [];
      for (const raw of content.items) {
        const item = raw as TextItem;
        if (!item.str || !item.str.trim()) continue;
        const x = item.transform[4];
        const fontSize = Math.hypot(item.transform[2], item.transform[3]) || item.height || 10;
        const top = height - item.transform[5] - fontSize;
        const charW = item.width / Math.max(1, item.str.length);
        // Tekstblokken opsplitsen in losse woorden met geschatte posities.
        const re = /\S+/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(item.str))) {
          const x0 = x + m.index * charW;
          words.push({ text: m[0], x0, x1: x0 + m[0].length * charW, top });
        }
      }
      const text = groupLines(words).map((l) => l.map((w) => w.text).join(' ')).join('\n');
      pages.push({ words, text });
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}
