import { CATEGORIES, type CategoryKey, type GroupId } from './categories';

export type Situation = { adults: number; kids: number; pets: boolean; cars: number };
export type BudgetPct = Partial<Record<CategoryKey, number>>;

export const groupTotals = (pcts: BudgetPct): Record<GroupId, number> => {
  const t: Record<GroupId, number> = { vast: 0, leven: 0, sparen: 0 };
  CATEGORIES.forEach((c) => { t[c.group] += pcts[c.key] ?? 0; });
  return t;
};

export const totalPct = (pcts: BudgetPct) => CATEGORIES.reduce((s, c) => s + (pcts[c.key] ?? 0), 0);

export const situationName = (s: Situation) => {
  let name = s.kids > 0 ? (s.adults <= 1 ? 'Eenoudergezin' : 'Gezin met kinderen') : s.adults <= 1 ? 'Alleenstaand' : 'Samenwonend';
  if (s.pets) name += ' en huisdieren';
  name += s.cars === 0 ? ', zonder auto' : s.cars === 1 ? ', 1 auto' : `, ${s.cars} auto's`;
  return name;
};

/** Maandbedrag van een annuïtaire lening. */
export const annuity = (balance: number, yearlyRatePct: number, months: number) => {
  const r = yearlyRatePct / 100 / 12;
  if (months <= 0) return balance;
  return r === 0 ? balance / months : (balance * r) / (1 - Math.pow(1 + r, -months));
};

/** Simuleert aflossen met een vaste termijn plus extra per maand. */
export const simulateLoan = (balance: number, yearlyRatePct: number, payment: number, extra: number, maxMonths = 600) => {
  const r = yearlyRatePct / 100 / 12;
  let b = balance;
  let months = 0;
  let interest = 0;
  const yearly: number[] = [balance];
  while (b > 0.5 && months < maxMonths) {
    const i = b * r;
    interest += i;
    b = b + i - payment - extra;
    months++;
    if (months % 12 === 0) yearly.push(Math.max(0, b));
  }
  return { months, interest, yearly };
};

/** Toekomstige waarde bij maandelijkse inleg en rente-op-rente. */
export const futureValue = (start: number, monthly: number, yearlyRatePct: number, months: number) => {
  const r = yearlyRatePct / 100 / 12;
  const g = Math.pow(1 + r, months);
  return start * g + monthly * (r === 0 ? months : (g - 1) / r);
};

export const neededMonthly = (start: number, goal: number, yearlyRatePct: number, months: number) => {
  if (months <= 0) return Math.max(0, goal - start);
  const r = yearlyRatePct / 100 / 12;
  const g = Math.pow(1 + r, months);
  return Math.max(0, (goal - start * g) * (r === 0 ? 1 / months : r / (g - 1)));
};
