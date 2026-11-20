import { useState } from 'react';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { PageHead } from '../components/Layout';
import { TextField } from '../components/Fields';
import { Icon } from '../components/Icon';
import { col, useData } from '../lib/data';

const SUBCOLLECTIONS = ['people', 'pets', 'vehicles', 'loans', 'invoices', 'statements', 'transactions', 'rules'];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const newCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
};

export function InstellingenPage() {
  const { household, hid, user, update } = useData();
  const [iban, setIban] = useState('');
  const [exporting, setExporting] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  if (!household || !hid || !user) return null;

  const createInvite = async () => {
    if (household.inviteCode) await deleteDoc(doc(db, 'invites', household.inviteCode)).catch(() => {});
    const code = newCode();
    await setDoc(doc(db, 'invites', code), { householdId: hid, createdBy: user.uid });
    await update({ inviteCode: code });
  };
  const revokeInvite = async () => {
    if (household.inviteCode) await deleteDoc(doc(db, 'invites', household.inviteCode)).catch(() => {});
    await update({ inviteCode: '' });
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const data: Record<string, unknown> = { app: 'gezinsbank', version: 1, exportedAt: new Date().toISOString(), household };
      for (const name of SUBCOLLECTIONS) {
        const snap = await getDocs(col(hid, name));
        data[name] = await Promise.all(snap.docs.map(async (d) => {
          const row: Record<string, unknown> = { id: d.id, ...d.data() };
          if (name === 'invoices' && d.data().fileChunks) {
            row.files = (await getDocs(collection(d.ref, 'files'))).docs.map((f) => f.data());
          }
          return row;
        }));
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gezinsbank-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setRestoreMsg('');
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'gezinsbank') throw new Error('Dit is geen back-up van Gezinsbank.');
      if (!confirm(`Back-up van ${new Date(data.exportedAt).toLocaleString('nl-NL')} terugzetten? Bestaande gegevens met dezelfde id worden overschreven.`)) return;
      setRestoreMsg('Bezig met terugzetten…');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, members: _m, memberNames: _n, inviteCode: _c, joinCode: _j, ...fields } = data.household ?? {};
      await update(fields);
      let count = 0;
      for (const name of SUBCOLLECTIONS) {
        const rows = (data[name] ?? []) as Record<string, unknown>[];
        for (let i = 0; i < rows.length; i += 300) {
          const batch = writeBatch(db);
          for (const { id, files, ...rest } of rows.slice(i, i + 300) as { id: string; files?: { n: number; data: string }[] }[]) {
            const ref = doc(col(hid, name), id);
            batch.set(ref, rest);
            files?.forEach((f) => batch.set(doc(collection(ref, 'files'), String(f.n)), f));
            count++;
          }
          await batch.commit();
        }
      }
      setRestoreMsg(`Klaar: ${count} items teruggezet.`);
    } catch (e) {
      setRestoreMsg(e instanceof Error ? e.message : 'Terugzetten is mislukt.');
    }
  };

  const addIban = async () => {
    const v = iban.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(v)) return;
    await update({ ownIbans: arrayUnion(v) });
    setIban('');
  };

  return (
    <>
      <PageHead eyebrow="Huishouden delen en gegevens bewaren" title="Instellingen" />

      <section className="card" aria-labelledby="h-hh">
        <h2 id="h-hh">Huishouden</h2>
        <div style={{ maxWidth: 360 }}><TextField label="Naam" value={household.name} onSave={(v) => update({ name: v })} /></div>
        <div className="stack">
          <span className="label">Leden</span>
          <ul className="list">
            {household.members.map((uid) => (
              <li key={uid}><span className="strong">{household.memberNames?.[uid] ?? 'Lid'}</span>{uid === user.uid && <span className="pill gray">jij</span>}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card" aria-labelledby="h-invite">
        <h2 id="h-invite">Partner uitnodigen</h2>
        <p className="small muted">Je partner maakt een eigen account aan en kiest “Meedoen met een huishouden” met deze code. Daarna zien jullie allebei dezelfde gegevens.</p>
        {household.inviteCode ? (
          <div className="row">
            <span className="display strong" style={{ fontSize: 28, letterSpacing: '0.12em' }}>{household.inviteCode}</span>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(household.inviteCode)}>Kopiëren</button>
            <button className="btn" onClick={createInvite}>Nieuwe code</button>
            <button className="btn ghost" onClick={revokeInvite}>Intrekken</button>
          </div>
        ) : (
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={createInvite}>Uitnodigingscode maken</button>
        )}
        <p className="tiny muted">Trek de code in zodra je partner lid is, dan kan niemand anders er nog mee binnenkomen.</p>
      </section>

      <section className="card" aria-labelledby="h-iban">
        <h2 id="h-iban">Eigen rekeningen</h2>
        <p className="small muted">Overboekingen van en naar deze rekeningen tellen niet als uitgave of inkomen. De app voegt ze ook toe als je bij een vraag “Eigen rekening” kiest.</p>
        <ul className="list">
          {(household.ownIbans ?? []).map((i) => (
            <li key={i}><code style={{ flex: 1 }}>{i}</code><button className="btn icon" aria-label={`${i} verwijderen`} onClick={() => update({ ownIbans: arrayRemove(i) })}><Icon name="x" size={18} /></button></li>
          ))}
        </ul>
        <div className="row">
          <input className="input" style={{ maxWidth: 320 }} aria-label="IBAN toevoegen" placeholder="NL00BANK0123456789" value={iban} onChange={(e) => setIban(e.target.value)} />
          <button className="btn" onClick={addIban}><Icon name="plus" size={16} />Toevoegen</button>
        </div>
      </section>

      <section className="card" aria-labelledby="h-backup">
        <h2 id="h-backup">Back-ups</h2>
        <ul className="stack small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li><strong>Automatisch:</strong> elke nacht maakt GitHub een versleutelde back-up van alles (instellen: zie de README). Die wordt 90 dagen bewaard.</li>
          <li><strong>Zelf bewaren:</strong> download hieronder alles als één bestand, inclusief de facturen en foto's, en bewaar het waar je wilt.</li>
        </ul>
        <div className="row">
          <button className="btn" onClick={exportAll} disabled={exporting}><Icon name="download" size={18} />{exporting ? 'Bezig…' : 'Alles downloaden'}</button>
          <label className="btn" style={{ position: 'relative' }}>
            <Icon name="upload" size={18} />Back-up terugzetten
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
        {restoreMsg && <p className="notice blue" role="status">{restoreMsg}</p>}
      </section>

      <section className="card" aria-labelledby="h-acc">
        <h2 id="h-acc">Account</h2>
        <p className="small muted">Ingelogd als {user.email}</p>
        <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => signOut(auth)}><Icon name="logout" size={18} />Uitloggen</button>
      </section>
    </>
  );
}
