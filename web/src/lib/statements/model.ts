export type ParsedTransaction = {
  date: string; // ISO: 2026-01-31
  amount: number; // negatief = afschrijving, positief = bijschrijving
  raw: string; // volledige omschrijving zoals op het afschrift
  kind: string; // Betaalpas, Geldautomaat, iDEAL, Overboeking, Incasso, Bankkosten, Overig
  name: string; // tegenpartij
  iban: string;
  description: string;
  place: string;
  seq: number; // volgnummer bij exact gelijke transacties
};

export type ParsedStatement = {
  bank: string;
  account: string;
  periodFrom: string;
  periodTo: string;
  openingBalance: number | null;
  closingBalance: number | null;
  statedDebit: number | null; // 'Totaal afgeschreven' volgens het afschrift
  statedCredit: number | null; // 'Totaal bijgeschreven' volgens het afschrift
  transactions: ParsedTransaction[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.split(/\s+/).filter(Boolean).join(' ');

export const totalDebit = (st: ParsedStatement) => round2(-st.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
export const totalCredit = (st: ParsedStatement) => round2(st.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0));

/** Klopt het afschrift? Beginsaldo + bij − af = eindsaldo, en de totalen onderaan. null als er niets te controleren is. */
export function balanceOk(st: ParsedStatement): boolean | null {
  const checks: boolean[] = [];
  const debit = totalDebit(st);
  const credit = totalCredit(st);
  if (st.openingBalance !== null && st.closingBalance !== null) {
    checks.push(Math.abs(st.openingBalance + credit - debit - st.closingBalance) < 0.005);
  }
  if (st.statedDebit !== null) checks.push(Math.abs(st.statedDebit - debit) < 0.005);
  if (st.statedCredit !== null) checks.push(Math.abs(st.statedCredit - credit) < 0.005);
  return checks.length ? checks.every(Boolean) : null;
}

export function assignSequence(txs: ParsedTransaction[]) {
  const seen = new Map<string, number>();
  for (const t of txs) {
    const key = `${t.date}|${t.amount.toFixed(2)}|${norm(t.raw)}`;
    t.seq = seen.get(key) ?? 0;
    seen.set(key, t.seq + 1);
  }
}

/** Stabiele id, zodat dezelfde transactie nooit dubbel wordt opgeslagen. */
export async function transactionId(t: ParsedTransaction): Promise<string> {
  const key = `${t.date}|${t.amount.toFixed(2)}|${norm(t.raw)}|${t.seq}`;
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
