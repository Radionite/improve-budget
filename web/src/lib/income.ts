import type { Household } from './types';

export type IncomeFrequency = 'maand' | 'kwartaal' | 'jaar';

export type IncomeSource = {
  id: string;
  name: string;
  amount: number; // netto bedrag per keer
  freq: IncomeFrequency;
  /** Uitbetaalmaand (1-12). Bij kwartaal: de eerste van de vier maanden. */
  month?: number;
  /** Meetellen in het maandbudget (verdeeld over het jaar). Uit = extraatje dat je apart bestemt. */
  spread: boolean;
};

export const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const FREQ_LABEL: Record<IncomeFrequency, string> = { maand: 'Per maand', kwartaal: 'Per kwartaal', jaar: 'Per jaar' };

/** Voorbeelden om snel toe te voegen. Bedragen vul je zelf in. */
export const PRESETS: Omit<IncomeSource, 'id'>[] = [
  { name: 'Kinderbijslag', amount: 0, freq: 'kwartaal', month: 1, spread: true },
  { name: 'Vakantiegeld', amount: 0, freq: 'jaar', month: 5, spread: false },
  { name: '13e maand', amount: 0, freq: 'jaar', month: 12, spread: false },
  { name: 'Kindgebonden budget', amount: 0, freq: 'maand', spread: true },
];

/** Gemiddeld bedrag per maand. */
export const perMonth = (s: IncomeSource) => (s.freq === 'maand' ? s.amount : s.freq === 'kwartaal' ? (s.amount * 4) / 12 : s.amount / 12);

/** In welke maanden (1-12) komt dit binnen? */
export const paidMonths = (s: IncomeSource): number[] => {
  if (s.freq === 'maand') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const m = Math.min(12, Math.max(1, s.month ?? 1));
  if (s.freq === 'jaar') return [m];
  const first = ((m - 1) % 3) + 1;
  return [first, first + 3, first + 6, first + 9];
};

/** Inkomen voor het maandbudget: vaste maandinkomsten plus wat over het jaar wordt verdeeld. */
export const budgetIncome = (sources: IncomeSource[]) =>
  Math.round(sources.reduce((sum, s) => sum + (s.freq === 'maand' || s.spread ? perMonth(s) : 0), 0) * 100) / 100;

/** Extra's die niet in het maandbudget zitten, per jaar. */
export const extrasPerYear = (sources: IncomeSource[]) =>
  sources.filter((s) => s.freq !== 'maand' && !s.spread).reduce((sum, s) => sum + perMonth(s) * 12, 0);

/** Wat er in een bepaalde maand binnenkomt bovenop het vaste maandinkomen. */
export const extrasInMonth = (sources: IncomeSource[], month: number) =>
  sources.filter((s) => s.freq !== 'maand' && paidMonths(s).includes(month)).map((s) => ({ name: s.name, amount: s.amount, spread: s.spread }));

/** Inkomsten van een huishouden; oudere gegevens hebben alleen één inkomensbedrag. */
export function incomeSources(h: Household | null): IncomeSource[] {
  if (!h) return [];
  if (h.incomeSources) return h.incomeSources;
  return h.income ? [{ id: 'salaris', name: 'Netto salaris', amount: h.income, freq: 'maand', spread: true }] : [];
}
