import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useData } from '../lib/data';
import { Icon } from './Icon';

const NAV = [
  { to: '/', label: 'Overzicht', short: 'Overzicht', icon: 'grid' },
  { to: '/budget', label: 'Budget', short: 'Budget', icon: 'pie' },
  { to: '/huishouden', label: 'Huishouden', short: 'Huishouden', icon: 'users' },
  { to: '/bankimport', label: 'Bankimport', short: 'Import', icon: 'bank' },
  { to: '/facturen', label: 'Facturen & garanties', short: 'Facturen', icon: 'file' },
  { to: '/beleggen', label: 'Beleggen', short: 'Beleggen', icon: 'trend' },
  { to: '/leningen', label: 'Studie & leningen', short: 'Leningen', icon: 'cap' },
  { to: '/rapport', label: 'PDF-rapport', short: 'Rapport', icon: 'download' },
  { to: '/instellingen', label: 'Instellingen', short: 'Instellingen', icon: 'gear' },
];
/** Op de telefoon staan deze onderaan; de rest zit onder "Meer". */
const BOTTOM = ['/', '/budget', '/bankimport', '/facturen'];

export function Layout() {
  const { household, user } = useData();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setMoreOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  const moreActive = !BOTTOM.includes(location.pathname);

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

      <header className="mobile-top">
        <span className="brand" style={{ padding: 0, fontSize: 17 }}><Icon name="home" size={22} stroke="#8FAEF5" />Gezinsbank</span>
        <span className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{household?.name}</span>
      </header>

      <main className="main">
        <div className="page"><Outlet /></div>
      </main>

      <nav className="bottom-nav" aria-label="Menu">
        {NAV.filter((n) => BOTTOM.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={n.icon} size={22} />{n.short}
          </NavLink>
        ))}
        <button type="button" className={moreActive ? 'active' : ''} aria-expanded={moreOpen} aria-controls="meer-menu" onClick={() => setMoreOpen(!moreOpen)}>
          <Icon name="menu" size={22} />Meer
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div id="meer-menu" className="sheet" role="dialog" aria-label="Meer" onClick={(e) => e.stopPropagation()}>
            <ul className="nav" style={{ flexDirection: 'column', flexWrap: 'nowrap' }}>
              {NAV.filter((n) => !BOTTOM.includes(n.to)).map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={n.icon} />{n.label}</NavLink>
                </li>
              ))}
            </ul>
            <div className="row small muted" style={{ justifyContent: 'space-between', padding: '8px 12px 0', borderTop: '1px solid var(--line-soft)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
              <button className="btn ghost" onClick={() => signOut(auth)}><Icon name="logout" size={18} />Uitloggen</button>
            </div>
          </div>
        </div>
      )}
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
      {children && <div className="row page-actions">{children}</div>}
    </header>
  );
}
