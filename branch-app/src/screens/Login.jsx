import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { api } from '../api.js';

// Admin access is for phones only: the Android app, or a touch device.
function isPhoneDevice() {
  return Capacitor.isNativePlatform() || window.matchMedia('(pointer: coarse)').matches;
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { username: username.trim(), password },
      });
      if (data.user.role === 'admin' && !isPhoneDevice()) {
        // Revoke the session so a desktop login leaves nothing behind.
        await api('/auth/logout', { method: 'POST', token: data.token }).catch(() => {});
        throw new Error('Admin login works only on the Balaji app on a phone.');
      }
      onLogin({
        token: data.token,
        expiresAt: data.expiresAt,
        user: data.user,
        branchName: data.user.branchName,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-brand">
        <img className="auth-logo" src="/logo.svg" alt="Balaji Group logo" />
        <h2 className="auth-brand-name">BALAJI GROUP</h2>
        <p className="auth-brand-sub">CONTRACTOR REWARDS PROGRAM</p>
      </aside>

      <section className="auth-panel">
        <div className="auth-card">
          <h1>Welcome <span>Back!</span></h1>
          <p className="auth-sub">Enter your login details to continue.</p>

          <form onSubmit={submit} className="form">
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
          />
        </label>

        <label>
          Password
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
            <button
              type="button"
              className="link"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        {error && <p className="error" role="alert">{error}</p>}

            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        </div>

        <p className="auth-footer">© {new Date().getFullYear()} BALAJI GROUP. All Rights Reserved.</p>
      </section>
    </div>
  );
}
