'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { openDatabase } = require('./db');
const { hashPassword } = require('./security');

const BRANCHES = [
  { code: 'ICH', name: 'Ichalkaranji' },
  { code: 'SGL', name: 'Sangli' },
  { code: 'SBT', name: 'Belgavi (SBT)' },
  { code: 'TBT', name: 'Belgavi (TBT)' },
  { code: 'ATH', name: 'Athani' },
  { code: 'SGO', name: 'Sangola' },
  { code: 'KAR', name: 'Karad' },
];

function seedDatabase(db, passwordFor) {
  const insertBranch = db.prepare('INSERT OR IGNORE INTO branches (code, name) VALUES (?, ?)');
  const findBranch = db.prepare('SELECT id FROM branches WHERE code = ?');
  const findUser = db.prepare('SELECT id FROM users WHERE username = ?');
  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash, role, branch_id) VALUES (?, ?, ?, ?)'
  );

  for (const branch of BRANCHES) {
    insertBranch.run(branch.code, branch.name);
  }

  const accounts = [{ username: 'admin', role: 'admin', branchId: null }];
  for (const branch of BRANCHES) {
    accounts.push({
      username: `branch_${branch.code.toLowerCase()}`,
      role: 'branch',
      branchId: findBranch.get(branch.code).id,
    });
  }

  const created = [];
  for (const account of accounts) {
    if (findUser.get(account.username)) continue;
    const password = passwordFor(account.username);
    insertUser.run(account.username, hashPassword(password), account.role, account.branchId);
    created.push({ username: account.username, password });
  }
  return created;
}

if (require.main === module) {
  const file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'balaji.db');
  const db = openDatabase(file);
  const created = seedDatabase(db, () => crypto.randomBytes(9).toString('base64url'));
  if (created.length === 0) {
    console.log('Database already seeded. No accounts created.');
  }
  for (const account of created) {
    console.log(`${account.username}  ${account.password}`);
  }
  if (created.length > 0) {
    console.log('Passwords are shown only once. Store them securely.');
  }
}

module.exports = { seedDatabase, BRANCHES };
