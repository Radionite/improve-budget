import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderReport } from './report';
import { euro } from './format';

async function textOf(data: ArrayBuffer) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent();
    text += c.items.map((i) => ('str' in i ? i.str : '')).join(' ') + '\n';
  }
  return { text, pages: doc.numPages };
}

describe('PDF-rapport', () => {
  it('bevat titel, bedragen met euroteken, tabellen en paginanummers', async () => {
    const many = Array.from({ length: 80 }, (_, i) => [`2026-11-${String((i % 28) + 1).padStart(2, '0')}`, `Winkel ${i}`, 'Boodschappen', euro(-12.5 - i)]);
    const doc = renderReport({
      title: 'Gezinsbank',
      subtitle: 'Familie Test · november 2026',
      footer: 'Gezinsbank · Familie Test',
      sections: [
        { title: 'Samenvatting', facts: [['Netto inkomen', euro(4800)], ['Nog te verdelen', euro(-233)]] },
        { title: 'Budget', note: 'Toelichting bij het budget.', tables: [{ head: ['Categorie', 'Bedrag', '%'], body: [['Huur / hypotheek', euro(1344), '28%']], foot: ['Totaal', euro(1344), '28%'], right: [1, 2] }] },
        { title: 'Transacties', tables: [{ head: ['Datum', 'Omschrijving', 'Categorie', 'Bedrag'], body: many, right: [3] }] },
      ],
    });
    const { text, pages } = await textOf(doc.output('arraybuffer'));
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain('Gezinsbank');
    expect(text).toContain('€ 4.800');
    expect(text).toContain('Huur / hypotheek');
    expect(text).toContain('Winkel 79');
    expect(text).toContain(`Pagina 1 van ${pages}`);
    expect(text).not.toMatch(/−/);
  });
});
