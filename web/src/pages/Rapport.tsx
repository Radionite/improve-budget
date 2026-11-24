import { useMemo, useState } from 'react';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { byDateDesc, recentOnly, useCollection, useData } from '../lib/data';
import { useCommitments, WEEKS_PER_MONTH } from '../lib/commitments';
import { GROUPS } from '../lib/categories';
import { annuity, futureValue, recommend, simulateLoan, situationName, type Situation } from '../lib/budget';
import { budgetAmounts, useCategories } from '../lib/useCategories';
import { euro, euroCents, longDate, monthLabel, pct } from '../lib/format';
import type { ReportSection } from '../lib/report';
import type { Invoice, Transaction } from '../lib/types';
import { warrantyInfo } from './Facturen';

const STUDY_RATES = { sparen: 1.5, beleggen: 5 };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Negatief als '- € 12,50' zoals in de app. */
const money = (n: number, cents = true) => (n < -0.004 ? '- ' : '') + (cents ? euroCents(Math.abs(n)) : euro(Math.abs(n)));
const p1 = (n: number) => pct(n, Math.abs(n - Math.round(n)) < 0.05 ? 0 : 1);

export function RapportPage() {
  const { household } = useData();
  const { monthly, derived, people, pets, vehicles, loans, studyPayment } = useCommitments();
  const cats = useCategories();
  const invoices = useCollection<Invoice>('invoices', byDateDesc);
  const txs = useCollection<Transaction>('transactions', recentOnly, byDateDesc);
  const months = useMemo(() => [...new Set(txs.items.map((t) => t.month))].sort().reverse(), [txs.items]);
  const [month, setMonth] = useState('');
  const [withTx, setWithTx] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastFile, setLastFile] = useState<File | null>(null);
  const activeMonth = month || months[0] || '';

  if (!household) return null;
  const income = household.income || 0;
  const share = (n: number) => (income ? (n / income) * 100 : 0);

  const buildSections = (): ReportSection[] => {
    const amounts = budgetAmounts(household);
    const situation: Situation = derived ?? household.situation ?? { adults: 2, kids: 0, pets: false, cars: 0 };
    const rec = recommend(situation, {
      studieschuld: income ? ((monthly.studieschuld ?? 0) / income) * 100 : 0,
      lening: income ? ((monthly.lening ?? 0) / income) * 100 : 0,
    }) as Record<string, number>;
    const groupSums = cats.groupSums(amounts);
    const planned = GROUPS.reduce((s, g) => s + groupSums[g.id], 0);
    const sl = household.studyLoan;
    const debt = (sl?.balance ?? 0) + loans.reduce((s, l) => s + (l.balance || 0), 0);
    const loanMonthly = studyPayment + loans.reduce((s, l) => s + (l.monthly || 0), 0);
    const inv = invoices.items.map((i) => ({ ...i, w: warrantyInfo(i) }));
    const sections: ReportSection[] = [];

    // 1. Samenvatting
    sections.push({
      title: 'Samenvatting',
      facts: [
        ['Situatie', situationName(situation)],
        ['Netto gezinsinkomen per maand', euro(income)],
        ['Begroot per maand', `${euro(planned)} (${p1(share(planned))})`],
        [income - planned >= 0 ? 'Nog te verdelen' : 'Te veel begroot', euro(Math.abs(income - planned))],
        ...GROUPS.map((g) => [g.name, `${euro(groupSums[g.id])} (${p1(share(groupSums[g.id]))})`] as [string, string]),
        ['Totale schuld', euro(debt)],
        ['Maandlasten leningen', `${euro(loanMonthly)} (${p1(share(loanMonthly))} van inkomen)`],
        ['Garanties', `${inv.filter((i) => i.w.status !== 'verlopen').length} actief, ${inv.filter((i) => i.w.status === 'binnenkort').length} verlopen binnen 90 dagen`],
      ],
    });

    // 2. Budget per categorie
    sections.push({
      title: 'Budget per maand',
      note: 'Het advies is een vertrekpunt op basis van de gezinssituatie, geen officieel advies. Eigen categorieën hebben geen advies.',
      tables: GROUPS.map((g) => {
        const rows = cats.visible.filter((c) => c.group === g.id);
        return {
          title: g.name,
          head: ['Categorie', 'Bedrag', '% inkomen', 'Advies'],
          body: rows.map((c) => [c.name + (c.custom ? ' (eigen)' : ''), euro(amounts[c.key] ?? 0), p1(share(amounts[c.key] ?? 0)), c.custom ? '-' : p1(rec[c.key] ?? 0)]),
          foot: ['Totaal', euro(groupSums[g.id]), p1(share(groupSums[g.id])), p1(rows.filter((c) => !c.custom).reduce((s, c) => s + (rec[c.key] ?? 0), 0))],
          right: [1, 2, 3],
        };
      }),
    });

    // 3. Werkelijk vs budget
    if (activeMonth) {
      const mTx = txs.items.filter((t) => t.month === activeMonth);
      const spentBy = (key: string) => mTx.filter((t) => t.amount < 0 && t.cat === key).reduce((s, t) => s - t.amount, 0);
      const spentGroup = (g: string) => mTx.filter((t) => t.amount < 0 && cats.groupOf(t.cat) === g).reduce((s, t) => s - t.amount, 0);
      const open = mTx.filter((t) => !t.cat);
      const incomeIn = mTx.filter((t) => t.amount > 0 && t.cat === 'inkomen').reduce((s, t) => s + t.amount, 0);
      const catRows = cats.all
        .map((c) => ({ c, budget: amounts[c.key] ?? 0, spent: spentBy(c.key) }))
        .filter((r) => r.budget > 0 || r.spent > 0);
      sections.push({
        title: `Werkelijk vs budget - ${monthLabel(activeMonth)}`,
        note: open.length ? `Let op: ${open.length} transacties zijn nog niet ingedeeld (${euroCents(open.reduce((s, t) => s + Math.abs(t.amount), 0))}).` : undefined,
        facts: [['Ontvangen inkomen', euroCents(incomeIn)], ['Aantal transacties', String(mTx.length)]],
        tables: [
          {
            head: ['Groep', 'Budget', 'Werkelijk', 'Verschil'],
            body: GROUPS.map((g) => [g.name, euro(groupSums[g.id]), euroCents(spentGroup(g.id)), money(groupSums[g.id] - spentGroup(g.id))]),
            right: [1, 2, 3],
          },
          {
            title: 'Per categorie',
            head: ['Categorie', 'Budget', 'Werkelijk', 'Verschil'],
            body: catRows.map((r) => [r.c.name, euro(r.budget), euroCents(r.spent), money(r.budget - r.spent)]),
            right: [1, 2, 3],
          },
        ],
      });
    }

    // 4. Huishouden
    const adults = people.filter((x) => x.role === 'adult');
    const kids = people.filter((x) => x.role === 'child');
    sections.push({
      title: 'Huishouden',
      tables: [
        ...(people.length ? [{
          title: 'Gezinsleden',
          head: ['Naam', 'Rol', 'Zakgeld per maand', 'Kleedgeld per maand'],
          body: [...adults, ...kids].map((x) => [x.name, x.role === 'child' ? `Kind, ${x.age ?? '?'} jaar` : 'Volwassene',
            x.role === 'child' ? `${euro((x.zakgeld || 0) * WEEKS_PER_MONTH)} (${euroCents(x.zakgeld || 0)} p/w)` : euro(x.zakgeld || 0), euro(x.kleedgeld || 0)]),
          foot: ['Totaal', '', euro((monthly.zakouders ?? 0) + (monthly.zakkind ?? 0)), euro(monthly.kleding ?? 0)],
          right: [2, 3],
        }] : []),
        ...(pets.length ? [{
          title: 'Huisdieren',
          head: ['Naam', 'Soort', 'Kosten per maand'],
          body: pets.map((x) => [x.name, x.kind, euro(x.cost || 0)]),
          foot: ['Totaal', '', euro(monthly.dieren ?? 0)],
          right: [2],
        }] : []),
        ...(vehicles.length ? [{
          title: 'Voertuigen',
          head: ['Naam', 'Soort', 'Wegenbel.', 'Verzekering', 'Brandstof', 'Onderhoud', 'Totaal p/m', 'APK'],
          body: vehicles.map((v) => [v.name, `${v.kind}, ${v.fuel}`, euro(v.tax || 0), euro(v.insurance || 0), euro(v.energy || 0), euro(v.maintenance || 0),
            euro((v.tax || 0) + (v.insurance || 0) + (v.energy || 0) + (v.maintenance || 0)), v.apk ? longDate(v.apk) : '-']),
          right: [2, 3, 4, 5, 6],
        }] : []),
      ],
    });

    // 5. Leningen en studie
    const leningTables: ReportSection['tables'] = [];
    if (sl && sl.balance > 0) {
      const pay = annuity(sl.balance, sl.rate, sl.term * 12);
      const sim = simulateLoan(sl.balance, sl.rate, pay, sl.extra || 0, sl.term * 12);
      leningTables.push({
        title: 'Studieschuld (DUO)',
        head: ['Openstaand', 'Rente', 'Regeling', 'Maandbedrag', 'Schuldvrij in', 'Totale rente'],
        body: [[euro(sl.balance), pct(sl.rate, 2), `${sl.term} jaar`, euro(pay + (sl.extra || 0)), String(new Date().getFullYear() + Math.ceil(sim.months / 12)), euro(sim.interest)]],
        right: [0, 1, 3, 5],
      });
    }
    if (loans.length) {
      leningTables.push({
        title: 'Andere leningen',
        head: ['Naam', 'Soort', 'Rente', 'Openstaand', 'Per maand', 'Klaar in'],
        body: loans.map((l) => [l.name, l.kind, pct(l.rate, 1), euro(l.balance), euro(l.monthly), l.endYear ? String(l.endYear) : '-']),
        foot: ['Totaal', '', '', euro(loans.reduce((s, l) => s + (l.balance || 0), 0)), euro(loans.reduce((s, l) => s + (l.monthly || 0), 0)), ''],
        right: [2, 3, 4],
      });
    }
    if (kids.length) {
      leningTables.push({
        title: 'Spaarplan studie kinderen',
        head: ['Kind', 'Manier', 'Gespaard', 'Per maand', 'Doel', 'Verwacht op 18', 'Verschil'],
        body: kids.map((k) => {
          const mode = k.studyMode ?? 'sparen';
          const months = Math.max(0, 18 - (k.age ?? 0)) * 12;
          const fv = futureValue(k.studySaved ?? 0, k.studyMonthly ?? 0, STUDY_RATES[mode], months);
          return [k.name, `${cap(mode)} (${pct(STUDY_RATES[mode], 1)})`, euro(k.studySaved ?? 0), euro(k.studyMonthly ?? 0), euro(k.studyGoal ?? 0), euro(fv), money(fv - (k.studyGoal ?? 0), false)];
        }),
        right: [2, 3, 4, 5, 6],
      });
    }
    if (leningTables.length) sections.push({ title: 'Studie & leningen', note: 'Rekenvoorbeelden met vaste rente; DUO en banken rekenen de echte bedragen zelf uit.', tables: leningTables });

    // 6. Beleggen
    const iv = household.invest;
    if (iv) {
      const end = futureValue(iv.start, iv.monthly, iv.rate, iv.years * 12);
      const inleg = iv.start + iv.monthly * iv.years * 12;
      sections.push({
        title: 'Beleggingsplan',
        note: 'Rekenvoorbeeld met een vast rendement; werkelijke rendementen schommelen en zijn niet gegarandeerd. Kosten en belasting niet meegerekend.',
        facts: [
          ['Startbedrag', euro(iv.start)], ['Inleg per maand', euro(iv.monthly)], ['Verwacht rendement', `${pct(iv.rate, 1)} per jaar`], ['Looptijd', `${iv.years} jaar`],
          ['Eindwaarde', euro(end)], ['Eigen inleg', euro(inleg)], ['Rendement', euro(end - inleg)], ["In euro's van nu", euro(end / Math.pow(1 + iv.infl / 100, iv.years))],
        ],
        tables: [{
          title: "Scenario's",
          head: ['Scenario', 'Rendement', 'Eindwaarde'],
          body: [['Voorzichtig', Math.max(0, iv.rate - 2)], ['Verwacht', iv.rate], ['Optimistisch', iv.rate + 2]].map(([n, r]) => [String(n), pct(Number(r), 1), euro(futureValue(iv.start, iv.monthly, Number(r), iv.years * 12))]),
          right: [1, 2],
        }],
      });
    }

    // 7. Facturen en garanties
    if (inv.length) {
      const label = { actief: 'Actief', binnenkort: 'Verloopt binnenkort', verlopen: 'Verlopen' };
      sections.push({
        title: 'Facturen & garanties',
        tables: [{
          head: ['Product', 'Winkel', 'Gekocht', 'Bedrag', 'Garantie tot', 'Status'],
          body: inv.map((i) => [i.product, i.shop || '-', longDate(i.date), euro(i.amount), longDate(i.w.untilIso), i.w.status === 'binnenkort' ? `Nog ${i.w.days} dagen` : label[i.w.status]]),
          foot: ['Totaal', '', '', euro(inv.reduce((s, i) => s + (i.amount || 0), 0)), '', ''],
          right: [3],
        }],
      });
    }

    // 8. Transacties (optioneel)
    if (withTx && activeMonth) {
      const mTx = txs.items.filter((t) => t.month === activeMonth).sort((a, b) => a.date.localeCompare(b.date));
      sections.push({
        title: `Transacties - ${monthLabel(activeMonth)}`,
        tables: [{
          head: ['Datum', 'Omschrijving', 'Categorie', 'Bank', 'Bedrag'],
          body: mTx.map((t) => [longDate(t.date), t.name || t.raw.slice(0, 50), t.cat ? cats.names[t.cat] ?? t.cat : 'Nog niet ingedeeld', t.bank, money(t.amount)]),
          right: [4],
        }],
      });
    }
    return sections;
  };

  const make = async () => {
    setBusy(true);
    setError('');
    try {
      const { renderReport } = await import('../lib/report');
      const today = new Date();
      const doc = renderReport({
        title: 'Gezinsbank - financieel overzicht',
        subtitle: `${household.name} · gemaakt op ${today.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        footer: `Gezinsbank · ${household.name}`,
        sections: buildSections(),
      });
      const name = `gezinsbank-rapport-${today.toISOString().slice(0, 10)}.pdf`;
      setLastFile(new File([doc.output('blob')], name, { type: 'application/pdf' }));
      doc.save(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Het rapport kon niet worden gemaakt.');
    } finally {
      setBusy(false);
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && !!lastFile && navigator.canShare({ files: [lastFile] });
  const shareFile = async () => {
    if (lastFile) await navigator.share({ files: [lastFile], title: 'Gezinsbank-rapport' }).catch(() => {});
  };

  return (
    <>
      <PageHead eyebrow="Alles op papier" title="PDF-rapport" />
      <section className="card" aria-labelledby="h-opties">
        <h2 id="h-opties">Rapport samenstellen</h2>
        <p className="small muted">Het rapport bevat: samenvatting, budget per categorie met advies, werkelijk vs budget van de gekozen maand, huishouden (gezin, zakgeld, kleedgeld, huisdieren, voertuigen), studie & leningen, beleggingsplan en facturen met garanties.</p>
        <div className="grid" style={{ '--min': '220px', alignItems: 'end' } as React.CSSProperties}>
          <div className="field">
            <label htmlFor="r-maand">Maand voor werkelijk vs budget</label>
            <select id="r-maand" className="input" value={activeMonth} onChange={(e) => setMonth(e.target.value)} disabled={!months.length}>
              {months.length ? months.map((m) => <option key={m} value={m}>{cap(monthLabel(m))}</option>) : <option value="">Nog geen transacties</option>}
            </select>
          </div>
          <label className="check"><input type="checkbox" checked={withTx} onChange={(e) => setWithTx(e.target.checked)} disabled={!months.length} />Ook alle transacties van die maand</label>
        </div>
        {error && <p className="notice red" role="alert">{error}</p>}
        <div className="row">
          <button className="btn primary" onClick={make} disabled={busy}><Icon name="download" size={18} />{busy ? 'Bezig…' : 'PDF downloaden'}</button>
          {canShare && <button className="btn" onClick={shareFile}>Delen of opslaan…</button>}
        </div>
        <p className="tiny muted">Het rapport wordt op dit apparaat gemaakt; er wordt niets verstuurd. Op de telefoon kun je het daarna delen of in Bestanden bewaren.</p>
      </section>
    </>
  );
}
