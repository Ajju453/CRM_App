import { useState } from 'react';
import Owners from './Owners.jsx';
import ShowroomDetail from './ShowroomDetail.jsx';
import Leaderboard from './Leaderboard.jsx';
import './admin.css';

const TABS = [
  { id: 'showrooms', label: 'Showrooms' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

export default function AdminApp({ call, onLogout }) {
  const [tab, setTab] = useState('showrooms');
  const [branchId, setBranchId] = useState(null);

  function switchTab(id) {
    setBranchId(null);
    setTab(id);
  }

  let screen;
  if (tab === 'leaderboard') {
    screen = <Leaderboard call={call} />;
  } else if (branchId) {
    screen = <ShowroomDetail call={call} branchId={branchId} onBack={() => setBranchId(null)} />;
  } else {
    screen = <Owners call={call} onSelectShowroom={setBranchId} />;
  }

  return (
    <div className="adm-app">
      <header className="adm-topbar">
        <div className="adm-title">Balaji Admin</div>
        <button className="adm-link" onClick={onLogout}>
          Log out
        </button>
      </header>

      <main className="adm-content">{screen}</main>

      <nav className="adm-tabbar" aria-label="Admin">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => switchTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
