import { Link } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { byDateDesc, recentOnly, useCollection, useData } from '../lib/data';
import { useCommitments } from '../lib/commitments';
import { GROUPS } from '../lib/categories';
import { useCategories } from '../lib/useCategories';
import { useBudgetAmounts } from '../lib/useBudget';
import { studyLoansOf } from '../lib/studyLoans';
import { euro, longDate, monthLabel, pct } from '../lib/format';
import { warrantyInfo } from './Facturen';
import type { Invoice, Transaction } from '../lib/types';

export function OverzichtPage() {
  const { household } = useData();
  const { monthly, loans, studyPayment } = useCommitments();
  const invoices = useCollection<Invoice>('invoices');
  const txs = useCollection<Transaction>('transactions', recentOnly, byDateDesc);
  const cats = useCategories();
  const { amounts: budgetNow } = useBudgetAmounts();
  if (!household) return null;

  const income = household.income || 0;
  const amounts = budgetNow;
  const groups = cats.groupSums(amounts);
  const planned = GROUPS.reduce((s, g) => s + groups[g.id], 0);
  const lastMonth = txs.items[0]?.month;
  const monthTx = txs.items.filter((t) => t.month === lastMonth);
  const open = txs.items.filter((t) => !t.cat).length;
  const soon = invoices.items.map((i) => ({ ...i, w: warrantyInfo(i) })).filter((i) => i.w.status === 'binnenkort').sort((a, b) => a.w.days - b.w.days);
  const active = invoices.items.filter((i) => warrantyInfo(i).status !== 'verlopen').length;
  const debt = studyLoansOf(household).reduce((sum, x) => sum + (x.balance || 0), 0) + loans.reduce((s, l) => s + (l.balance || 0), 0);
  const loanMonthly = studyPayment + loans.reduce((s, l) => s + (l.monthly || 0), 0);

  return (
    <>
      <PageHead eyebrow={new Date().toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })} title="Overzicht">
        <Link className="btn" to="/rapport"><Icon name="download" size={18} />PDF-rapport</Link>
        <Link className="btn" to="/bankimport">Afschrift importeren</Link>
        <Link className="btn primary" to="/budget">Budget aanpassen</Link>
      </PageHead>

      {income === 0 && <p className="notice blue">Begin bij <Link to="/budget">Budget</Link>: vul jullie netto inkomen in. Voeg daarna bij <Link to="/huishouden">Huishouden</Link> het gezin, de huisdieren en voertuigen toe.</p>}
      {open > 0 && <p className="notice orange">Er {open === 1 ? 'is 1 transactie' : `zijn ${open} transacties`} nog niet ingedeeld. <Link to="/bankimport">Beantwoord de vragen</Link>.</p>}

      <section className="grid" aria-label="Kerncijfers">
        <div className="card kpi"><span className="label">Inkomen per maand</span><span className="value">{euro(income)}</span><span className="sub">{income ? pct((planned / income) * 100) : '0%'} verdeeld</span></div>
        <div className="card kpi"><span className="label">Sparen & beleggen per maand</span><span className="value">{euro(groups.sparen)}</span><span className="sub">{income ? pct((groups.sparen / income) * 100) : '0%'} van je inkomen</span></div>
        <div className="card kpi"><span className="label">Actieve garanties</span><span className="value">{active} <span className="small muted">van {invoices.items.length}</span></span><span className="sub" style={soon.length ? { color: 'var(--orange-text)' } : undefined}>{soon.length} verlopen binnen 90 dagen</span></div>
        <Link to="/leningen" className="card kpi" style={{ textDecoration: 'none', color: 'inherit' }}><span className="label">Leningen</span><span className="value">{euro(debt)}</span><span className="sub">{euro(loanMonthly)} per maand</span></Link>
      </section>

      <div className="grid" style={{ '--min': '320px' } as React.CSSProperties}>
        <section className="card" aria-labelledby="h-verdeling">
          <div className="card-head"><h2 id="h-verdeling">{lastMonth ? `${monthLabel(lastMonth)}` : 'Budgetverdeling'}</h2><Link to="/bankimport" className="small">Details</Link></div>
          <ul className="list">
            {GROUPS.map((g) => {
              const b = groups[g.id];
              const spent = monthTx.filter((t) => t.amount < 0 && cats.groupOf(t.cat) === g.id).reduce((s, t) => s - t.amount, 0);
              return (
                <li key={g.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: g.color }} />{g.name}</span><span className="small muted">{lastMonth ? `${euro(spent)} van ${euro(b)}` : `${income ? pct((b / income) * 100) : '0%'} · ${euro(b)}`}</span></div>
                  {lastMonth && <div className="bar" aria-hidden="true"><span style={{ width: `${b ? Math.min(100, (spent / b) * 100) : 0}%`, background: g.color }} /></div>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card" aria-labelledby="h-hh">
          <div className="card-head"><h2 id="h-hh">Huishouden</h2><Link to="/huishouden" className="small">Beheren</Link></div>
          <ul className="list">
            {[['Zakgeld ouders', monthly.zakouders], ['Zakgeld kinderen', monthly.zakkind], ['Kleedgeld', monthly.kleding], ['Huisdieren', monthly.dieren], ['Voertuigen', monthly.vervoer], ['Studiesparen kinderen', monthly.studiekind]].map(([l, v]) => (
              <li key={l as string} style={{ justifyContent: 'space-between' }}><span>{l}</span><span style={{ fontWeight: 600 }}>{euro(v as number)} / mnd</span></li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="h-gar">
          <div className="card-head"><h2 id="h-gar">Bijna verlopen</h2><Link to="/facturen" className="small">Alle facturen</Link></div>
          {soon.length ? (
            <ul className="list">
              {soon.slice(0, 4).map((i) => (
                <li key={i.id} style={{ justifyContent: 'space-between' }}>
                  <div className="stack" style={{ gap: 2 }}><span className="strong">{i.product}</span><span className="small muted">tot {longDate(i.w.untilIso)}</span></div>
                  <span className="pill orange">nog {i.w.days} dagen</span>
                </li>
              ))}
            </ul>
          ) : <p className="small muted">Geen garanties die binnen 90 dagen verlopen.</p>}
        </section>
      </div>
    </>
  );
}
