import { useEffect, useState } from 'react';
import { PageHead } from '../components/Layout';
import { Slider } from '../components/Fields';
import { useData } from '../lib/data';
import { futureValue } from '../lib/budget';
import { euro, pct } from '../lib/format';

const DEFAULT = { start: 0, monthly: 100, rate: 6, years: 25, infl: 2 };
const short = (n: number) => (n >= 1e6 ? `€ ${(n / 1e6).toFixed(1).replace('.', ',')}m` : n >= 1000 ? `€ ${Math.round(n / 1000)}k` : euro(n));

export function BeleggenPage() {
  const { household, update } = useData();
  const [p, setP] = useState(household?.invest ?? DEFAULT);
  useEffect(() => { if (household?.invest) setP(household.invest); }, [household?.invest]);
  if (!household) return null;

  const points = Array.from({ length: p.years }, (_, i) => {
    const m = (i + 1) * 12;
    return { year: i + 1, value: futureValue(p.start, p.monthly, p.rate, m), inleg: p.start + p.monthly * m };
  });
  const last = points[points.length - 1] ?? { value: p.start, inleg: p.start };
  const max = Math.max(last.value, 1);
  const step = p.years > 25 ? 10 : 5;
  const dirty = JSON.stringify(p) !== JSON.stringify(household.invest ?? DEFAULT);
  const set = (k: keyof typeof p) => (v: number) => setP({ ...p, [k]: v });

  return (
    <>
      <PageHead eyebrow="Lange termijn" title="Beleggingsprojectie">
        <button className="btn primary" disabled={!dirty} onClick={() => update({ invest: p })}>Opslaan als ons plan</button>
      </PageHead>
      <div className="split">
        <section className="card narrow" aria-labelledby="h-in">
          <h2 id="h-in">Uitgangspunten</h2>
          <Slider label="Startbedrag" value={p.start} display={euro(p.start)} min={0} max={100000} step={1000} onChange={set('start')} minLabel="€ 0" maxLabel="€ 100k" />
          <Slider label="Inleg per maand" value={p.monthly} display={euro(p.monthly)} min={0} max={2000} step={25} onChange={set('monthly')} minLabel="€ 0" maxLabel="€ 2.000" />
          <Slider label="Verwacht rendement" value={p.rate} display={pct(p.rate, 1)} min={0} max={12} step={0.5} onChange={set('rate')} minLabel="0%" maxLabel="12%" />
          <Slider label="Looptijd" value={p.years} display={`${p.years} jaar`} min={5} max={40} step={1} onChange={set('years')} minLabel="5 jaar" maxLabel="40 jaar" />
          <Slider label="Inflatie" value={p.infl} display={pct(p.infl, 1)} min={0} max={5} step={0.5} onChange={set('infl')} minLabel="0%" maxLabel="5%" />
        </section>
        <div className="wide stack" style={{ gap: 20 }}>
          <section className="grid" style={{ '--min': '180px' } as React.CSSProperties} aria-label="Resultaat">
            <div className="card accent kpi"><span className="label" style={{ color: '#B7C6E8' }}>Eindwaarde na {p.years} jaar</span><span className="value">{euro(last.value)}</span></div>
            <div className="card kpi"><span className="label">Totale eigen inleg</span><span className="value">{euro(last.inleg)}</span></div>
            <div className="card kpi"><span className="label">Rendement</span><span className="value" style={{ color: 'var(--link)' }}>{euro(last.value - last.inleg)}</span></div>
            <div className="card kpi"><span className="label">In euro's van nu</span><span className="value">{euro(last.value / Math.pow(1 + p.infl / 100, p.years))}</span><span className="sub">gecorrigeerd voor inflatie</span></div>
          </section>
          <section className="card" aria-labelledby="h-groei">
            <div className="card-head">
              <h2 id="h-groei">Groei per jaar</h2>
              <div className="row small muted" style={{ gap: 20 }}>
                <span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: '#3E4E73' }} />Eigen inleg</span>
                <span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: '#8FAEF5' }} />Rendement</span>
              </div>
            </div>
            <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
              <div className="stack tiny muted right" style={{ justifyContent: 'space-between', height: 260, width: 56, flex: 'none' }}><span>{short(max)}</span><span>{short(max / 2)}</span><span>€ 0</span></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="chart" role="img" aria-label={`Vermogen groeit in ${p.years} jaar naar ${euro(last.value)}`} style={{ height: 260 }}>
                  {points.map((pt) => (
                    <div key={pt.year}>
                      <span style={{ height: Math.max(0, ((pt.value - pt.inleg) / max) * 260), background: '#8FAEF5' }} />
                      <span style={{ height: (Math.min(pt.inleg, pt.value) / max) * 260, background: '#3E4E73' }} />
                    </div>
                  ))}
                </div>
                <div className="row tiny muted" style={{ gap: 3, flexWrap: 'nowrap', marginTop: 6 }}>
                  {points.map((pt) => <span key={pt.year} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>{pt.year % step === 0 ? pt.year : ''}</span>)}
                </div>
              </div>
            </div>
          </section>
          <section className="card" aria-labelledby="h-scen">
            <h2 id="h-scen">Scenario's</h2>
            <div className="grid" style={{ '--min': '180px' } as React.CSSProperties}>
              {[['Voorzichtig', Math.max(0, p.rate - 2)], ['Verwacht', p.rate], ['Optimistisch', p.rate + 2]].map(([name, r], i) => (
                <div key={name as string} className={`card inset${i === 1 ? ' accent' : ''}`}>
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  <span className="small muted">{pct(r as number, 1)} rendement per jaar</span>
                  <span className="display strong" style={{ fontSize: 24 }}>{euro(futureValue(p.start, p.monthly, r as number, p.years * 12))}</span>
                </div>
              ))}
            </div>
            <p className="small muted">Rekenvoorbeeld met een vast rendement en maandelijkse rente-op-rente. Werkelijke rendementen schommelen en zijn niet gegarandeerd; kosten en belasting zijn niet meegerekend.</p>
          </section>
        </div>
      </div>
    </>
  );
}
