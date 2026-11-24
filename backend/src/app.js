'use strict';

const express = require('express');
const { createLoginLimiter } = require('./security');
const { HttpError } = require('./validation');
const { createAuthenticate, requireBranch, requireAdmin } = require('./middleware');
const { authRouter } = require('./routes/auth');
const { membersRouter } = require('./routes/members');
const { billsRouter } = require('./routes/bills');
const { dashboardRouter } = require('./routes/dashboard');
const { adminRouter } = require('./routes/admin');
const { leaderboardRouter } = require('./routes/leaderboard');

function createApp(db, { limiter = createLoginLimiter() } = {}) {
  const app = express();
  const authenticate = createAuthenticate(db);
  const listBranches = db.prepare('SELECT id, code, name FROM branches WHERE is_active = 1 ORDER BY id');

  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  const allowedOrigins = (process.env.CORS_ORIGINS || 'https://localhost').split(',').map((o) => o.trim());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/branches', (req, res) => res.json(listBranches.all()));
  app.use('/api/auth', authRouter(db, limiter));
  app.use('/api/members', authenticate, requireBranch, membersRouter(db));
  app.use('/api/bills', authenticate, requireBranch, billsRouter(db));
  app.use('/api/dashboard', authenticate, requireBranch, dashboardRouter(db));
  app.use('/api/leaderboard', authenticate, leaderboardRouter(db));
  app.use('/api/admin', authenticate, requireAdmin, adminRouter(db));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
