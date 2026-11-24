import { useMemo } from 'react';
import { useData } from './data';
import { useCommitments } from './commitments';
import { budgetAmounts } from './useCategories';

/**
 * Budgetcategorieën die automatisch volgen wat in Huishouden en Studie & leningen staat
 * (zakgeld, kleedgeld, huisdieren, voertuigen, leningen, studiesparen).
 */
export const LINKABLE = ['zakouders', 'zakkind', 'kleding', 'dieren', 'vervoer', 'studiekind', 'studieschuld', 'wonen', 'lening'] as const;

/**
 * Budgetbedragen zoals ze gelden: gekoppelde categorieën nemen het vastgelegde bedrag over,
 * tenzij de gebruiker die categorie zelf heeft ingevuld (ontkoppeld).
 */
export function useBudgetAmounts() {
  const { household } = useData();
  const { monthly } = useCommitments();
  return useMemo(() => {
    const amounts = { ...budgetAmounts(household) };
    const unlinked = new Set(household?.unlinkedCategories ?? []);
    const known: Record<string, number> = {};
    const linked = new Set<string>();
    for (const key of LINKABLE) {
      const k = Math.round((monthly as Record<string, number | undefined>)[key] ?? 0);
      if (k <= 0) continue;
      known[key] = k;
      if (!unlinked.has(key)) {
        amounts[key] = k;
        linked.add(key);
      }
    }
    return { amounts, linked, known, unlinked };
  }, [household, monthly]);
}
