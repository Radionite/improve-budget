import { useState, type FormEvent } from 'react';
import { arrayUnion, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useData } from '../lib/data';
import { recommend } from '../lib/budget';

export function OnboardingPage() {
  const { user } = useData();
  const [name, setName] = useState('Ons huishouden');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const myName = user.displayName || user.email?.split('@')[0] || 'Ik';

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const situation = { adults: 2, kids: 0, pets: false, cars: 0 };
      const ref = doc(collection(db, 'households'));
      await setDoc(ref, {
        name: name.trim() || 'Ons huishouden',
        members: [user.uid],
        memberNames: { [user.uid]: myName },
        inviteCode: '',
        income: 0,
        situation,
        budget: recommend(situation, { studieschuld: 0, lening: 0 }),
        ownIbans: [],
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'users', user.uid), { householdId: ref.id }, { merge: true });
    } catch {
      setError('Aanmaken is niet gelukt. Probeer het opnieuw.');
      setBusy(false);
    }
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const c = code.trim().toUpperCase();
    try {
      const inv = await getDoc(doc(db, 'invites', c));
      if (!inv.exists()) throw new Error('code');
      const hid = inv.data().householdId as string;
      await updateDoc(doc(db, 'households', hid), {
        members: arrayUnion(user.uid),
        [`memberNames.${user.uid}`]: myName,
        joinCode: c,
      });
      await setDoc(doc(db, 'users', user.uid), { householdId: hid }, { merge: true });
    } catch {
      setError('Deze uitnodigingscode werkt niet. Vraag een nieuwe code in Instellingen.');
      setBusy(false);
    }
  };

  return (
    <div className="center-screen">
      <div className="stack" style={{ width: 'min(520px, 100%)', gap: 16 }}>
        <h1>Welkom, {myName}</h1>
        <p className="muted">Maak een nieuw huishouden aan, of doe mee met dat van je partner via een uitnodigingscode.</p>
        <form className="card" onSubmit={create}>
          <h2>Nieuw huishouden</h2>
          <div className="field"><label htmlFor="hn">Naam</label><input id="hn" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <button className="btn primary" disabled={busy}>Aanmaken</button>
        </form>
        <form className="card" onSubmit={join}>
          <h2>Meedoen met een huishouden</h2>
          <div className="field"><label htmlFor="code">Uitnodigingscode</label><input id="code" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Bijv. K7M2Q9XA" autoCapitalize="characters" /></div>
          <button className="btn" disabled={busy || !code.trim()}>Meedoen</button>
        </form>
        {error && <p className="notice red" role="alert">{error}</p>}
        <button className="btn ghost" onClick={() => signOut(auth)}>Uitloggen</button>
      </div>
    </div>
  );
}
