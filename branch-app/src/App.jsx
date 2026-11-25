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
  { id: 'dashboard', label: 'Home' },
  { id: 'add-member', label: 'Add Member' },
  { id: 'members', label: 'View Member' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'trips', label: 'Trip Eligibility' },
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
        <p className="muted">Balaji Group needs internet. This screen updates when you are back online.</p>
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
      <div className="app-head">
        <header className="topbar">
          <div className="brand">
            <img className="logo" src="/logo.svg" alt="Balaji Group logo" />
            <div className="brand-text">
              <strong className="brand-name">BALAJI GROUP</strong>
              <span className="brand-sub">CONTRACTOR REWARDS PROGRAM</span>
            </div>
          </div>
          <div className="topbar-user">
            <span>Welcome, <strong>{session.user.username}</strong></span>
            <span>Selected Branch: <strong>{session.branchName}</strong></span>
            <button className="logout" onClick={logout}>Log out</button>
          </div>
        </header>

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

      <main className="content">
        {tab === 'dashboard' && <Dashboard call={call} branchName={session.branchName} />}
        {tab === 'add-member' && <Members call={call} mode="add" />}
        {tab === 'members' && <Members call={call} mode="view" onAddBill={addBillFor} />}
        {tab === 'bills' && (
          <Bills
            call={call}
            branchName={session.branchName}
            presetMemberId={billMemberId}
            onBack={() => goToTab('members')}
          />
        )}
        {tab === 'leaderboard' && <Leaderboard call={call} />}
        {tab === 'trips' && <Trips call={call} />}
      </main>
    </div>
  );
}
