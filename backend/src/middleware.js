'use strict';

const { hashToken } = require('./security');

function createAuthenticate(db) {
  const findSession = db.prepare(`
    SELECT u.id, u.username, u.role, u.branch_id AS branchId, u.is_active AS isActive
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `);

  return function authenticate(req, res, next) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '');
    if (!match) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const user = findSession.get(hashToken(match[1]), new Date().toISOString());
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branchId ?? null,
    };
    req.token = match[1];
    return next();
  };
}

function requireBranch(req, res, next) {
  if (req.user.role !== 'branch') {
    return res.status(403).json({ error: 'Only branch users can access this resource' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the central admin can access this resource' });
  }
  return next();
}

module.exports = { createAuthenticate, requireBranch, requireAdmin };
