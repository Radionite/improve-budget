import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PageHead } from '../components/Layout';
import { NumberInput } from '../components/Fields';
import { Icon } from '../components/Icon';
import { useData } from '../lib/data';
import { useCommitments } from '../lib/commitments';
import { GROUPS, type Category, type GroupId } from '../lib/categories';
import { useCategories } from '../lib/useCategories';
import { useBudgetAmounts } from '../lib/useBudget';
import { budgetIncome, incomeSources, type IncomeSource } from '../lib/income';
import { IncomeCard } from '../components/IncomeCard';
import { euro, pct } from '../lib/format';

const LINK_SOURCE: Record<string, string> = { studieschuld: 'Studie & leningen', wonen: 'Studie & leningen', lening: 'Studie & leningen', studiekind: 'Studie & leningen' };

/** Percentage tonen: hele getallen zonder decimaal, anders 1 decimaal. */
const p = (n: number) => pct(n, Math.abs(n - Math.round(n)) < 0.05 ? 0 : 1);
const round1 = (n: number) => Math.round(n * 10) / 10;
const cents = (n: number) => Math.round(n * 100) / 100;

export function BudgetPage() {
  const { household, update } = useData();
  const { monthly } = useCommitments();
  const cats = useCategories();
  const { amounts: stored, linked } = useBudgetAmounts();
  const [draft, setDraft] = useState<Record<string, number>>(stored);
  const storedSources = useMemo(() => incomeSources(household), [household]);
  const [sources, setSources] = useState<IncomeSource[]>(storedSources);
  const income = budgetIncome(sources);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(stored); }, [stored]);
  useEffect(() => { setSources(storedSources); }, [storedSources]);

  if (!household) return null;

  const share = (amount: number) => (income ? (amount / income) * 100 : 0);
  const sum = cats.visible.reduce((s, c) => s + (draft[c.key] ?? 0), 0);
  const left = cents(income - sum);
  const groups = cats.groupSums(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored) || JSON.stringify(sources) !== JSON.stringify(storedSources);

  const setAmount = (key: string, v: number) => {
    const next = { ...draft, [key]: cents(Math.max(0, v)) };
    setDraft(next);
    // Zelf een bedrag invullen bij een gekoppelde categorie: koppeling loslaten en meteen bewaren.
    if (linked.has(key) && Math.abs(next[key] - (stored[key] ?? 0)) >= 0.5) {
      update({ unlinkedCategories: [...(household.unlinkedCategories ?? []), key], budgetAmounts: next, income, incomeSources: sources });
    }
  };
  const relink = (key: string) =>
    update({ unlinkedCategories: (household.unlinkedCategories ?? []).filter((k) => k !== key), budgetAmounts: draft, income, incomeSources: sources });
  const save = async () => {
    await update({ budgetAmounts: draft, income, incomeSources: sources });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addCategory = async (group: GroupId, name: string) => {
    const key = `c_${Math.random().toString(36).slice(2, 8)}`;
    await update({ customCategories: [...(household.customCategories ?? []), { key, name, group }], budgetAmounts: draft, income, incomeSources: sources });
  };
  const removeCategory = async (c: Category) => {
    const amountNote = (draft[c.key] ?? 0) > 0 ? ` Het bedrag van ${euro(draft[c.key])} vervalt.` : '';
    if (!confirm(`Categorie "${c.name}" verwijderen?${amountNote}`)) return;
    const next = { ...draft };
    delete next[c.key];
    setDraft(next);
    if (c.custom) {
      await update({ customCategories: (household.customCategories ?? []).filter((x) => x.key !== c.key), budgetAmounts: next, income, incomeSources: sources });
    } else {
      await update({ hiddenCategories: [...(household.hiddenCategories ?? []), c.key], budgetAmounts: next, income, incomeSources: sources });
    }
  };
  const showCategory = (key: string) => update({ hiddenCategories: (household.hiddenCategories ?? []).filter((k) => k !== key), budgetAmounts: draft, income, incomeSources: sources });

  return (
    <>
      <PageHead eyebrow="Maandbudget" title="Budget verdelen">
        <button className="btn primary" onClick={save} disabled={!dirty}>{saved ? 'Opgeslagen' : 'Opslaan'}</button>
      </PageHead>

      <IncomeCard sources={sources} onChange={setSources} />

      <section className="card" aria-label="Inkomen en verdeling">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 4 }}>
            <span className="small muted">Te verdelen per maand</span>
            <span className="display strong" style={{ fontSize: 28 }}>{euro(income)}</span>
            <a href="#h-inkomsten" className="tiny">Inkomsten aanpassen</a>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="small muted">Verdeeld</span>
            <span className="display strong" style={{ fontSize: 28 }}>{euro(sum)} <span className="small muted">{p(share(sum))}</span></span>
            {Math.abs(left) < 0.5 && <span className="pill green">Alles is verdeeld</span>}
            {left >= 0.5 && <span className="pill orange">Nog {euro(left)} te verdelen</span>}
            {left <= -0.5 && <span className="pill red">{euro(-left)} te veel verdeeld</span>}
          </div>
        </div>
        <div className="stacked" role="img" aria-label="Verdeling over vaste lasten, leven en sparen">
          {GROUPS.map((g) => <span key={g.id} style={{ flex: `0 0 ${Math.min(share(groups[g.id]), 100)}%`, background: g.color }} />)}
        </div>
        <div className="grid">
          {GROUPS.map((g) => (
            <div key={g.id} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span className="dot" style={{ background: g.color, marginTop: 4 }} />
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{g.name}</span>
                <span className="small muted">{euro(groups[g.id])} · {p(share(groups[g.id]))}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {GROUPS.map((g) => (
        <section key={g.id} className="card" aria-label={g.name} style={{ gap: 0 }}>
          <div className="card-head" style={{ paddingBottom: 12 }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="dot" style={{ background: g.color, width: 14, height: 14 }} />
              <div className="stack" style={{ gap: 2 }}><h2>{g.name}</h2><span className="small muted">{g.desc}</span></div>
            </div>
            <span><span className="display strong" style={{ fontSize: 22 }}>{euro(groups[g.id])}</span> <span className="small muted">{p(share(groups[g.id]))}</span></span>
          </div>
          <ul className="list">
            {cats.visible.filter((c) => c.group === g.id).map((c) => (
              <CategoryRow key={c.key} cat={c} amount={draft[c.key] ?? 0} income={income} known={(monthly as Record<string, number | undefined>)[c.key]} linked={linked.has(c.key)}
                onChange={(v) => setAmount(c.key, v)} onRelink={() => relink(c.key)} onRemove={() => removeCategory(c)} />
            ))}
          </ul>
          <AddCategory onAdd={(name) => addCategory(g.id, name)} />
        </section>
      ))}

      {cats.hidden.length > 0 && (
        <details className="small muted">
          <summary style={{ cursor: 'pointer', minHeight: 32 }}>Verwijderde standaardcategorie terugzetten ({cats.hidden.length})</summary>
          <div className="row" style={{ marginTop: 10 }}>
            {cats.hidden.map((c) => <button key={c.key} type="button" className="btn" onClick={() => showCategory(c.key)}><Icon name="plus" size={16} />{c.name}</button>)}
          </div>
        </details>
      )}

      <p className="small muted" style={{ maxWidth: 780 }}>
        Vul per categorie een bedrag of een percentage in; het bedrag wordt bewaard. Een verwijderde categorie verdwijnt ook uit de bankimport.
      </p>
    </>
  );
}

function CategoryRow({ cat, amount, income, known, linked, onChange, onRelink, onRemove }: {
  cat: Category; amount: number; income: number; known?: number; linked: boolean; onChange: (v: number) => void; onRelink: () => void; onRemove: () => void;
}) {
  const id = `r-${cat.key}`;
  const share = income ? (amount / income) * 100 : 0;
  return (
    <li className="cat-row">
      <div className="stack cat-name" style={{ flex: '1 1 220px', gap: 2 }}>
        <span className="row" style={{ gap: 8 }}><label htmlFor={id}>{cat.name}</label>{cat.custom && <span className="pill gray">eigen</span>}</span>
        {linked ? (
          <span className="tiny" style={{ color: 'var(--green)' }} title="Wordt automatisch bijgewerkt. Vul zelf een bedrag in om de koppeling los te laten.">
            <Icon name="check" size={12} /> Automatisch uit {LINK_SOURCE[cat.key] ?? 'Huishouden'}
          </span>
        ) : known ? (
          <span className="tiny muted">
            Vastgelegd: {euro(known)} per maand · zelf ingevuld
            <button type="button" className="btn ghost tiny" style={{ minHeight: 28, padding: '0 6px' }} onClick={onRelink}>weer koppelen</button>
          </span>
        ) : null}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        <span className="muted">€</span>
        <NumberInput id={id} value={amount} min={0} step={10} onChange={onChange} style={{ width: 110, textAlign: 'right' }} />
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        <NumberInput ariaLabel={`${cat.name} in procent van het inkomen`} value={round1(share)} min={0} max={100} step={1}
          onChange={(v) => income > 0 && onChange(Math.round((income * v) / 100))} style={{ width: 76, textAlign: 'right' }} />
        <span className="muted">%</span>
      </div>
      <div className="row cat-actions" style={{ gap: 4, flexWrap: 'nowrap' }}>
      <button type="button" className="btn icon" aria-label={`${cat.name} verwijderen`} title="Categorie verwijderen" onClick={onRemove}><Icon name="x" size={16} /></button>
      </div>
    </li>
  );
}

function AddCategory({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd(name.trim());
    setName('');
    setOpen(false);
  };
  if (!open) {
    return <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start', marginTop: 8, marginLeft: -12 }} onClick={() => setOpen(true)}><Icon name="plus" size={16} />Categorie toevoegen</button>;
  }
  return (
    <form className="row" style={{ marginTop: 12 }} onSubmit={submit}>
      <input className="input" style={{ maxWidth: 280 }} aria-label="Naam nieuwe categorie" placeholder="Bijv. Sportschool" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn primary" disabled={!name.trim()}>Toevoegen</button>
      <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Annuleren</button>
    </form>
  );
}
