import { CATEGORIES, type CategoryKey, type GroupId } from './categories';

export type Situation = { adults: number; kids: number; pets: boolean; cars: number };
export type BudgetPct = Partial<Record<CategoryKey, number>>;

const KEYS: CategoryKey[] = ['wonen', 'energie', 'verzekering', 'abo', 'vervoer', 'opvang', 'boodschappen', 'dieren', 'kleding', 'verzorging', 'vrijetijd', 'zakouders', 'zakkind', 'overig', 'buffer', 'beleggen', 'vakantie', 'aankopen'];
const PROFILES: Record<'alleen' | 'stel' | 'gezin', number[]> = {
  alleen: [30, 6, 5, 3, 5, 0, 10, 0, 3, 2, 7, 5, 0, 2, 7, 8, 5, 2],
  stel: [27, 5, 5, 3, 5, 0, 11, 0, 3, 2, 6, 6, 0, 2, 7, 10, 5, 3],
  gezin: [26, 6, 5, 3, 5, 5, 14, 0, 4, 2, 4, 4, 2, 2, 6, 6, 4, 2],
};

/**
 * Aanbevolen verdeling (in hele procenten, samen 100) voor een situatie.
 * Vaste verplichtingen (aflossingen, studiesparen) gaan voor; de rest schuift op.
 * Dit is een vertrekpunt, geen officieel advies.
 */
export function recommend(s: Situation, fixed: { studieschuld: number; lening: number }): Record<CategoryKey, number> {
  const base = s.kids > 0 ? PROFILES.gezin : s.adults <= 1 ? PROFILES.alleen : PROFILES.stel;
  const r = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Record<CategoryKey, number>;
  KEYS.forEach((k, i) => { r[k] = base[i]; });
  if (s.kids >= 3) { r.boodschappen += 2; r.zakkind += 1; r.beleggen -= 2; r.vrijetijd -= 1; }
  if (s.pets) { r.dieren += 3; r.vrijetijd -= 1; r.beleggen -= 1; r.vakantie -= 1; }
  if (s.cars === 0) { r.vervoer -= 2; r.beleggen += 1; r.buffer += 1; }
  if (s.cars === 1) { r.vervoer += 3; r.vrijetijd -= 1; r.vakantie -= 1; r.beleggen -= 1; }
  if (s.cars >= 2) { r.vervoer += 7; r.vrijetijd -= 2; r.vakantie -= 2; r.beleggen -= 2; r.aankopen -= 1; }

  const must: Partial<Record<CategoryKey, number>> = {
    studieschuld: Math.round(fixed.studieschuld),
    lening: Math.round(fixed.lening),
    studiekind: s.kids > 0 ? 3 : 0,
  };
  let need = 0;
  (Object.keys(must) as CategoryKey[]).forEach((k) => { r[k] = must[k] ?? 0; need += r[k]; });
  const order: [CategoryKey, number][] = [['vakantie', 1], ['aankopen', 1], ['vrijetijd', 1], ['overig', 1], ['beleggen', 1], ['buffer', 3], ['kleding', 2], ['boodschappen', 8], ['wonen', 20]];
  for (const [k, min] of order) {
    if (need <= 0) break;
    const t = Math.min(Math.max(0, r[k] - min), need);
    r[k] -= t;
    need -= t;
  }
  return r;
}

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
