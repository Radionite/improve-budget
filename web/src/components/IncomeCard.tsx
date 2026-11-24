import { NumberInput } from './Fields';
import { Icon } from './Icon';
import { budgetIncome, extrasInMonth, extrasPerYear, FREQ_LABEL, MONTHS, perMonth, PRESETS, type IncomeFrequency, type IncomeSource } from '../lib/income';
import { euro } from '../lib/format';

const newId = () => `i_${Math.random().toString(36).slice(2, 8)}`;

export function IncomeCard({ sources, onChange }: { sources: IncomeSource[]; onChange: (s: IncomeSource[]) => void }) {
  const set = (id: string, patch: Partial<IncomeSource>) => onChange(sources.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (s: IncomeSource) => {
    if (s.amount > 0 && !confirm(`Inkomen "${s.name}" verwijderen?`)) return;
    onChange(sources.filter((x) => x.id !== s.id));
  };
  const add = (preset?: Omit<IncomeSource, 'id'>) =>
    onChange([...sources, { id: newId(), ...(preset ?? { name: 'Nieuw inkomen', amount: 0, freq: 'maand', spread: true }) }]);
  const missing = PRESETS.filter((p) => !sources.some((s) => s.name.toLowerCase() === p.name.toLowerCase()));
  const monthlyBudget = budgetIncome(sources);
  const extras = extrasPerYear(sources);
  const now = new Date().getMonth() + 1;

  return (
    <section className="card" aria-labelledby="h-inkomsten">
      <div className="card-head">
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="h-inkomsten">Inkomsten</h2>
          <span className="small muted">Netto bedragen. Per kwartaal en per jaar worden omgerekend naar een gemiddelde per maand.</span>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 2 }}>
          <span className="small muted">Voor het maandbudget</span>
          <span className="display strong" style={{ fontSize: 24 }}>{euro(monthlyBudget)} <span className="small muted">per maand</span></span>
          {extras > 0 && <span className="tiny muted">+ {euro(extras)} per jaar aan extra's apart</span>}
        </div>
      </div>

      <ul className="list">
        {sources.map((s) => (
          <li key={s.id} className="income-row">
            <div className="field income-name">
              <label htmlFor={`in-n-${s.id}`} className="sr-only">Naam inkomen</label>
              <input id={`in-n-${s.id}`} className="input" value={s.name} onChange={(e) => set(s.id, { name: e.target.value })} />
            </div>
            <div className="row income-amt" style={{ gap: 6, flexWrap: 'nowrap' }}>
              <span className="muted">€</span>
              <NumberInput ariaLabel={`${s.name}: bedrag per keer`} value={s.amount} min={0} step={10} onChange={(v) => set(s.id, { amount: Math.round(v * 100) / 100 })} style={{ width: 110, textAlign: 'right' }} />
            </div>
            <select className="input income-freq" aria-label={`${s.name}: hoe vaak`} value={s.freq} style={{ width: 150 }}
              onChange={(e) => set(s.id, { freq: e.target.value as IncomeFrequency, month: s.month ?? (e.target.value === 'jaar' ? 5 : 1) })}>
              {(Object.keys(FREQ_LABEL) as IncomeFrequency[]).map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
            </select>
            {s.freq === 'maand' ? <span className="income-when muted small">elke maand</span> : (
              <select className="input income-when" aria-label={`${s.name}: in welke maand`} value={s.freq === 'kwartaal' ? ((s.month ?? 1) - 1) % 3 + 1 : s.month ?? 1} style={{ width: 170 }}
                onChange={(e) => set(s.id, { month: Number(e.target.value) })}>
                {s.freq === 'kwartaal'
                  ? [1, 2, 3].map((m) => <option key={m} value={m}>{[m, m + 3, m + 6, m + 9].map((x) => MONTHS[x - 1]).join(', ')}</option>)
                  : MONTHS.map((n, i) => <option key={n} value={i + 1}>in {n}</option>)}
              </select>
            )}
            <div className="income-extra">
              {s.freq !== 'maand' && (
                <label className="check small" style={{ minHeight: 36 }} title="Uit: niet in het maandbudget, maar als extraatje apart">
                  <input type="checkbox" checked={s.spread} onChange={(e) => set(s.id, { spread: e.target.checked })} />In maandbudget
                </label>
              )}
              <span className="small muted nowrap">≈ {euro(perMonth(s))} p/m</span>
            </div>
            <button type="button" className="btn icon income-del" aria-label={`${s.name} verwijderen`} onClick={() => remove(s)}><Icon name="x" size={16} /></button>
          </li>
        ))}
      </ul>

      <div className="row">
        <button type="button" className="btn" onClick={() => add()}><Icon name="plus" size={16} />Inkomen</button>
        {missing.map((p) => <button key={p.name} type="button" className="btn ghost" onClick={() => add(p)}><Icon name="plus" size={16} />{p.name}</button>)}
      </div>

      {sources.some((s) => s.freq !== 'maand') && (
        <div className="stack">
          <span className="label">Wanneer komt er extra binnen?</span>
          <div className="months" role="list" aria-label="Extra inkomsten per maand">
            {MONTHS.map((n, i) => {
              const ex = extrasInMonth(sources, i + 1);
              const total = ex.reduce((sum, e) => sum + e.amount, 0);
              return (
                <div key={n} role="listitem" className={`month${ex.length ? ' has' : ''}${i + 1 === now ? ' now' : ''}`} title={ex.map((e) => `${e.name}: ${euro(e.amount)}`).join('\n')}>
                  <span className="tiny muted">{n}</span>
                  <strong className="small">{ex.length ? euro(total) : '–'}</strong>
                  {ex.length > 0 && <span className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.map((e) => e.name).join(', ')}</span>}
                </div>
              );
            })}
          </div>
          <p className="tiny muted">Tip: zet vakantiegeld en de 13e maand uit "maandbudget" en reserveer ze voor bijvoorbeeld vakantie, grote aankopen of extra aflossen.</p>
        </div>
      )}
    </section>
  );
}
