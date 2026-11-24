import { useCallback, useState } from 'react';
import { api, clearSession, getStoredSession, storeSession } from './api.js';
import Login from './screens/Login.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Members from './screens/Members.jsx';
import Bills from './screens/Bills.jsx';
import Leaderboard from './screens/Leaderboard.jsx';
import Trips from './screens/Trips.jsx';
import AdminApp from './admin/AdminApp.jsx';
import { useOnline } from './useOnline.js';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'members', label: 'Members' },
  { id: 'bills', label: 'Add bill' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'trips', label: 'Trips' },
];

export default function App() {
  const [session, setSession] = useState(getStoredSession);
  const online = useOnline();
  const [tab, setTab] = useState('dashboard');
  const [billMemberId, setBillMemberId] = useState('');
  const token = session?.token;

  const endSession = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  // Stable reference so screen effects do not re-run on every render.
  const call = useCallback(
    (path, options = {}) =>
      api(path, { ...options, token }).catch((err) => {
        if (err.status === 401) endSession();
        throw err;
      }),
    [token, endSession]
  );

  function goToTab(id) {
    setBillMemberId('');
    setTab(id);
  }

  function addBillFor(memberId) {
    setBillMemberId(String(memberId));
    setTab('bills');
  }

  function handleLogin(newSession) {
    storeSession(newSession);
    setSession(newSession);
    goToTab('dashboard');
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST', token });
    } catch {
      // Session may already be expired on the server; local logout still applies.
    }
    endSession();
  }

  // The app needs a live connection for both roles.
  if (!online) {
    return (
      <div className="login">
        <h1>No internet connection</h1>
        <p className="muted">Balaji Tiles needs internet. This screen updates when you are back online.</p>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  if (session.user.role === 'admin') {
    return <AdminApp call={call} onLogout={logout} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="logo" src="/logo.svg" alt="Balaji Tiles" />
          <strong>{session.branchName}</strong>
        </div>
        <button className="link" onClick={logout}>Log out</button>
      </header>

      <main className="content">
        {tab === 'dashboard' && <Dashboard call={call} />}
        {tab === 'members' && <Members call={call} onAddBill={addBillFor} />}
        {tab === 'bills' && (
          <Bills call={call} branchName={session.branchName} presetMemberId={billMemberId} />
        )}
        {tab === 'leaderboard' && <Leaderboard call={call} />}
        {tab === 'trips' && <Trips call={call} />}
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => goToTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
