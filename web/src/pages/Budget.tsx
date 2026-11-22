import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { NumberInput, Segmented } from '../components/Fields';
import { Icon } from '../components/Icon';
import { useData } from '../lib/data';
import { useCommitments } from '../lib/commitments';
import { CATEGORIES, GROUPS, type CategoryKey } from '../lib/categories';
import { groupTotals, recommend, situationName, totalPct, type BudgetPct, type Situation } from '../lib/budget';
import { euro, num, pct } from '../lib/format';

export function BudgetPage() {
  const { household, update } = useData();
  const { monthly, derived } = useCommitments();
  const [draft, setDraft] = useState<BudgetPct>(household?.budget ?? {});
  const [income, setIncome] = useState(String(household?.income ?? 0));
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(household?.budget ?? {}); }, [household?.budget]);
  useEffect(() => { setIncome(String(household?.income ?? 0)); }, [household?.income]);

  const inc = num(income);
  const situation: Situation = derived ?? household?.situation ?? { adults: 2, kids: 0, pets: false, cars: 0 };
  const rec = useMemo(() => recommend(situation, {
    studieschuld: inc ? ((monthly.studieschuld ?? 0) / inc) * 100 : 0,
    lening: inc ? ((monthly.lening ?? 0) / inc) * 100 : 0,
  }), [situation, inc, monthly.studieschuld, monthly.lening]);

  if (!household) return null;
  const total = totalPct(draft);
  const groups = groupTotals(draft);
  const recGroups = groupTotals(rec);
  const dirty = JSON.stringify(draft) !== JSON.stringify(household.budget ?? {}) || inc !== household.income;

  const save = async () => {
    await update({ budget: draft, income: inc });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const setSituation = (patch: Partial<Situation>) => update({ situation: { ...situation, ...patch } });

  return (
    <>
      <PageHead eyebrow="Maandbudget" title="Budget verdelen">
        <button className="btn" onClick={() => setDraft({ ...rec })}>Advies overnemen</button>
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

      <section className="card" aria-label="Inkomen en verdeling">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="field" style={{ width: 240 }}>
            <label htmlFor="inc">Netto gezinsinkomen per maand (€)</label>
            <NumberInput id="inc" value={num(income)} min={0} step={50} onChange={(v) => setIncome(String(v))} style={{ fontSize: 22, fontWeight: 600 }} />
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="small muted">Verdeeld</span>
            <span className="display strong" style={{ fontSize: 28 }}>{p(total)}</span>
            {Math.abs(100 - total) < 0.05 && <span className="pill green">Alles is verdeeld</span>}
            {total < 99.95 && <span className="pill orange">Nog {p(100 - total)} te verdelen</span>}
            {total > 100.05 && <span className="pill red">{p(total - 100)} te veel verdeeld</span>}
          </div>
        </div>
        <div className="stacked" role="img" aria-label="Verdeling over vaste lasten, leven en sparen">
          {GROUPS.map((g) => <span key={g.id} style={{ flex: `0 0 ${Math.min(groups[g.id], 100)}%`, background: g.color }} />)}
        </div>
        <div className="grid">
          {GROUPS.map((g) => (
            <div key={g.id} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span className="dot" style={{ background: g.color, marginTop: 4 }} />
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{g.name}</span>
                <span className="small muted">{p(groups[g.id])} · {euro((inc * groups[g.id]) / 100)} · advies {p(recGroups[g.id])}</span>
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
            <span><span className="display strong" style={{ fontSize: 22 }}>{euro((inc * groups[g.id]) / 100)}</span> <span className="small muted">{p(groups[g.id])} · advies {p(recGroups[g.id])}</span></span>
          </div>
          <ul className="list">
            {CATEGORIES.filter((c) => c.group === g.id).map((c) => (
              <CategoryRow key={c.key} cat={c.key} name={c.name} value={draft[c.key] ?? 0} rec={rec[c.key]} income={inc} known={monthly[c.key]}
                onChange={(v) => setDraft({ ...draft, [c.key]: v })} />
            ))}
          </ul>
        </section>
      ))}

      <p className="small muted" style={{ maxWidth: 780 }}>
        Het advies is een vertrekpunt op basis van je gezinssituatie: meer boodschappen en opvang bij kinderen, een post voor huisdieren, meer voor vervoer per auto.
        Aflossingen en studiesparen gaan voor; de rest schuift daarvoor op. Het is geen officieel advies: pas het aan op jullie situatie.
      </p>
    </>
  );
}

function CategoryRow({ cat, name, value, rec, income, known, onChange }: {
  cat: CategoryKey; name: string; value: number; rec: number; income: number; known?: number; onChange: (v: number) => void;
}) {
  const id = `r-${cat}`;
  const knownPct = income && known ? Math.round((known / income) * 1000) / 10 : 0;
  const amount = Math.round((income * value) / 100);
  return (
    <li>
      <div className="stack" style={{ flex: '1 1 220px', gap: 2 }}>
        <label htmlFor={id}>{name}</label>
        {known ? (
          <span className="tiny muted">
            Vastgelegd: {euro(known)} per maand ({p(knownPct)})
            {Math.abs(knownPct - value) >= 0.1 && <button type="button" className="btn ghost tiny" style={{ minHeight: 28, padding: '0 6px' }} onClick={() => onChange(knownPct)}>overnemen</button>}
          </span>
        ) : null}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        <NumberInput id={id} value={value} min={0} max={100} step={1} onChange={(v) => onChange(Math.round(v * 10) / 10)} style={{ width: 76, textAlign: 'right' }} />
        <span className="muted">%</span>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        <span className="muted">€</span>
        <NumberInput ariaLabel={`${name} in euro per maand`} value={amount} min={0} step={10} style={{ width: 100, textAlign: 'right' }}
          onChange={(e) => income > 0 && onChange(Math.round((e / income) * 1000) / 10)} />
      </div>
      <span style={{ width: 112, display: 'inline-flex', justifyContent: 'flex-end' }}>
        {Math.abs(value - rec) < 0.05
          ? <span className="pill green"><Icon name="check" size={12} />advies</span>
          : <button type="button" className="pill orange" style={{ border: 0, cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600 }} title="Advies overnemen" onClick={() => onChange(rec)}>advies {p(rec)}</button>}
      </span>
    </li>
  );
}

/** Percentage tonen: hele getallen zonder decimaal, anders 1 decimaal. */
const p = (n: number) => pct(n, Math.abs(n - Math.round(n)) < 0.05 ? 0 : 1);
