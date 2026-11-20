import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { Icon } from '../components/Icon';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'E-mailadres of wachtwoord klopt niet.',
  'auth/email-already-in-use': 'Er bestaat al een account met dit e-mailadres.',
  'auth/weak-password': 'Kies een wachtwoord van minstens 8 tekens.',
  'auth/invalid-email': 'Dit is geen geldig e-mailadres.',
  'auth/too-many-requests': 'Te veel pogingen. Probeer het over een paar minuten opnieuw.',
};

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (password.length < 8) throw { code: 'auth/weak-password' };
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() || email.split('@')[0] });
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(MESSAGES[code] ?? 'Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError(''); setInfo('');
    if (!email) { setError('Vul eerst je e-mailadres in.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo('Je ontvangt een e-mail om je wachtwoord opnieuw in te stellen.');
    } catch {
      setError('Versturen is niet gelukt. Controleer het e-mailadres.');
    }
  };

  return (
    <div className="center-screen">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand" style={{ padding: 0 }}><Icon name="home" size={28} stroke="#8FAEF5" />Huisbudget</div>
        <h1 style={{ fontSize: 26 }}>{mode === 'login' ? 'Inloggen' : 'Account maken'}</h1>
        {mode === 'register' && (
          <div className="field"><label htmlFor="name">Je naam</label><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
        )}
        <div className="field"><label htmlFor="email">E-mailadres</label><input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
        <div className="field"><label htmlFor="pw">Wachtwoord</label><input id="pw" className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
        {error && <p className="notice red" role="alert">{error}</p>}
        {info && <p className="notice green" role="status">{info}</p>}
        <button className="btn primary" disabled={busy}>{mode === 'login' ? 'Inloggen' : 'Account maken'}</button>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Nog geen account? Maak er een' : 'Ik heb al een account'}
          </button>
          {mode === 'login' && <button type="button" className="btn ghost" onClick={reset}>Wachtwoord vergeten</button>}
        </div>
      </form>
    </div>
  );
}
