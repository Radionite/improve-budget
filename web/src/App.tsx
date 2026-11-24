import { Navigate, Route, Routes } from 'react-router-dom';
import { firebaseConfigured } from './firebase';
import { useData } from './lib/data';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/Auth';
import { OnboardingPage } from './pages/Onboarding';
import { OverzichtPage } from './pages/Overzicht';
import { BudgetPage } from './pages/Budget';
import { HuishoudenPage } from './pages/Huishouden';
import { ImportPage } from './pages/Import';
import { FacturenPage } from './pages/Facturen';
import { BeleggenPage } from './pages/Beleggen';
import { LeningenPage } from './pages/Leningen';
import { InstellingenPage } from './pages/Instellingen';
import { RapportPage } from './pages/Rapport';

export function App() {
  const { user, loading, household } = useData();

  if (!firebaseConfigured) {
    return (
      <div className="center-screen">
        <div className="card auth-card">
          <h1>Gezinsbank</h1>
          <p className="muted">Firebase is nog niet ingesteld. Kopieer <code>web/.env.example</code> naar <code>web/.env</code> en vul de gegevens van je Firebase-project in. Zie de README.</p>
        </div>
      </div>
    );
  }
  if (loading) return <div className="center-screen muted">Laden…</div>;
  if (!user) return <AuthPage />;
  if (!household) return <OnboardingPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverzichtPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="huishouden" element={<HuishoudenPage />} />
        <Route path="bankimport" element={<ImportPage />} />
        <Route path="facturen" element={<FacturenPage />} />
        <Route path="beleggen" element={<BeleggenPage />} />
        <Route path="leningen" element={<LeningenPage />} />
        <Route path="rapport" element={<RapportPage />} />
        <Route path="instellingen" element={<InstellingenPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
