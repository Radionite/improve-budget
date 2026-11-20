import { useState, type FormEvent } from 'react';
import { addDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteFile, loadFile, MAX_FILE_BYTES, prepareFile, saveFile } from '../lib/files';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { byDateDesc, col, docRef, useCollection, useData } from '../lib/data';
import { daysUntil, euro, longDate, num } from '../lib/format';
import type { Invoice } from '../lib/types';

type Status = 'actief' | 'binnenkort' | 'verlopen';

export function warrantyInfo(inv: Invoice) {
  const until = new Date(inv.date);
  until.setFullYear(until.getFullYear() + (inv.warrantyYears || 0));
  const untilIso = until.toISOString().slice(0, 10);
  const days = daysUntil(untilIso);
  const total = (until.getTime() - new Date(inv.date).getTime()) / 86_400_000 || 1;
  const status: Status = days < 0 ? 'verlopen' : days <= 90 ? 'binnenkort' : 'actief';
  return { untilIso, days, status, leftPct: Math.max(0, Math.min(100, (days / total) * 100)) };
}

const STATUS_STYLE: Record<Status, { pill: string; bar: string; label: string }> = {
  actief: { pill: 'green', bar: '#4CAF7D', label: 'Actief' },
  binnenkort: { pill: 'orange', bar: '#E89B54', label: 'Verloopt binnenkort' },
  verlopen: { pill: 'gray', bar: '#4A544F', label: 'Verlopen' },
};

export function FacturenPage() {
  const { hid } = useData();
  const invoices = useCollection<Invoice>('invoices', byDateDesc);
  const [filter, setFilter] = useState<'alle' | Status>('alle');
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ product: '', shop: '', date: new Date().toISOString().slice(0, 10), amount: '', warrantyYears: '2', remind: true });
  if (!hid) return null;

  const rows = invoices.items
    .map((i) => ({ ...i, w: warrantyInfo(i) }))
    .filter((i) => filter === 'alle' || i.w.status === filter)
    .filter((i) => !search || `${i.product} ${i.shop}`.toLowerCase().includes(search.toLowerCase()));
  const count = (s: 'alle' | Status) => (s === 'alle' ? invoices.items.length : invoices.items.filter((i) => warrantyInfo(i).status === s).length);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.product.trim()) return;
    setBusy(true);
    setError('');
    try {
      const file = files[0];
      const blob = file ? await prepareFile(file) : null;
      if (blob && blob.size > MAX_FILE_BYTES) throw new Error('Dit bestand is groter dan 8 MB. Maak een kleinere foto of PDF.');
      const docu = await addDoc(col(hid, 'invoices'), {
        product: form.product.trim(), shop: form.shop.trim(), date: form.date, amount: num(form.amount),
        warrantyYears: num(form.warrantyYears), remind: form.remind, createdAt: serverTimestamp(),
      });
      if (file && blob) {
        const chunks = await saveFile(docu, blob);
        await updateDoc(docu, { fileName: file.name, fileType: blob.type || file.type, fileChunks: chunks });
      }
      setForm({ ...form, product: '', shop: '', amount: '' });
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan is mislukt.');
    } finally {
      setBusy(false);
    }
  };

  const open = async (inv: Invoice) => {
    if (!inv.fileChunks) return;
    const tab = window.open('', '_blank');
    const blob = await loadFile(docRef(hid, 'invoices', inv.id), inv.fileType ?? '');
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  };
  const remove = async (inv: Invoice) => {
    if (!confirm(`Factuur van ${inv.product} verwijderen?`)) return;
    await deleteFile(docRef(hid, 'invoices', inv.id));
    await deleteDoc(docRef(hid, 'invoices', inv.id));
  };

  return (
    <>
      <PageHead eyebrow={`${invoices.items.length} facturen · totaal ${euro(invoices.items.reduce((s, i) => s + (i.amount || 0), 0))}`} title="Facturen & garanties" />
      <div className="split">
        <section className="card wide" aria-labelledby="h-lijst">
          <h2 id="h-lijst">Mijn aankopen</h2>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="seg" role="group" aria-label="Filter op status">
              {(['alle', 'actief', 'binnenkort', 'verlopen'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}>
                  {s === 'alle' ? 'Alle' : STATUS_STYLE[s].label} <span style={{ opacity: 0.75 }}>{count(s)}</span>
                </button>
              ))}
            </div>
            <input className="input" style={{ maxWidth: 240 }} type="search" aria-label="Zoeken" placeholder="Zoek product of winkel" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="table-wrap">
            <table style={{ minWidth: 760 }}>
              <thead><tr><th>Product</th><th>Gekocht</th><th className="right">Bedrag</th><th>Garantie</th><th>Status</th><th><span className="sr-only">Acties</span></th></tr></thead>
              <tbody>
                {rows.map((i) => {
                  const s = STATUS_STYLE[i.w.status];
                  return (
                    <tr key={i.id}>
                      <td><div className="stack" style={{ gap: 2 }}><span className="strong">{i.product}</span><span className="small muted">{i.shop}</span></div></td>
                      <td className="nowrap">{longDate(i.date)}</td>
                      <td className="right nowrap">{euro(i.amount)}</td>
                      <td style={{ minWidth: 160 }}>
                        <div className="stack" style={{ gap: 6 }}>
                          <span className="nowrap">tot {longDate(i.w.untilIso)}</span>
                          <div className="bar" style={{ height: 6 }} aria-hidden="true"><span style={{ width: `${i.w.leftPct}%`, background: s.bar }} /></div>
                        </div>
                      </td>
                      <td><span className={`pill ${s.pill}`}>{i.w.status === 'binnenkort' ? `Nog ${i.w.days} dagen` : s.label}</span></td>
                      <td className="right nowrap">
                        {!!i.fileChunks && <button className="btn" style={{ minHeight: 40 }} onClick={() => open(i)} aria-label={`Bijlage van ${i.product} openen`}><Icon name="file" size={16} />{i.fileType?.startsWith('image/') ? 'Foto' : 'PDF'}</button>}
                        <button className="btn icon" aria-label={`${i.product} verwijderen`} onClick={() => remove(i)}><Icon name="x" size={18} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!rows.length && <p className="muted small">Geen facturen{filter !== 'alle' ? ' met deze status' : ''}.</p>}
        </section>

        <form className="card narrow" onSubmit={submit} aria-labelledby="h-nieuw">
          <h2 id="h-nieuw">Nieuwe factuur</h2>
          <label className="drop">
            <Icon name="upload" size={28} stroke="#8FAEF5" />
            <span style={{ fontWeight: 600 }}>{files[0] ? files[0].name : 'Foto of PDF kiezen'}</span>
            <span className="small muted">Of sleep het bestand hierheen</span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </label>
          <label className="btn" style={{ position: 'relative' }}>
            <Icon name="camera" size={18} />Foto van bon maken
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </label>
          <div className="field"><label htmlFor="f-p">Product</label><input id="f-p" className="input" required value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Bijv. vaatwasser" /></div>
          <div className="field"><label htmlFor="f-s">Winkel</label><input id="f-s" className="input" value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} /></div>
          <div className="grid" style={{ '--min': '120px' } as React.CSSProperties}>
            <div className="field"><label htmlFor="f-d">Aankoopdatum</label><input id="f-d" className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="field"><label htmlFor="f-a">Bedrag (€)</label><input id="f-a" className="input" type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          </div>
          <div className="field">
            <label htmlFor="f-g">Garantieduur</label>
            <select id="f-g" className="input" value={form.warrantyYears} onChange={(e) => setForm({ ...form, warrantyYears: e.target.value })}>
              {[1, 2, 3, 5, 10].map((y) => <option key={y} value={y}>{y} jaar</option>)}
            </select>
          </div>
          <label className="check"><input type="checkbox" checked={form.remind} onChange={(e) => setForm({ ...form, remind: e.target.checked })} />Herinner mij 30 dagen voor het einde</label>
          {error && <p className="notice red" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy}>{busy ? 'Opslaan…' : 'Factuur opslaan'}</button>
          <p className="tiny muted">Foto's worden verkleind opgeslagen; PDF's tot 8 MB.</p>
        </form>
      </div>
    </>
  );
}
