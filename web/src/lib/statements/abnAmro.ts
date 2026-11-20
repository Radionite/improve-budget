/**
 * ABN AMRO PDF 'Bij- en afschrijvingen'.
 *
 * - kop met Priverekening, Periode en 'Saldo dd-mm-jjjj € x' (begin en eind)
 * - tabel Datum | Omschrijving | Bedrag af | Bedrag bij
 * - een transactie begint met een datum; de omschrijving loopt over meerdere regels;
 *   het bedrag staat op de eerste regel in de kolom 'Bedrag af' of 'Bedrag bij'
 * - onderaan de laatste pagina: Aantal/Totaal afgeschreven en bijgeschreven
 */

import { parseDescription } from './descriptions';
import { assignSequence, type ParsedStatement, type ParsedTransaction } from './model';
import { groupLines, type PdfPage } from './pdfText';

const DATE_RE = /^\d{2}-\d{2}-\d{4}$/;
const AMOUNT_RE = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;
const SALDO_RE = /Saldo\s+(\d{2}-\d{2}-\d{4})\s+€\s*(-?[\d.]+,\d{2})/g;
const PERIOD_RE = /Periode\s+(\d{2}-\d{2}-\d{4})\s+t\/m\s+(\d{2}-\d{2}-\d{4})/;
const ACCOUNT_RE = /(?:Priverekening|Rekening|Betaalrekening)\s+([\d.]{9,14}|[A-Z]{2}\d{2}[A-Z]{4}\d{10})/;
const TOTALS_RE = /Totaal afgeschreven\s+Totaal bijgeschreven\s+€\s*([\d.]+,\d{2})\s+€\s*([\d.]+,\d{2})/;
const FOOTER_WORDS = new Set(['Totaal', 'Aantal', 'Saldo', 'Nieuw', 'Oud']);

export const toAmount = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'));
const toIso = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;

export const looksLikeAbnAmro = (firstPageText: string) =>
  firstPageText.includes('Bij- en afschrijvingen') && firstPageText.includes('Bedrag af');

type Row = { date: string; desc: string[]; af: number | null; bij: number | null };

export function parseAbnAmro(pages: PdfPage[]): ParsedStatement {
  const first = pages[0]?.text ?? '';
  const last = pages[pages.length - 1]?.text ?? '';
  const saldi = [...first.matchAll(SALDO_RE)];
  const period = first.match(PERIOD_RE);
  const account = first.match(ACCOUNT_RE);
  const totals = last.match(TOTALS_RE);

  const st: ParsedStatement = {
    bank: 'ABN AMRO',
    account: account?.[1] ?? '',
    periodFrom: period ? toIso(period[1]) : '',
    periodTo: period ? toIso(period[2]) : '',
    openingBalance: saldi.length >= 2 ? toAmount(saldi[0][2]) : null,
    closingBalance: saldi.length >= 2 ? toAmount(saldi[saldi.length - 1][2]) : null,
    statedDebit: totals ? toAmount(totals[1]) : null,
    statedCredit: totals ? toAmount(totals[2]) : null,
    transactions: [],
  };

  const rows: Row[] = [];
  for (const page of pages) {
    const lines = groupLines(page.words);
    const headerIdx = lines.findIndex((l) => {
      const t = l.map((w) => w.text);
      return t.includes('Datum') && t.includes('Omschrijving') && t.includes('af') && t.includes('bij');
    });
    if (headerIdx < 0) continue;
    const header = lines[headerIdx];
    const descX = header.find((w) => w.text === 'Omschrijving')!.x0;
    const af = header.find((w) => w.text === 'af')!;
    const bij = header.find((w) => w.text === 'bij')!;
    const amountStart = Math.min(...header.filter((w) => w.text === 'Bedrag').map((w) => w.x0)) - 40;
    const splitX = (af.x1 + bij.x1) / 2;

    let current: Row | null = null;
    for (const line of lines.slice(headerIdx + 1)) {
      const firstWord = line[0];
      if (FOOTER_WORDS.has(firstWord.text)) break; // samenvatting onderaan: geen transacties meer
      let rest = line;
      if (DATE_RE.test(firstWord.text) && firstWord.x0 < descX) {
        current = { date: firstWord.text, desc: [], af: null, bij: null };
        rows.push(current);
        rest = line.slice(1);
      } else if (!current) {
        continue;
      }
      for (const w of rest) {
        if (w.x0 >= amountStart && AMOUNT_RE.test(w.text)) {
          const col = w.x1 <= splitX ? 'af' : 'bij';
          if (current[col] === null) current[col] = toAmount(w.text);
        } else if (w.x0 >= descX - 2 && w.x1 < amountStart + 40) {
          current.desc.push(w.text);
        }
      }
    }
  }

  for (const r of rows) {
    if (r.af === null && r.bij === null) continue;
    const raw = r.desc.join(' ');
    const amount = Math.round((-(r.af ?? 0) + (r.bij ?? 0)) * 100) / 100;
    const tx: ParsedTransaction = { date: toIso(r.date), amount, raw, seq: 0, ...parseDescription(raw) };
    st.transactions.push(tx);
  }
  assignSequence(st.transactions);
  return st;
}
