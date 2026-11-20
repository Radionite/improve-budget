import { useState } from 'react';
import { arrayRemove, arrayUnion, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
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
      const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), household };
      for (const name of SUBCOLLECTIONS) {
        const snap = await getDocs(col(hid, name));
        data[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `huisbudget-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
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
          <li><strong>Automatisch:</strong> Firebase maakt dagelijks een back-up van de database (instellen: zie de README). Die kan worden teruggezet als er iets misgaat.</li>
          <li><strong>Zelf bewaren:</strong> download hieronder al je gegevens als één bestand en bewaar het waar je wilt.</li>
        </ul>
        <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={exportAll} disabled={exporting}><Icon name="download" size={18} />{exporting ? 'Bezig…' : 'Alles downloaden (JSON)'}</button>
        <p className="tiny muted">Facturen en foto's zelf staan in Firebase Storage en zitten niet in dit bestand; die worden apart meegenomen in de automatische back-up.</p>
      </section>

      <section className="card" aria-labelledby="h-acc">
        <h2 id="h-acc">Account</h2>
        <p className="small muted">Ingelogd als {user.email}</p>
        <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => signOut(auth)}><Icon name="logout" size={18} />Uitloggen</button>
      </section>
    </>
  );
}
