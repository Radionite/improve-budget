import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { NumberInput, Segmented } from '../components/Fields';
import { Icon } from '../components/Icon';
import { useData } from '../lib/data';
import { useCommitments } from '../lib/commitments';
import { GROUPS, type Category, type GroupId } from '../lib/categories';
import { recommend, situationName, type Situation } from '../lib/budget';
import { budgetAmounts, useCategories } from '../lib/useCategories';
import { budgetIncome, incomeSources, type IncomeSource } from '../lib/income';
import { IncomeCard } from '../components/IncomeCard';
import { euro, pct } from '../lib/format';

/** Percentage tonen: hele getallen zonder decimaal, anders 1 decimaal. */
const p = (n: number) => pct(n, Math.abs(n - Math.round(n)) < 0.05 ? 0 : 1);
const round1 = (n: number) => Math.round(n * 10) / 10;
const cents = (n: number) => Math.round(n * 100) / 100;

export function BudgetPage() {
  const { household, update } = useData();
  const { monthly, derived } = useCommitments();
  const cats = useCategories();
  const stored = useMemo(() => budgetAmounts(household), [household]);
  const [draft, setDraft] = useState<Record<string, number>>(stored);
  const storedSources = useMemo(() => incomeSources(household), [household]);
  const [sources, setSources] = useState<IncomeSource[]>(storedSources);
  const income = budgetIncome(sources);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(stored); }, [stored]);
  useEffect(() => { setSources(storedSources); }, [storedSources]);

  const situation: Situation = derived ?? household?.situation ?? { adults: 2, kids: 0, pets: false, cars: 0 };
  const rec = useMemo(() => recommend(situation, {
    studieschuld: income ? ((monthly.studieschuld ?? 0) / income) * 100 : 0,
    lening: income ? ((monthly.lening ?? 0) / income) * 100 : 0,
  }), [situation, income, monthly.studieschuld, monthly.lening]) as Record<string, number>;

  if (!household) return null;

  const share = (amount: number) => (income ? (amount / income) * 100 : 0);
  const sum = cats.visible.reduce((s, c) => s + (draft[c.key] ?? 0), 0);
  const left = cents(income - sum);
  const groups = cats.groupSums(draft);
  const recGroups: Record<GroupId, number> = { vast: 0, leven: 0, sparen: 0 };
  cats.visible.forEach((c) => { if (!c.custom) recGroups[c.group] += rec[c.key] ?? 0; });
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored) || JSON.stringify(sources) !== JSON.stringify(storedSources);

  const setAmount = (key: string, v: number) => setDraft({ ...draft, [key]: cents(Math.max(0, v)) });
  const save = async () => {
    await update({ budgetAmounts: draft, income, incomeSources: sources });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const applyAdvice = () => {
    const next = { ...draft };
    cats.visible.filter((c) => !c.custom).forEach((c) => { next[c.key] = Math.round((income * (rec[c.key] ?? 0)) / 100); });
    setDraft(next);
  };
  const setSituation = (patch: Partial<Situation>) => update({ situation: { ...situation, ...patch } });

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
        <button className="btn" onClick={applyAdvice} title="Zet alle standaardcategorieën op het advies">Advies overnemen</button>
        <button className="btn primary" onClick={save} disabled={!dirty}>{saved ? 'Opgeslagen' : 'Opslaan'}</button>
      </PageHead>

      <section className="card" aria-labelledby="h-sit">
        <div className="card-head">
          <div className="stack" style={{ gap: 4 }}>
            <h2 id="h-sit">Jouw situatie</h2>
            <span className="small muted">Het advies past zich aan op je gezin. Nu: <strong className="strong">{situationName(situation)}</strong></span>
          </div>
          <Link to="/huishouden" className="small">Huishouden beheren</Link>
        </div>
        {derived ? (
          <p className="small muted">Je situatie volgt automatisch uit de gezinsleden, huisdieren en voertuigen in Huishouden.</p>
        ) : (
          <div className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
            <Segmented label="Volwassenen" value={situation.adults} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} onChange={(v) => setSituation({ adults: v })} />
            <Segmented label="Kinderen" value={situation.kids} options={[0, 1, 2, 3].map((n) => ({ value: n, label: n === 0 ? 'Geen' : n === 3 ? '3+' : String(n) }))} onChange={(v) => setSituation({ kids: v })} />
            <Segmented label="Huisdieren" value={situation.pets} options={[{ value: false, label: 'Nee' }, { value: true, label: 'Ja' }]} onChange={(v) => setSituation({ pets: v })} />
            <Segmented label="Auto's" value={Math.min(situation.cars, 2)} options={[{ value: 0, label: 'Geen' }, { value: 1, label: '1' }, { value: 2, label: '2+' }]} onChange={(v) => setSituation({ cars: v })} />
          </div>
        )}
      </section>

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
                <span className="small muted">{euro(groups[g.id])} · {p(share(groups[g.id]))} · advies {p(recGroups[g.id])}</span>
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
            <span><span className="display strong" style={{ fontSize: 22 }}>{euro(groups[g.id])}</span> <span className="small muted">{p(share(groups[g.id]))} · advies {p(recGroups[g.id])}</span></span>
          </div>
          <ul className="list">
            {cats.visible.filter((c) => c.group === g.id).map((c) => (
              <CategoryRow key={c.key} cat={c} amount={draft[c.key] ?? 0} income={income} rec={c.custom ? null : rec[c.key] ?? 0} known={(monthly as Record<string, number | undefined>)[c.key]}
                onChange={(v) => setAmount(c.key, v)} onRemove={() => removeCategory(c)} />
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
        Vul per categorie een bedrag of een percentage in; het bedrag wordt bewaard. Het advies is een vertrekpunt op basis van je gezinssituatie,
        geen officieel advies. Eigen categorieën hebben geen advies. Een verwijderde categorie verdwijnt ook uit de bankimport.
      </p>
    </>
  );
}

function CategoryRow({ cat, amount, income, rec, known, onChange, onRemove }: {
  cat: Category; amount: number; income: number; rec: number | null; known?: number; onChange: (v: number) => void; onRemove: () => void;
}) {
  const id = `r-${cat.key}`;
  const share = income ? (amount / income) * 100 : 0;
  return (
    <li className="cat-row">
      <div className="stack cat-name" style={{ flex: '1 1 220px', gap: 2 }}>
        <span className="row" style={{ gap: 8 }}><label htmlFor={id}>{cat.name}</label>{cat.custom && <span className="pill gray">eigen</span>}</span>
        {known ? (
          <span className="tiny muted">
            Vastgelegd: {euro(known)} per maand
            {Math.abs(known - amount) >= 0.5 && <button type="button" className="btn ghost tiny" style={{ minHeight: 28, padding: '0 6px' }} onClick={() => onChange(Math.round(known))}>overnemen</button>}
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
      <span style={{ width: 112, display: 'inline-flex', justifyContent: 'flex-end' }}>
        {rec === null ? <span className="tiny muted">geen advies</span>
          : Math.abs(share - rec) < 0.5
            ? <span className="pill green"><Icon name="check" size={12} />advies</span>
            : <button type="button" className="pill orange" style={{ border: 0, cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600 }} title={`Advies overnemen: ${euro((income * rec) / 100)}`} onClick={() => onChange(Math.round((income * rec) / 100))}>advies {p(rec)}</button>}
      </span>
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
