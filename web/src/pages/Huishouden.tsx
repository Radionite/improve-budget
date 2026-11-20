import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { PageHead } from '../components/Layout';
import { NumberField, SelectField, TextField } from '../components/Fields';
import { Icon } from '../components/Icon';
import { col, docRef, useData } from '../lib/data';
import { useCommitments, WEEKS_PER_MONTH } from '../lib/commitments';
import { daysUntil, euro, euroCents, pct } from '../lib/format';
import { situationName } from '../lib/budget';
import type { Person, Vehicle } from '../lib/types';

const PET_KINDS = ['Hond', 'Kat', 'Konijn', 'Vogel', 'Vissen', 'Anders'];
const VEHICLE_KINDS = ['Auto', 'Motor', 'Scooter', 'E-bike', 'Camper', 'Caravan', 'Anders'];
const FUELS = ['Benzine', 'Diesel', 'Elektrisch', 'Hybride', 'LPG', 'Geen'];
const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

export function HuishoudenPage() {
  const { household, hid } = useData();
  const { monthly, derived, people, pets, vehicles } = useCommitments();
  if (!household || !hid) return null;
  const income = household.income || 0;
  const share = (n = 0) => (income ? pct((n / income) * 100, 1) + ' van inkomen' : '');

  const save = (name: string, id: string) => (patch: Record<string, unknown>) => updateDoc(docRef(hid, name, id), patch);
  const remove = (name: string, id: string, label: string) => {
    if (confirm(`${label} verwijderen?`)) deleteDoc(docRef(hid, name, id));
  };

  return (
    <>
      <PageHead eyebrow="Gezin, huisdieren en voertuigen" title="Huishouden" />

      <section className="grid" aria-label="Samenvatting">
        <div className="card accent kpi">
          <span className="label" style={{ color: '#B7C6E8' }}>Jouw situatie</span>
          <span className="display strong" style={{ fontSize: 20 }}>{derived ? situationName(derived) : 'Nog niets ingevuld'}</span>
        </div>
        {[
          ['Zakgeld ouders', monthly.zakouders],
          ['Zakgeld kinderen', monthly.zakkind],
          ['Kleedgeld', monthly.kleding],
          ['Huisdieren', monthly.dieren],
          ['Voertuigen', monthly.vervoer],
        ].map(([label, v]) => (
          <div key={label as string} className="card kpi">
            <span className="label">{label}</span>
            <span className="value">{euro(v as number)}</span>
            <span className="sub">per maand {share(v as number) && `· ${share(v as number)}`}</span>
          </div>
        ))}
      </section>

      <section className="card" aria-labelledby="h-leden">
        <div className="card-head">
          <div className="stack" style={{ gap: 4 }}>
            <h2 id="h-leden">Gezinsleden</h2>
            <span className="small muted">Zakgeld ouders per maand, kinderen per week · kleedgeld per persoon per maand</span>
          </div>
          <div className="row">
            <button className="btn" onClick={() => addDoc(col(hid, 'people'), { name: 'Volwassene', role: 'adult', zakgeld: 0, kleedgeld: 0 })}><Icon name="plus" size={16} />Volwassene</button>
            <button className="btn" onClick={() => addDoc(col(hid, 'people'), { name: 'Kind', role: 'child', age: 6, zakgeld: 0, kleedgeld: 0, studySaved: 0, studyMonthly: 0, studyGoal: 0, studyMode: 'sparen' })}><Icon name="plus" size={16} />Kind</button>
          </div>
        </div>
        <ul className="cards">
          {people.map((p) => <PersonCard key={p.id} p={p} save={save('people', p.id)} remove={() => remove('people', p.id, p.name)} />)}
        </ul>
        {!people.length && <p className="muted small">Voeg jezelf, je partner en de kinderen toe.</p>}
        <p className="small muted">Voorstel zakgeld kinderen: € 0,50 per week per levensjaar, vanaf 4 jaar. Dat is een eenvoudige vuistregel, pas hem gerust aan.</p>
      </section>

      <section className="card" aria-labelledby="h-dieren">
        <div className="card-head">
          <div className="stack" style={{ gap: 4 }}><h2 id="h-dieren">Huisdieren</h2><span className="small muted">Voer, dierenarts en verzekering per maand</span></div>
          <button className="btn" onClick={() => addDoc(col(hid, 'pets'), { name: 'Nieuw huisdier', kind: 'Kat', cost: 0 })}><Icon name="plus" size={16} />Huisdier</button>
        </div>
        <ul className="cards">
          {pets.map((p) => (
            <li key={p.id} className="card inset">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <span className="pill orange" style={{ padding: 8 }}><Icon name="paw" /></span>
                <div style={{ flex: 1, minWidth: 0 }}><TextField label="Naam huisdier" hideLabel bare value={p.name} onSave={(v) => save('pets', p.id)({ name: v })} /></div>
                <button className="btn icon" aria-label={`${p.name} verwijderen`} onClick={() => remove('pets', p.id, p.name)}><Icon name="x" size={18} /></button>
              </div>
              <div className="grid" style={{ '--min': '120px' } as React.CSSProperties}>
                <SelectField label="Soort" value={p.kind} options={opts(PET_KINDS)} onChange={(v) => save('pets', p.id)({ kind: v })} />
                <NumberField label="Kosten per maand (€)" value={p.cost} step={5} onSave={(v) => save('pets', p.id)({ cost: v })} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="h-voertuigen">
        <div className="card-head">
          <div className="stack" style={{ gap: 4 }}><h2 id="h-voertuigen">Voertuigen</h2><span className="small muted">Vaste en variabele kosten per maand · APK-herinnering</span></div>
          <button className="btn" onClick={() => addDoc(col(hid, 'vehicles'), { name: 'Gezinsauto', kind: 'Auto', fuel: 'Benzine', tax: 0, insurance: 0, energy: 0, maintenance: 0, apk: '' })}><Icon name="plus" size={16} />Voertuig</button>
        </div>
        <ul className="cards" style={{ '--min': '340px' } as React.CSSProperties}>
          {vehicles.map((v) => <VehicleCard key={v.id} v={v} save={save('vehicles', v.id)} remove={() => remove('vehicles', v.id, v.name)} />)}
        </ul>
        {!vehicles.length && <p className="muted small">Geen voertuigen. Het budgetadvies rekent dan met openbaar vervoer en fiets.</p>}
      </section>
    </>
  );
}

function PersonCard({ p, save, remove }: { p: Person; save: (patch: Record<string, unknown>) => void; remove: () => void }) {
  const child = p.role === 'child';
  const suggestion = child && (p.age ?? 0) >= 4 ? (p.age ?? 0) * 0.5 : 0;
  return (
    <li className="card inset">
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <span className="pill blue" style={{ width: 40, height: 40, justifyContent: 'center', fontSize: 15 }} aria-hidden="true">{(p.name || '?').charAt(0).toUpperCase()}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextField label="Naam" hideLabel bare value={p.name} onSave={(v) => save({ name: v })} />
          <span className="small muted">{child ? `Kind · ${p.age ?? '?'} jaar` : 'Volwassene'}</span>
        </div>
        <button className="btn icon" aria-label={`${p.name} verwijderen`} onClick={remove}><Icon name="x" size={18} /></button>
      </div>
      <div className="grid" style={{ '--min': '120px' } as React.CSSProperties}>
        {child && <NumberField label="Leeftijd" value={p.age} onSave={(v) => save({ age: v })} />}
        <NumberField label={child ? 'Zakgeld per week (€)' : 'Zakgeld per maand (€)'} value={p.zakgeld} step={0.5} onSave={(v) => save({ zakgeld: v })} />
        <NumberField label="Kleedgeld per maand (€)" value={p.kleedgeld} step={5} onSave={(v) => save({ kleedgeld: v })} />
      </div>
      {child && (
        <div className="row small muted" style={{ justifyContent: 'space-between' }}>
          <span>Voorstel: {euroCents(suggestion)} per week · {euro(p.zakgeld * WEEKS_PER_MONTH)} per maand</span>
          <button className="btn ghost small" onClick={() => save({ zakgeld: suggestion })}>Gebruik voorstel</button>
        </div>
      )}
    </li>
  );
}

function VehicleCard({ v, save, remove }: { v: Vehicle; save: (patch: Record<string, unknown>) => void; remove: () => void }) {
  const total = (v.tax || 0) + (v.insurance || 0) + (v.energy || 0) + (v.maintenance || 0);
  const days = v.apk ? daysUntil(v.apk) : null;
  const apk = days === null ? ['gray', 'Geen APK-datum'] : days < 0 ? ['red', 'APK verlopen'] : days <= 60 ? ['orange', `APK over ${days} dagen`] : ['green', `APK over ${days} dagen`];
  return (
    <li className="card inset">
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <span className="pill blue" style={{ padding: 8 }}><Icon name="car" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextField label="Naam voertuig" hideLabel bare value={v.name} onSave={(x) => save({ name: x })} />
          <span className="small muted">{v.kind} · {v.fuel}</span>
        </div>
        <button className="btn icon" aria-label={`${v.name} verwijderen`} onClick={remove}><Icon name="x" size={18} /></button>
      </div>
      <div className="grid" style={{ '--min': '140px' } as React.CSSProperties}>
        <SelectField label="Soort" value={v.kind} options={opts(VEHICLE_KINDS)} onChange={(x) => save({ kind: x })} />
        <SelectField label="Brandstof" value={v.fuel} options={opts(FUELS)} onChange={(x) => save({ fuel: x })} />
        <NumberField label="Wegenbelasting (€/mnd)" value={v.tax} step={5} onSave={(x) => save({ tax: x })} />
        <NumberField label="Verzekering (€/mnd)" value={v.insurance} step={5} onSave={(x) => save({ insurance: x })} />
        <NumberField label="Brandstof / laden (€/mnd)" value={v.energy} step={5} onSave={(x) => save({ energy: x })} />
        <NumberField label="Onderhoud & reserve (€/mnd)" value={v.maintenance} step={5} onSave={(x) => save({ maintenance: x })} />
        <TextField label="APK vervalt" type="date" value={v.apk} onSave={(x) => save({ apk: x })} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
        <span className={`pill ${apk[0]}`}>{apk[1]}</span>
        <span><span className="display strong">{euro(total)}</span> <span className="muted">per maand</span></span>
      </div>
    </li>
  );
}
