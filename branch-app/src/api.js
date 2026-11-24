const SESSION_KEY = 'balaji.session';

export function getStoredSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!session || new Date(session.expiresAt) <= new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function storeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Empty on the web (same origin, Vite proxies /api). Set VITE_API_BASE to the public
// backend URL when building the Android app, since it is served from a local origin.
const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No internet connection. Connect to the internet and try again.');
  }
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function formatRupees(amount) {
  return `\u20B9${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
