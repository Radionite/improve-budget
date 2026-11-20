import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { looksLikeAbnAmro, parseAbnAmro } from './abnAmro';
import { categorize } from './categorize';
import { parseDescription } from './descriptions';
import { balanceOk, totalCredit, totalDebit, transactionId } from './model';
import { extractPdf } from './pdfText';

const FIXTURE = fileURLToPath(new URL('./__fixtures__/abn_amro_voorbeeld.pdf', import.meta.url));

async function load(path: string) {
  const pages = await extractPdf(pdfjs as never, new Uint8Array(readFileSync(path)));
  expect(looksLikeAbnAmro(pages[0].text)).toBe(true);
  return parseAbnAmro(pages);
}

describe('ABN AMRO PDF (nagemaakt voorbeeld)', async () => {
  const st = await load(FIXTURE);

  it('leest de kop', () => {
    expect(st.periodFrom).toBe('2026-03-01');
    expect(st.periodTo).toBe('2026-03-31');
    expect(st.openingBalance).toBe(100);
    expect(st.closingBalance).toBe(1142.54);
  });

  it('vindt alle transacties en de totalen kloppen', () => {
    expect(st.transactions).toHaveLength(6);
    expect(totalDebit(st)).toBe(1457.46);
    expect(totalCredit(st)).toBe(2500);
    expect(st.statedDebit).toBe(1457.46);
    expect(balanceOk(st)).toBe(true);
  });

  it('telt de samenvatting onderaan niet mee bij de laatste transactie', () => {
    const last = st.transactions[st.transactions.length - 1];
    expect(last.amount).toBe(-5.8);
    expect(last.kind).toBe('Bankkosten');
  });

  it('ontleedt de omschrijvingen', () => {
    const byDate = Object.fromEntries(st.transactions.map((t) => [t.date, t]));
    expect(byDate['2026-03-02']).toMatchObject({ kind: 'Betaalpas', name: 'Albert Heijn 1234', place: 'UTRECHT', amount: -42.1 });
    expect(byDate['2026-03-03']).toMatchObject({ kind: 'iDEAL', name: 'bol.com', iban: 'NL27INGB0000026500', amount: -1234.56 });
    expect(byDate['2026-03-05']).toMatchObject({ kind: 'Incasso', name: 'Energiebedrijf' });
    expect(byDate['2026-03-25'].amount).toBe(2500);
  });

  it('maakt stabiele, unieke ids', async () => {
    const ids = await Promise.all(st.transactions.map(transactionId));
    expect(new Set(ids).size).toBe(ids.length);
    const again = await load(FIXTURE);
    expect(await Promise.all(again.transactions.map(transactionId))).toEqual(ids);
  });

  it('deelt in: eigen rekening, geleerde regel en voorstel', () => {
    const byDate = Object.fromEntries(st.transactions.map((t) => [t.date, t]));
    expect(categorize(byDate['2026-03-01'], [], new Set(['NL00ABNA0123456789']))).toMatchObject({ cat: 'eigen', by: 'regel' });
    expect(categorize(byDate['2026-03-03'], [{ match: 'bol.com', cat: 'overig' }], new Set())).toMatchObject({ cat: 'overig', by: 'regel' });
    const g = categorize(byDate['2026-03-02'], [], new Set());
    expect(g.cat).toBe('');
    expect(g.guess).toBe('boodschappen');
  });
});

describe('omschrijvingen', () => {
  it('SEPA-overboeking', () => {
    expect(parseDescription('SEPA Overboeking IBAN: NL00ABNA0123456789 BIC: ABNANL2A Naam: J JANSEN Kenmerk: NOTPROVIDED'))
      .toMatchObject({ kind: 'Overboeking', iban: 'NL00ABNA0123456789', name: 'J JANSEN' });
  });
});

// Alleen lokaal: REAL_PDF=/pad/naar/afschrift.pdf npm test — het echte afschrift komt nooit in git.
const real = process.env.REAL_PDF;
describe.runIf(real && existsSync(real))('echt afschrift (lokaal)', () => {
  it('saldo en totalen kloppen', async () => {
    const st = await load(real!);
    console.log(`echt afschrift: ${st.transactions.length} transacties, af ${totalDebit(st)} (afschrift ${st.statedDebit}), bij ${totalCredit(st)} (afschrift ${st.statedCredit})`);
    expect(balanceOk(st)).toBe(true);
  });
});
