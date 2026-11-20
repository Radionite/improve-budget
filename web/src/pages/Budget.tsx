import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Segmented } from '../components/Fields';
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
            <input id="inc" className="input display" style={{ fontSize: 22, fontWeight: 600 }} type="number" inputMode="decimal" min={0} step={50} value={income} onChange={(e) => setIncome(e.target.value)} />
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="small muted">Verdeeld</span>
            <span className="display strong" style={{ fontSize: 28 }}>{pct(total)}</span>
            {total === 100 && <span className="pill green">Alles is verdeeld</span>}
            {total < 100 && <span className="pill orange">Nog {pct(100 - total)} te verdelen</span>}
            {total > 100 && <span className="pill red">{pct(total - 100)} te veel verdeeld</span>}
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
                <span className="small muted">{pct(groups[g.id])} · {euro((inc * groups[g.id]) / 100)} · advies {pct(recGroups[g.id])}</span>
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
            <span><span className="display strong" style={{ fontSize: 22 }}>{euro((inc * groups[g.id]) / 100)}</span> <span className="small muted">{pct(groups[g.id])} · advies {pct(recGroups[g.id])}</span></span>
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
  const knownPct = income && known ? (known / income) * 100 : 0;
  return (
    <li>
      <div className="stack" style={{ flex: '1 1 200px', gap: 2 }}>
        <label htmlFor={id}>{name}</label>
        {known ? <span className="tiny muted">Vastgelegd: {euro(known)} per maand ({pct(knownPct, 1)})</span> : null}
      </div>
      <input id={id} type="range" min={0} max={40} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: '3 1 200px', width: 'auto' }} />
      <span style={{ width: 44, fontWeight: 600 }} className="right">{pct(value)}</span>
      <span style={{ width: 112, display: 'inline-flex', justifyContent: 'flex-end' }}>
        {value === rec
          ? <span className="pill green"><Icon name="check" size={12} />advies</span>
          : <span className="pill orange">advies {pct(rec)}</span>}
      </span>
      <span style={{ width: 80 }} className="right muted">{euro((income * value) / 100)}</span>
    </li>
  );
}
