import { useMemo } from 'react';
import { useData } from './data';
import { CATEGORIES, type Category, type GroupId } from './categories';
import type { Household } from './types';

/**
 * Bedragen per categorie per maand. Leidend is `budgetAmounts`; bestaat dat nog niet
 * (oudere gegevens), dan worden de oude percentages omgerekend met het inkomen.
 */
export function budgetAmounts(h: Household | null): Record<string, number> {
  if (!h) return {};
  if (h.budgetAmounts) return h.budgetAmounts;
  const inc = h.income || 0;
  return Object.fromEntries(Object.entries(h.budget ?? {}).map(([k, p]) => [k, Math.round((inc * (p ?? 0)) / 100)]));
}

/** Alle categorieën: standaard + eigen, met verborgen standaardcategorieën eruit. */
export function useCategories() {
  const { household } = useData();
  return useMemo(() => {
    const hiddenKeys = new Set(household?.hiddenCategories ?? []);
    const all: Category[] = [
      ...CATEGORIES.map((c) => ({ ...c, custom: false })),
      ...(household?.customCategories ?? []).map((c) => ({ ...c, custom: true })),
    ];
    const visible = all.filter((c) => !hiddenKeys.has(c.key));
    const names: Record<string, string> = {
      inkomen: 'Inkomen',
      eigen: 'Eigen rekening (telt niet mee)',
      ...Object.fromEntries(all.map((c) => [c.key, c.name])),
    };
    const groupOf = (key: string): GroupId | null => all.find((c) => c.key === key)?.group ?? null;
    /** Opties voor keuzelijsten bij transacties. */
    const txOptions: [string, string][] = [['inkomen', names.inkomen], ['eigen', names.eigen], ...visible.map((c) => [c.key, c.name] as [string, string])];
    const groupSums = (amounts: Record<string, number>) => {
      const t: Record<GroupId, number> = { vast: 0, leven: 0, sparen: 0 };
      visible.forEach((c) => { t[c.group] += amounts[c.key] ?? 0; });
      return t;
    };
    return { all, visible, hidden: all.filter((c) => hiddenKeys.has(c.key)), names, groupOf, txOptions, groupSums };
  }, [household]);
}
