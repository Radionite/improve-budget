import { useData } from '../lib/data';
import { useBudgetAmounts } from '../lib/useBudget';
import { useCategories } from '../lib/useCategories';
import { euro } from '../lib/format';
import { Icon } from './Icon';

/**
 * Laat zien of de kosten van dit onderdeel in het budget staan, en stuurt ze er zo nodig heen.
 * Gebruikt in Huishouden en Studie & leningen.
 */
export function BudgetLink({ keys }: { keys: string[] }) {
  const { household, update } = useData();
  const { amounts, linked, known } = useBudgetAmounts();
  const cats = useCategories();
  const rows = keys.filter((k) => known[k] > 0);
  if (!household || !rows.length) return null;

  const sendToBudget = (k: string) =>
    update({
      unlinkedCategories: (household.unlinkedCategories ?? []).filter((x) => x !== k),
      hiddenCategories: (household.hiddenCategories ?? []).filter((x) => x !== k),
    });

  return (
    <div className="budget-link">
      {rows.map((k) => (
        <div key={k} className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
          <span className="small">
            <span className="muted">Budget · </span>{cats.names[k] ?? k}: <strong>{euro(known[k])}</strong> per maand
          </span>
          {linked.has(k) && !(household.hiddenCategories ?? []).includes(k)
            ? <span className="pill green" title="Wijzigingen hier worden automatisch in het budget overgenomen"><Icon name="check" size={12} />automatisch in budget</span>
            : (
              <span className="row" style={{ gap: 8 }}>
                <span className="tiny muted">in budget: {euro(amounts[k] ?? 0)} (zelf ingevuld)</span>
                <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => sendToBudget(k)}><Icon name="arrow" size={16} />Naar budget sturen</button>
              </span>
            )}
        </div>
      ))}
    </div>
  );
}
