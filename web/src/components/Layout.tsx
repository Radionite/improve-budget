import { NavLink, Outlet } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useData } from '../lib/data';
import { Icon } from './Icon';

const NAV = [
  { to: '/', label: 'Overzicht', icon: 'grid' },
  { to: '/budget', label: 'Budget', icon: 'pie' },
  { to: '/huishouden', label: 'Huishouden', icon: 'users' },
  { to: '/bankimport', label: 'Bankimport', icon: 'bank' },
  { to: '/facturen', label: 'Facturen & garanties', icon: 'file' },
  { to: '/beleggen', label: 'Beleggen', icon: 'trend' },
  { to: '/leningen', label: 'Studie & leningen', icon: 'cap' },
  { to: '/instellingen', label: 'Instellingen', icon: 'gear' },
];

export function Layout() {
  const { household, user } = useData();
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><Icon name="home" size={28} stroke="#8FAEF5" />Gezinsbank</div>
        <nav aria-label="Hoofdmenu">
          <ul className="nav">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon name={n.icon} />{n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="side-foot">
          <span>{household?.name}</span>
          <span className="tiny">{user?.email}</span>
          <button className="btn ghost" style={{ justifyContent: 'flex-start', padding: 0 }} onClick={() => signOut(auth)}>
            <Icon name="logout" size={18} />Uitloggen
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="page"><Outlet /></div>
      </main>
    </div>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children && <div className="row">{children}</div>}
    </header>
  );
}
