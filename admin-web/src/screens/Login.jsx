import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await api('/auth/login', {
        method: 'POST',
        body: { username: username.trim(), password, portal: 'admin' },
      });
      if (session.user?.role !== 'admin') {
        setError('This panel is for the central admin only');
        return;
      }
      onLogin(session);
    } catch (err) {
      setError(err.status === 429 ? 'Too many attempts. Try again in 15 minutes.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <img className="mx-auto h-24 w-24" src="/logo.svg" alt="Balaji Tiles" />
        <h1 className="mt-4 text-center text-lg font-semibold">Central admin sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Manage showroom owner accounts.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="label">Username</span>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <p className="text-sm text-brand-600" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
