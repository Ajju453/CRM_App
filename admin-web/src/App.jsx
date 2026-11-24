import { useCallback, useEffect, useState } from 'react';
import { api, clearSession, formatDate, getStoredSession, storeSession } from './api.js';
import Login from './screens/Login.jsx';
import Owners from './screens/Owners.jsx';
import Leaderboard from './screens/Leaderboard.jsx';
import ShowroomDetail from './screens/ShowroomDetail.jsx';

const TABS = [
  { id: 'owners', label: 'Showrooms' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

export default function App() {
  const [session, setSession] = useState(() => {
    const stored = getStoredSession();
    return stored?.user?.role === 'admin' ? stored : null;
  });
  const [tab, setTab] = useState('owners');
  const [showroomId, setShowroomId] = useState(null);
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

  function handleLogin(newSession) {
    storeSession(newSession);
    setSession(newSession);
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST', token });
    } catch {
      // Session may already be expired on the server; local logout still applies.
    }
    endSession();
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-brand-500 to-brand-700 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img className="h-10 w-10 rounded-full bg-white" src="/logo.svg" alt="Balaji Tiles" />
            <div>
              <strong className="text-base">Balaji Central Admin</strong>
              <div className="text-xs text-brand-100">Signed in as {session.user.username}</div>
            </div>
          </div>
          <button className="btn-ghost text-white hover:bg-brand-800" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <nav className="mb-6 flex gap-2 border-b border-slate-200" aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === t.id
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-brand-700'
              }`}
              onClick={() => {
                setTab(t.id);
                setShowroomId(null);
              }}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'owners' && showroomId === null && (
          <Owners call={call} onSelectShowroom={setShowroomId} />
        )}
        {tab === 'owners' && showroomId !== null && (
          <ShowroomDetail
            call={call}
            formatDate={formatDate}
            branchId={showroomId}
            onBack={() => setShowroomId(null)}
          />
        )}
        {tab === 'leaderboard' && <Leaderboard call={call} />}
      </main>
    </div>
  );
}
