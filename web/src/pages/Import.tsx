import { useMemo, useState, type DragEvent } from 'react';
import { addDoc, arrayUnion, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { balanceOk, categorize, parseStatementFile, totalCredit, totalDebit, transactionId } from '../lib/statements';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { byDateDesc, col, docRef, recentOnly, useCollection, useData } from '../lib/data';
import { useLinkOptions } from '../lib/commitments';
import { GROUPS, type TxCategory } from '../lib/categories';
import { budgetAmounts, useCategories } from '../lib/useCategories';
import { euro, longDate, monthLabel, shortDate, signedEuro } from '../lib/format';
import type { Rule, Statement, Transaction } from '../lib/types';

const ACCEPT = '.pdf,.csv,.txt,.xml,.sta,.940,.mt940';

export function ImportPage() {
  const { household, hid, user } = useData();
  const statements = useCollection<Statement & { createdAt?: { seconds: number } }>('statements');
  const txs = useCollection<Transaction>('transactions', recentOnly, byDateDesc);
  const rules = useCollection<Rule>('rules');
  const linkOptions = useLinkOptions();
  const cats = useCategories();

  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState('');
  const [remember, setRemember] = useState(true);
  const [askAll, setAskAll] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [answered, setAnswered] = useState(0);
  const [link, setLink] = useState<Record<string, string>>({});
  const months = useMemo(() => [...new Set(txs.items.map((t) => t.month))].sort().reverse(), [txs.items]);
  const [month, setMonth] = useState('');
  const activeMonth = month || months[0] || '';

  if (!household || !hid || !user) return null;
  const linkName = (v: string) => linkOptions.find((o) => o.value === v)?.label ?? 'Gezin algemeen';

  // ---------- Inlezen (in de browser; het afschrift zelf wordt niet opgeslagen) ----------
  const upload = async (files: FileList | File[] | null) => {
    for (const file of Array.from(files ?? [])) {
      setBusy(`${file.name} wordt gelezen…`);
      try {
        const st = await parseStatementFile(file);
        const ids = await Promise.all(st.transactions.map(transactionId));
        const existing = new Set<string>();
        if (st.transactions.length) {
          const dates = st.transactions.map((t) => t.date).sort();
          const snap = await getDocs(query(col(hid, 'transactions'), where('date', '>=', dates[0]), where('date', '<=', dates[dates.length - 1])));
          snap.docs.forEach((d) => existing.add(d.id));
        }
        const own = new Set((household.ownIbans ?? []).map((i) => i.replace(/\s/g, '').toUpperCase()));
        const stRef = doc(col(hid, 'statements'));
        const fresh = st.transactions.map((t, i) => ({ t, id: ids[i] })).filter((x) => !existing.has(x.id));
        let openCount = 0;
        for (let i = 0; i < fresh.length; i += 400) {
          const batch = writeBatch(db);
          for (const { t, id } of fresh.slice(i, i + 400)) {
            const c = categorize(t, rules.items, own);
            if (!c.cat) openCount++;
            batch.set(docRef(hid, 'transactions', id), {
              date: t.date, month: t.date.slice(0, 7), amount: t.amount, raw: t.raw, kind: t.kind, name: t.name,
              iban: t.iban, description: t.description, place: t.place, bank: st.bank, statementId: stRef.id, ...c,
              createdAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
        await setDoc(stRef, {
          fileName: file.name, status: 'klaar', bank: st.bank, account: st.account, periodFrom: st.periodFrom, periodTo: st.periodTo,
          count: st.transactions.length, newCount: fresh.length, openCount, balanceOk: balanceOk(st),
          openingBalance: st.openingBalance, closingBalance: st.closingBalance, totalDebit: totalDebit(st), totalCredit: totalCredit(st),
          uploadedBy: user.uid, createdAt: serverTimestamp(),
        });
      } catch (e) {
        await addDoc(col(hid, 'statements'), {
          fileName: file.name, status: 'fout', error: e instanceof Error ? e.message : 'Inlezen is mislukt.',
          uploadedBy: user.uid, createdAt: serverTimestamp(),
        });
      }
    }
    setBusy('');
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); };

  // ---------- Vragen ----------
  const queue = txs.items
    .filter((t) => (askAll ? t.by !== 'jij' : !t.cat) && !skipped.includes(t.id))
    .sort((a, b) => a.date.localeCompare(b.date));
  const openTotal = txs.items.filter((t) => (askAll ? t.by !== 'jij' : !t.cat)).length;
  const current = queue[0];

  // ---------- Verwijderen ----------
  const removeStatement = async (s: Statement) => {
    const snap = await getDocs(query(col(hid, 'transactions'), where('statementId', '==', s.id)));
    const msg = snap.size
      ? `Afschrift "${s.fileName}" verwijderen, samen met de ${snap.size} transacties die eruit zijn ingelezen?`
      : `Afschrift "${s.fileName}" uit de lijst verwijderen?`;
    if (!confirm(msg)) return;
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(docRef(hid, 'statements', s.id));
  };
  const removeTx = async (t: Transaction) => {
    if (confirm(`Transactie "${t.name || t.raw.slice(0, 40)}" van ${shortDate(t.date)} (${signedEuro(t.amount)}) verwijderen?`)) {
      await deleteDoc(docRef(hid, 'transactions', t.id));
    }
  };

  const answer = async (t: Transaction, cat: TxCategory) => {
    const chosenLink = link[t.id] ?? t.link ?? '';
    const batch = writeBatch(db);
    batch.update(docRef(hid, 'transactions', t.id), { cat, link: chosenLink, by: 'jij' });
    if (remember && t.name) {
      if (cat === 'eigen' && t.iban) {
        // Eigen rekening: voortaan herkennen aan het IBAN.
        batch.update(doc(db, 'households', hid), { ownIbans: arrayUnion(t.iban) });
      } else if (!rules.items.some((r) => r.match.toLowerCase() === t.name.toLowerCase())) {
        batch.set(doc(col(hid, 'rules')), { match: t.name, iban: t.iban || '', cat, link: chosenLink, createdBy: user.uid });
      }
      // Andere open transacties van dezelfde tegenpartij meteen meenemen.
      txs.items
        .filter((x) => x.id !== t.id && !x.cat && x.name.toLowerCase() === t.name.toLowerCase())
        .forEach((x) => batch.update(docRef(hid, 'transactions', x.id), { cat, link: chosenLink, by: 'regel' }));
    }
    await batch.commit();
    setAnswered((n) => n + 1);
  };

  // ---------- Overzicht van de maand ----------
  const monthTx = txs.items.filter((t) => t.month === activeMonth);
  const budgetPer = cats.groupSums(budgetAmounts(household));
  const spentPer = (g: string) => monthTx.filter((t) => t.amount < 0 && cats.groupOf(t.cat) === g).reduce((s, t) => s - t.amount, 0);
  const incomeIn = monthTx.filter((t) => t.amount > 0 && t.cat === 'inkomen').reduce((s, t) => s + t.amount, 0);

  const sortedStatements = [...statements.items].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

  return (
    <>
      <PageHead eyebrow="Afschriften van je banken" title="Bankimport" />

      <section className="card" aria-labelledby="h-upload">
        <h2 id="h-upload">Afschrift aanleveren</h2>
        <label className={`drop${dragging ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          <Icon name="upload" size={28} stroke="#8FAEF5" />
          <span style={{ fontWeight: 600 }} aria-live="polite">{busy || 'Sleep je afschrift hierheen of klik om te kiezen'}</span>
          <span className="small muted">Nu ondersteund: ABN AMRO PDF “Bij- en afschrijvingen”. ING en ASN volgen.</span>
          <span className="tiny muted">Het afschrift wordt op dit apparaat gelezen; alleen de transacties worden opgeslagen.</span>
          <input type="file" multiple accept={ACCEPT} onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        </label>
        {sortedStatements.length > 0 && (
          <ul className="list">
            {sortedStatements.slice(0, 8).map((s) => (
              <li key={s.id}>
                <div className="stack" style={{ flex: '1 1 260px', gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.fileName}</span>
                  <span className="tiny muted">
                    {s.bank ?? 'Bank wordt herkend'}{s.periodFrom ? ` · ${longDate(s.periodFrom)} t/m ${longDate(s.periodTo!)}` : ''}
                  </span>
                </div>
                <StatementStatus s={s} />
                <button className="btn icon" aria-label={`Afschrift ${s.fileName} verwijderen`} title="Afschrift en de ingelezen transacties verwijderen" onClick={() => removeStatement(s)}><Icon name="x" size={18} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="split">
        <section className={`card question wide${current ? '' : ' done'}`} aria-labelledby="h-vraag" aria-live="polite">
          <div className="card-head">
            <h2 id="h-vraag" style={{ fontSize: 22 }}>Onder welke categorie valt dit?</h2>
            <span className="small muted">{current ? `Nog ${queue.length} ${queue.length === 1 ? 'vraag' : 'vragen'}` : 'Klaar'}</span>
          </div>
          <div className="bar" aria-hidden="true"><span style={{ width: `${openTotal + answered ? (answered / (openTotal + answered)) * 100 : 100}%`, background: 'var(--green)' }} /></div>

          {current ? (
            <QuestionCard t={current} names={cats.names} options={cats.txOptions} remember={remember} setRemember={setRemember} linkValue={link[current.id] ?? current.link ?? ''} linkOptions={linkOptions}
              onLink={(v) => setLink({ ...link, [current.id]: v })} onAnswer={(c) => answer(current, c)} onSkip={() => setSkipped([...skipped, current.id])} />
          ) : skipped.length > 0 ? (
            <div className="notice orange row" style={{ justifyContent: 'space-between' }}>
              <span>Er {skipped.length === 1 ? 'staat nog 1 vraag' : `staan nog ${skipped.length} vragen`} open die je had overgeslagen.</span>
              <button className="btn primary" onClick={() => setSkipped([])}>Nu beantwoorden</button>
            </div>
          ) : (
            <div className="notice green">
              <strong>Alles is ingedeeld.</strong> {answered > 0 ? `Je hebt ${answered} vragen beantwoord; de volgende keer weet de app dit vanzelf.` : txs.items.length ? 'Er zijn geen vragen.' : 'Lever een afschrift aan om te beginnen.'}
            </div>
          )}
        </section>

        <section className="card narrow" aria-labelledby="h-leren">
          <h2 id="h-leren">Wat de app al weet</h2>
          <div className="grid" style={{ '--min': '110px' } as React.CSSProperties}>
            <div className="card inset kpi"><span className="value">{rules.items.length}</span><span className="sub">bekende tegenpartijen</span></div>
            <div className="card inset kpi"><span className="value" style={{ color: 'var(--green)' }}>{answered}</span><span className="sub">nu beantwoord</span></div>
          </div>
          <ul className="stack small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
            <li>Bekende tegenpartijen worden vanzelf ingedeeld; alleen nieuwe en twijfelgevallen worden gevraagd.</li>
            <li>Overboekingen tussen jullie eigen rekeningen herkent de app aan het IBAN en telt ze niet mee.</li>
            <li>Elk afschrift wordt gecontroleerd: beginsaldo + bij − af moet het eindsaldo geven.</li>
          </ul>
          <label className="check" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={askAll} onChange={(e) => { setAskAll(e.target.checked); setSkipped([]); }} style={{ marginTop: 2 }} />
            <span>Vraag alles aan mij, ook bij bekende tegenpartijen</span>
          </label>
        </section>
      </div>

      <section className="card" aria-labelledby="h-maand">
        <div className="card-head">
          <h2 id="h-maand">{activeMonth ? `${capitalize(monthLabel(activeMonth))}: werkelijk vs budget` : 'Werkelijk vs budget'}</h2>
          <div className="row">
            {incomeIn > 0 && <span className="small muted">Inkomen {euro(incomeIn)}</span>}
            {months.length > 0 && (
              <select className="input" style={{ width: 180 }} aria-label="Maand" value={activeMonth} onChange={(e) => setMonth(e.target.value)}>
                {months.map((m) => <option key={m} value={m}>{capitalize(monthLabel(m))}</option>)}
              </select>
            )}
          </div>
        </div>
        <div className="grid" style={{ '--min': '240px' } as React.CSSProperties}>
          {GROUPS.map((g) => {
            const spent = spentPer(g.id);
            const budget = budgetPer[g.id];
            const left = budget - spent;
            return (
              <div key={g.id} className="stack">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="row" style={{ gap: 8, fontWeight: 600 }}><span className="dot" style={{ background: g.color }} />{g.name}</span>
                  <span className="small" style={{ color: left >= 0 ? 'var(--muted)' : 'var(--red)' }}>{left >= 0 ? `nog ${euro(left)}` : `${euro(-left)} over budget`}</span>
                </div>
                <div className="bar" aria-hidden="true"><span style={{ width: `${budget ? Math.min(100, (spent / budget) * 100) : 0}%`, background: g.color }} /></div>
                <span className="small muted">{euro(spent)} van {euro(budget)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" aria-labelledby="h-tx">
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="h-tx">Transacties {activeMonth && `· ${monthLabel(activeMonth)}`}</h2>
          <span className="small muted">{monthTx.length} transacties · een wijziging hier telt ook als antwoord</span>
        </div>
        <div className="table-wrap">
          <table className="rtable" style={{ minWidth: 940 }}>
            <thead><tr><th>Datum</th><th>Omschrijving</th><th className="right">Bedrag</th><th>Categorie</th><th>Hoort bij</th><th>Status</th><th><span className="sr-only">Verwijderen</span></th></tr></thead>
            <tbody>
              {monthTx.map((t) => (
                <tr key={t.id}>
                  <td className="muted nowrap small">{shortDate(t.date)}</td>
                  <td><div className="stack" style={{ gap: 2 }}><span className="strong" style={{ fontWeight: 500 }}>{t.name || t.raw.slice(0, 40)}</span><span className="tiny muted">{t.kind}{t.place ? ` · ${t.place}` : ''}</span></div></td>
                  <td className="right nowrap first" style={{ fontWeight: 600, color: t.amount > 0 ? 'var(--green)' : undefined }}>{signedEuro(t.amount)}</td>
                  <td className="full">
                    <select className="input" style={{ width: 210, minHeight: 40 }} aria-label={`Categorie voor ${t.name}`} value={t.cat} onChange={(e) => e.target.value && answer(t, e.target.value as TxCategory)}>
                      <option value="">Nog niet ingedeeld</option>
                      {cats.txOptions.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                    </select>
                  </td>
                  <td className="full">
                    <select className="input" style={{ width: 170, minHeight: 40 }} aria-label={`Hoort bij, voor ${t.name}`} value={t.link || ''} onChange={(e) => updateDoc(docRef(hid, 'transactions', t.id), { link: e.target.value })}>
                      {linkOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="span2">{!t.cat ? <span className="pill orange">Wacht op jou</span> : t.by === 'jij' ? <span className="pill green">Door jou</span> : <span className="pill blue">Bekend</span>}</td>
                  <td><button className="btn icon" aria-label={`Transactie ${t.name} van ${shortDate(t.date)} verwijderen`} title="Verwijderen" onClick={() => removeTx(t)}><Icon name="x" size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!monthTx.length && <p className="muted small">Nog geen transacties. Lever hierboven een afschrift aan.</p>}
      </section>

      <section className="card" aria-labelledby="h-regels">
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="h-regels">Geleerde tegenpartijen</h2>
          <span className="small muted">Uit jullie antwoorden. Verwijder er een als de app het voortaan weer moet vragen.</span>
        </div>
        <ul className="list">
          {rules.items.map((r) => (
            <li key={r.id}>
              <span className="strong" style={{ flex: '1 1 220px' }}>{r.match}</span>
              <span className="row" style={{ flex: '1 1 220px', gap: 8 }}><Icon name="arrow" size={16} />{cats.names[r.cat] ?? r.cat}</span>
              <span className="muted small" style={{ flex: '0 1 160px' }}>{r.link ? linkName(r.link) : ''}</span>
              <button className="btn icon" aria-label={`${r.match} vergeten`} onClick={() => deleteDoc(docRef(hid, 'rules', r.id))}><Icon name="x" size={18} /></button>
            </li>
          ))}
        </ul>
        {!rules.items.length && <p className="muted small">Nog niets geleerd. Elke vraag die je beantwoordt komt hier.</p>}
      </section>
    </>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function StatementStatus({ s }: { s: Statement }) {
  if (s.status === 'fout') return <span className="pill red" title={s.error}>{s.error || 'Mislukt'}</span>;
  if (s.status !== 'klaar') return <span className="pill blue">Wordt verwerkt…</span>;
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className="pill green">{s.count} transacties{s.newCount !== s.count ? ` · ${s.newCount} nieuw` : ''}</span>
      {s.balanceOk === true && <span className="pill green"><Icon name="check" size={12} />saldo klopt</span>}
      {s.balanceOk === false && <span className="pill red">saldo klopt niet, controleer</span>}
      {!!s.openCount && <span className="pill orange">{s.openCount} vragen</span>}
    </span>
  );
}

function QuestionCard({ t, names, options: catOptions, remember, setRemember, linkValue, linkOptions, onLink, onAnswer, onSkip }: {
  t: Transaction; names: Record<string, string>; options: [string, string][]; remember: boolean; setRemember: (v: boolean) => void; linkValue: string;
  linkOptions: { value: string; label: string }[]; onLink: (v: string) => void; onAnswer: (c: TxCategory) => void; onSkip: () => void;
}) {
  const options = [t.guess || t.cat, ...(t.alts ?? [])].filter((x, i, a): x is TxCategory => !!x && a.indexOf(x) === i).slice(0, 3);
  const hint = t.by === 'regel' ? 'Dit ken ik al. Klopt het nog?' : t.conf >= 80 ? 'Ik denk dat ik het weet, maar check het even:' : options.length ? 'Ik weet het niet zeker. Mijn suggesties:' : 'Dit ken ik nog niet. Kies een categorie:';
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card inset row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <span className="display strong" style={{ fontSize: 22 }}>{t.name || 'Onbekende tegenpartij'}</span>
          <span className="small muted">{longDate(t.date)} · {t.bank} · {t.kind}{t.place ? ` · ${t.place}` : ''}</span>
        </div>
        <span className="display" style={{ fontSize: 24, fontWeight: 600, color: t.amount > 0 ? 'var(--green)' : 'var(--strong)' }}>{signedEuro(t.amount)}</span>
      </div>
      <div className="stack">
        <span className="tiny muted">Zo staat het op je afschrift</span>
        <code className="raw">{t.raw}</code>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <span className="small muted">{hint}</span>
        <div className="row" style={{ gap: 8 }}>
          {options.map((c, i) => (
            <button key={c} type="button" className={`chip${i === 0 ? ' suggest' : ''}`} onClick={() => onAnswer(c)}>
              {names[c] ?? c}{i === 0 && <small>{t.by === 'regel' ? 'bekend' : t.conf ? `suggestie · ${t.conf}%` : ''}</small>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid">
        <div className="field">
          <label htmlFor="q-other">Iets anders?</label>
          <select id="q-other" className="input" value="" onChange={(e) => e.target.value && onAnswer(e.target.value as TxCategory)}>
            <option value="">Kies een andere categorie…</option>
            {catOptions.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="q-link">Voor wie of waarvoor?</label>
          <select id="q-link" className="input" value={linkValue} onChange={(e) => onLink(e.target.value)}>
            {linkOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
        <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Onthoud dit voor “{t.name}”</label>
        <button className="btn" onClick={onSkip}>Later beantwoorden</button>
      </div>
    </div>
  );
}
