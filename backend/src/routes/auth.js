'use strict';

const express = require('express');
const { createToken, hashToken, verifyPassword } = require('../security');
const { createAuthenticate } = require('../middleware');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const PORTALS = ['admin', 'branch'];

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    branchId: user.branchId ?? null,
    branchName: user.branchName ?? null,
  };
}

function authRouter(db, limiter) {
  const router = express.Router();
  const authenticate = createAuthenticate(db);
  const findUser = db.prepare(`
    SELECT u.id, u.username, u.password_hash AS passwordHash, u.role,
           u.branch_id AS branchId, b.name AS branchName, u.is_active AS isActive
    FROM users u
    LEFT JOIN branches b ON b.id = u.branch_id
    WHERE u.username = ? AND u.is_active = 1
  `);
  const insertSession = db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
  const deleteExpiredSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');

  router.post('/login', (req, res) => {
    const body = req.body || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const portal = body.portal;
    if (portal !== undefined && !PORTALS.includes(portal)) {
      return res.status(400).json({ error: 'Portal must be admin or branch' });
    }
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const limitKey = `${req.ip}|${username.toLowerCase()}`;
    if (limiter.isBlocked(limitKey)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }

    const user = findUser.get(username);
    const passwordOk = Boolean(user) && verifyPassword(password, user.passwordHash);
    // The account role decides the portal; an explicit portal must still match it.
    const scopeOk = Boolean(user) && (portal === undefined || user.role === portal);

    if (!passwordOk || !scopeOk || !user.isActive) {
      limiter.recordFailure(limitKey);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    limiter.reset(limitKey);
    deleteExpiredSessions.run(new Date().toISOString());
    const token = createToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    insertSession.run(hashToken(token), user.id, expiresAt);
    return res.json({ token, expiresAt, user: toPublicUser(user) });
  });

  router.get('/me', authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  router.post('/logout', authenticate, (req, res) => {
    deleteSession.run(hashToken(req.token));
    res.json({ ok: true });
  });

  return router;
}

module.exports = { authRouter };
