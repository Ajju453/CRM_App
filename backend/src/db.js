'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function usersTable(name) {
  return `
CREATE TABLE IF NOT EXISTS ${name} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'branch')),
  branch_id INTEGER REFERENCES branches(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((role = 'branch' AND branch_id IS NOT NULL) OR (role = 'admin' AND branch_id IS NULL))
);`;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
);

${usersTable('users')}

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username_active
  ON users (username) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  occupation TEXT NOT NULL CHECK (occupation IN ('Contractor', 'Engineer', 'Mistri')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_members_branch_phone_active
  ON members (branch_id, phone) WHERE is_deleted = 0;

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  member_id INTEGER NOT NULL REFERENCES members(id),
  site TEXT,
  bill_date TEXT NOT NULL,
  bill_time TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_bills_branch_date ON bills (branch_id, bill_date);
CREATE INDEX IF NOT EXISTS ix_bills_member ON bills (member_id);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  branch_id INTEGER REFERENCES branches(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// Rebuilds users once: SQLite cannot drop a column-level UNIQUE constraint.
function migrateUsernameUniqueness(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!table || !/username\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(table.sql)) return;
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN;');
    db.exec(usersTable('users_new'));
    db.exec(`INSERT INTO users_new (id, username, password_hash, role, branch_id, is_active, created_at)
      SELECT id, username, password_hash, role, branch_id, is_active, created_at FROM users;`);
    db.exec('DROP TABLE users;');
    db.exec('ALTER TABLE users_new RENAME TO users;');
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

function openDatabase(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  migrateUsernameUniqueness(db);
  db.exec(SCHEMA);
  return db;
}

function createAuditLogger(db) {
  const insert = db.prepare(
    'INSERT INTO activity_logs (user_id, branch_id, action, entity, entity_id) VALUES (?, ?, ?, ?, ?)'
  );
  return (user, action, entity, entityId = null) => {
    insert.run(user.id, user.branchId, action, entity, entityId);
  };
}

module.exports = { openDatabase, createAuditLogger };
