import { useEffect, useState, type FormEvent } from 'react';
import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { PageHead } from '../components/Layout';
import { NumberField, Segmented, Slider } from '../components/Fields';
import { Icon } from '../components/Icon';
import { col, docRef, useData } from '../lib/data';
import { useCommitments } from '../lib/commitments';
import { annuity, futureValue, neededMonthly, simulateLoan } from '../lib/budget';
import { euro, num, pct } from '../lib/format';
import type { Household, Person } from '../lib/types';

const RATES = { sparen: 1.5, beleggen: 5 };
const DEFAULT_LOAN: NonNullable<Household['studyLoan']> = { balance: 0, rate: 2.5, term: 35, extra: 0, owner: '' };

export function LeningenPage() {
  const { household, hid, update } = useData();
  const { loans, people, studyPayment } = useCommitments();
  const [sl, setSl] = useState(household?.studyLoan ?? DEFAULT_LOAN);
  useEffect(() => { if (household?.studyLoan) setSl(household.studyLoan); }, [household?.studyLoan]);
  const [form, setForm] = useState({ name: '', kind: 'Hypotheek', balance: '', start: '', rate: '', monthly: '', endYear: '' });
  if (!household || !hid) return null;

  const year = new Date().getFullYear();
  const pay = sl.balance > 0 ? annuity(sl.balance, sl.rate, sl.term * 12) : 0;
  const base = simulateLoan(sl.balance, sl.rate, pay, 0, sl.term * 12);
  const withExtra = simulateLoan(sl.balance, sl.rate, pay, sl.extra, sl.term * 12);
  const dirty = JSON.stringify(sl) !== JSON.stringify(household.studyLoan ?? DEFAULT_LOAN);
  const set = (k: keyof typeof sl) => (v: number | string) => setSl({ ...sl, [k]: v });

  const debtTotal = sl.balance + loans.reduce((s, l) => s + (l.balance || 0), 0);
  const monthlyTotal = studyPayment + loans.reduce((s, l) => s + (l.monthly || 0), 0);
  const kids = people.filter((p) => p.role === 'child');
  const adults = people.filter((p) => p.role === 'adult');

  const addLoan = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await addDoc(col(hid, 'loans'), {
      name: form.name.trim(), kind: form.kind, balance: num(form.balance), start: num(form.start) || num(form.balance),
      rate: num(form.rate), monthly: num(form.monthly), endYear: num(form.endYear), budgetCat: form.kind === 'Hypotheek' ? 'wonen' : 'lening', link: '',
    });
    setForm({ name: '', kind: 'Hypotheek', balance: '', start: '', rate: '', monthly: '', endYear: '' });
  };

  return (
    <>
      <PageHead eyebrow="Schulden aflossen en sparen voor later" title="Studie & leningen" />

      <section className="grid" aria-label="Samenvatting">
        <div className="card kpi"><span className="label">Totale schuld</span><span className="value">{euro(debtTotal)}</span><span className="sub">{loans.length + (sl.balance ? 1 : 0)} leningen</span></div>
        <div className="card kpi"><span className="label">Maandlasten leningen</span><span className="value">{euro(monthlyTotal)}</span><span className="sub">{household.income ? `${pct((monthlyTotal / household.income) * 100)} van je inkomen` : ''}</span></div>
        <div className="card accent kpi"><span className="label" style={{ color: '#B7C6E8' }}>Studiepotjes kinderen</span><span className="value">{euro(kids.reduce((s, k) => s + (k.studySaved || 0), 0))}</span><span className="sub" style={{ color: '#B7C6E8' }}>{euro(kids.reduce((s, k) => s + (k.studyMonthly || 0), 0))} per maand</span></div>
      </section>

      <section className="card" aria-labelledby="h-duo">
        <div className="card-head">
          <div className="row" style={{ gap: 12 }}>
            <span className="pill blue" style={{ padding: 10 }}><Icon name="cap" size={22} /></span>
            <div className="stack" style={{ gap: 2 }}><h2 id="h-duo" style={{ fontSize: 22 }}>Studieschuld (DUO)</h2><span className="small muted">Vul de gegevens uit je overzicht van DUO in · budgetpost Studieschuld</span></div>
          </div>
          <div className="row">
            <Segmented label="Aflossingsregeling" value={sl.term} options={[{ value: 35, label: '35 jaar (vanaf 2015)' }, { value: 15, label: '15 jaar (voor 2015)' }]} onChange={(v) => set('term')(v)} />
          </div>
        </div>
        <div className="split">
          <div className="narrow stack" style={{ gap: 18 }}>
            <Slider label="Openstaande schuld" value={sl.balance} display={euro(sl.balance)} min={0} max={100000} step={500} onChange={set('balance')} minLabel="€ 0" maxLabel="€ 100k" />
            <Slider label="Rente per jaar" value={sl.rate} display={pct(sl.rate, 2)} min={0} max={5} step={0.05} onChange={set('rate')} minLabel="0%" maxLabel="5%" />
            <Slider label="Extra aflossen per maand" value={sl.extra} display={euro(sl.extra)} min={0} max={500} step={10} onChange={set('extra')} minLabel="€ 0" maxLabel="€ 500" />
            <div className="field">
              <label htmlFor="sl-owner">Van wie is de schuld?</label>
              <select id="sl-owner" className="input" value={sl.owner} onChange={(e) => set('owner')(e.target.value)}>
                <option value="">Niet gekoppeld</option>
                {adults.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <button className="btn primary" disabled={!dirty} onClick={() => update({ studyLoan: sl })}>Opslaan</button>
          </div>
          <div className="wide stack" style={{ gap: 14 }}>
            <div className="grid" style={{ '--min': '170px' } as React.CSSProperties}>
              <div className="card inset kpi"><span className="sub">Maandbedrag</span><span className="value" style={{ fontSize: 24 }}>{euro(pay + sl.extra)}</span><span className="sub">{sl.extra ? `${euro(pay)} termijn + ${euro(sl.extra)} extra` : `termijn bij ${sl.term} jaar`}</span></div>
              <div className="card inset kpi"><span className="sub">Schuldvrij in</span><span className="value" style={{ fontSize: 24 }}>{sl.balance ? year + Math.ceil(withExtra.months / 12) : '–'}</span><span className="sub">over {(withExtra.months / 12).toFixed(1).replace('.', ',')} jaar</span></div>
              <div className="card inset kpi"><span className="sub">Totaal aan rente</span><span className="value" style={{ fontSize: 24, color: 'var(--orange-text)' }}>{euro(withExtra.interest)}</span></div>
              <div className="card inset kpi"><span className="sub">Winst door extra aflossen</span><span className="value" style={{ fontSize: 24, color: 'var(--green)' }}>{euro(base.interest - withExtra.interest)}</span><span className="sub">{sl.extra ? `${((base.months - withExtra.months) / 12).toFixed(1).replace('.', ',')} jaar eerder klaar` : 'zet extra aflossen aan'}</span></div>
            </div>
            <div className="chart" role="img" aria-label="Openstaande studieschuld per jaar" style={{ height: 120 }}>
              {Array.from({ length: sl.term }, (_, y) => (
                <div key={y}><span style={{ height: sl.balance ? ((withExtra.yearly[y] ?? 0) / sl.balance) * 116 : 0, background: y % 5 === 0 ? '#8FAEF5' : '#4F7BE8' }} /></div>
              ))}
            </div>
            <div className="row tiny muted" style={{ justifyContent: 'space-between' }}><span>Nu</span><span>{year + sl.term}</span></div>
          </div>
        </div>
        <p className="small muted" style={{ maxWidth: 820 }}>Rekenvoorbeeld met een vaste rente en een gelijk maandbedrag. DUO rekent je echte termijn zelf uit en past de rente periodiek aan. Bij een laag inkomen kan je maandbedrag lager uitvallen (draagkracht). Extra aflossen kan bij DUO zonder boete.</p>
      </section>

      <section className="card" aria-labelledby="h-loans">
        <h2 id="h-loans">Andere leningen</h2>
        <ul className="list">
          {loans.map((l) => (
            <li key={l.id}>
              <div className="stack" style={{ flex: '1 1 220px', gap: 2 }}><span className="strong">{l.name}</span><span className="small muted">{l.kind} · {pct(l.rate, 1)} rente · budgetpost {l.budgetCat === 'wonen' ? 'Huur / hypotheek' : 'Autolening & overige leningen'}</span></div>
              <div className="stack" style={{ flex: '1 1 180px', gap: 6 }}>
                <div className="bar" style={{ height: 6 }} aria-hidden="true"><span style={{ width: `${l.start ? Math.round((1 - l.balance / l.start) * 100) : 0}%`, background: 'var(--green)' }} /></div>
                <span className="tiny muted">{l.start ? Math.round((1 - l.balance / l.start) * 100) : 0}% afgelost{l.endYear ? ` · klaar in ${l.endYear}` : ''}</span>
              </div>
              <div style={{ width: 120 }}><NumberField label="Openstaand (€)" value={l.balance} step={100} onSave={(v) => updateDoc(docRef(hid, 'loans', l.id), { balance: v })} /></div>
              <div style={{ width: 110 }}><NumberField label="Per maand (€)" value={l.monthly} step={5} onSave={(v) => updateDoc(docRef(hid, 'loans', l.id), { monthly: v })} /></div>
              <button className="btn icon" aria-label={`${l.name} verwijderen`} onClick={() => confirm(`${l.name} verwijderen?`) && deleteDoc(docRef(hid, 'loans', l.id))}><Icon name="x" size={18} /></button>
            </li>
          ))}
        </ul>
        <form onSubmit={addLoan} className="grid" style={{ '--min': '140px', alignItems: 'end' } as React.CSSProperties}>
          <div className="field"><label htmlFor="l-n">Naam</label><input id="l-n" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bijv. Hypotheek" /></div>
          <div className="field"><label htmlFor="l-k">Soort</label><select id="l-k" className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{['Hypotheek', 'Autolening', 'Persoonlijke lening', 'Doorlopend krediet', 'Overig'].map((k) => <option key={k}>{k}</option>)}</select></div>
          <div className="field"><label htmlFor="l-s">Oorspronkelijk (€)</label><input id="l-s" className="input" type="number" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
          <div className="field"><label htmlFor="l-b">Openstaand (€)</label><input id="l-b" className="input" type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} /></div>
          <div className="field"><label htmlFor="l-r">Rente (%)</label><input id="l-r" className="input" type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
          <div className="field"><label htmlFor="l-m">Per maand (€)</label><input id="l-m" className="input" type="number" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.target.value })} /></div>
          <div className="field"><label htmlFor="l-e">Laatste jaar</label><input id="l-e" className="input" type="number" value={form.endYear} onChange={(e) => setForm({ ...form, endYear: e.target.value })} /></div>
          <button className="btn"><Icon name="plus" size={16} />Lening toevoegen</button>
        </form>
      </section>

      <section className="card" aria-labelledby="h-kids">
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="h-kids" style={{ fontSize: 22 }}>Spaarplan studie kinderen</h2>
          <span className="small muted">Per kind een potje tot de start van de studie (18 jaar). In je budget is dit de post Studiesparen kinderen.</span>
        </div>
        <div className="grid" style={{ '--min': '340px' } as React.CSSProperties}>
          {kids.map((k) => <KidPlan key={k.id} k={k} save={(patch) => updateDoc(docRef(hid, 'people', k.id), patch)} />)}
        </div>
        {!kids.length && <p className="muted small">Voeg kinderen toe bij Huishouden om een spaarplan te maken.</p>}
        <p className="small muted">Aanname: sparen {pct(RATES.sparen, 1)} en beleggen {pct(RATES.beleggen)} rendement per jaar. Beleggen kan meer opleveren maar schommelt; bouw het vaak af in de laatste jaren voor de studie.</p>
      </section>
    </>
  );
}

function KidPlan({ k, save }: { k: Person; save: (patch: Record<string, unknown>) => void }) {
  const mode = k.studyMode ?? 'sparen';
  const months = Math.max(0, 18 - (k.age ?? 0)) * 12;
  const fv = futureValue(k.studySaved ?? 0, k.studyMonthly ?? 0, RATES[mode], months);
  const goal = k.studyGoal ?? 0;
  const gap = goal - fv;
  const need = Math.ceil(neededMonthly(k.studySaved ?? 0, goal, RATES[mode], months) / 5) * 5;
  return (
    <article className="card inset" aria-label={`Spaarplan ${k.name}`}>
      <div className="stack" style={{ gap: 2 }}><span className="strong" style={{ fontSize: 17 }}>{k.name}</span><span className="small muted">{k.age ?? '?'} jaar · studie start over {months / 12} jaar</span></div>
      <Segmented label="Manier" value={mode} options={[{ value: 'sparen', label: `Sparen ${pct(RATES.sparen, 1)}` }, { value: 'beleggen', label: `Beleggen ${pct(RATES.beleggen)}` }]} onChange={(v) => save({ studyMode: v })} />
      <div className="grid" style={{ '--min': '100px' } as React.CSSProperties}>
        <NumberField label="Nu gespaard (€)" value={k.studySaved} step={100} onSave={(v) => save({ studySaved: v })} />
        <NumberField label="Per maand (€)" value={k.studyMonthly} step={5} onSave={(v) => save({ studyMonthly: v })} />
        <NumberField label="Doel (€)" value={k.studyGoal} step={500} onSave={(v) => save({ studyGoal: v })} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}><span className="small muted">Verwacht op 18 jaar</span><span className="display strong" style={{ fontSize: 22 }}>{euro(fv)}</span></div>
      <div className="bar" aria-hidden="true"><span style={{ width: `${goal ? Math.min(100, (fv / goal) * 100) : 0}%`, background: gap <= 0 ? 'var(--green)' : 'var(--orange)' }} /></div>
      {goal > 0 && (gap <= 0
        ? <span className="small" style={{ color: 'var(--green)', fontWeight: 600 }}>Doel gehaald · {euro(-gap)} over</span>
        : <div className="row" style={{ justifyContent: 'space-between' }}><span className="small" style={{ color: 'var(--orange-text)', fontWeight: 600 }}>Nog {euro(gap)} tekort · {euro(need)} per maand nodig</span><button className="btn ghost small" onClick={() => save({ studyMonthly: need })}>Pas maandbedrag aan</button></div>)}
    </article>
  );
}
