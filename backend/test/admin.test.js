'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { openDatabase } = require('../src/db');
const { seedDatabase } = require('../src/seed');
const { createApp } = require('../src/app');
const { createLoginLimiter } = require('../src/security');

const PASSWORD = 'Test@12345';
const NEW_PASSWORD = 'Owner@98765';

let server;
let base;
let adminToken;
let branchToken;
let branches;
let newOwnerId;
let newOwnerToken;

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  const db = openDatabase(':memory:');
  seedDatabase(db, () => PASSWORD);
  server = createApp(db, { limiter: createLoginLimiter() }).listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

test('admin logs in and loads the showroom list', async () => {
  const admin = await call('POST', '/api/auth/login', {
    body: { username: 'admin', password: PASSWORD, portal: 'admin' },
  });
  assert.equal(admin.status, 200);
  adminToken = admin.body.token;

  const list = await call('GET', '/api/branches');
  branches = list.body;
  assert.equal(branches.length, 7);
});

test('only the admin can reach admin routes', async () => {
  assert.equal((await call('GET', '/api/admin/owners')).status, 401);

  const branch = await call('POST', '/api/auth/login', {
    body: { username: 'branch_ich', password: PASSWORD, portal: 'branch' },
  });
  branchToken = branch.body.token;
  assert.equal((await call('GET', '/api/admin/owners', { token: branchToken })).status, 403);
  assert.equal(
    (await call('POST', '/api/admin/owners', {
      token: branchToken,
      body: { username: 'sneaky_owner', password: NEW_PASSWORD, branchId: branches[0].id },
    })).status,
    403
  );
});

test('owner list returns active branch owners without password data', async () => {
  const res = await call('GET', '/api/admin/owners', { token: adminToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 7);
  for (const owner of res.body) {
    assert.equal(owner.passwordHash, undefined);
    assert.equal(owner.password_hash, undefined);
    assert.ok(owner.branchName);
  }
});

test('admin adds an owner with validation', async () => {
  const ich = branches[0];
  const badUsername = await call('POST', '/api/admin/owners', {
    token: adminToken,
    body: { username: 'ab', password: NEW_PASSWORD, branchId: ich.id },
  });
  assert.equal(badUsername.status, 400);

  const shortPassword = await call('POST', '/api/admin/owners', {
    token: adminToken,
    body: { username: 'new_owner', password: 'short', branchId: ich.id },
  });
  assert.equal(shortPassword.status, 400);

  const missingBranch = await call('POST', '/api/admin/owners', {
    token: adminToken,
    body: { username: 'new_owner', password: NEW_PASSWORD },
  });
  assert.equal(missingBranch.status, 400);

  const unknownBranch = await call('POST', '/api/admin/owners', {
    token: adminToken,
    body: { username: 'new_owner', password: NEW_PASSWORD, branchId: 999 },
  });
  assert.equal(unknownBranch.status, 400);

  const duplicate = await call('POST', '/api/admin/owners', {
    token: adminToken,
    body: { username: 'BRANCH_ICH', password: NEW_PASSWORD, branchId: ich.id },
  });
  assert.equal(duplicate.status, 409);

  const created = await call('POST', '/api/admin/owners', {
    token: adminToken,
    body: { username: 'ichalkaranji_2', password: NEW_PASSWORD, branchId: ich.id },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.username, 'ichalkaranji_2');
  assert.equal(created.body.branchId, ich.id);
  assert.equal(created.body.branchName, ich.name);
  assert.equal(created.body.passwordHash, undefined);
  newOwnerId = created.body.id;

  const list = await call('GET', '/api/admin/owners', { token: adminToken });
  assert.equal(list.body.length, 8);
});

test('new owner can log in only through the branch portal', async () => {
  const wrongPortal = await call('POST', '/api/auth/login', {
    body: { username: 'ichalkaranji_2', password: NEW_PASSWORD, portal: 'admin' },
  });
  assert.equal(wrongPortal.status, 401);

  const login = await call('POST', '/api/auth/login', {
    body: { username: 'ichalkaranji_2', password: NEW_PASSWORD, portal: 'branch' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'branch');
  assert.equal(login.body.user.branchName, branches[0].name);
  newOwnerToken = login.body.token;
});

test('admin removes an owner, which revokes their session and login', async () => {
  const removed = await call('DELETE', `/api/admin/owners/${newOwnerId}`, { token: adminToken });
  assert.equal(removed.status, 200);

  assert.equal((await call('GET', '/api/members', { token: newOwnerToken })).status, 401);

  const relogin = await call('POST', '/api/auth/login', {
    body: { username: 'ichalkaranji_2', password: NEW_PASSWORD, portal: 'branch' },
  });
  assert.equal(relogin.status, 401);

  const list = await call('GET', '/api/admin/owners', { token: adminToken });
  assert.equal(list.body.length, 7);
  assert.equal(list.body.some((owner) => owner.id === newOwnerId), false);
});

test('removed owner is not deleted twice and their username can be reused', async () => {
  const again = await call('DELETE', `/api/admin/owners/${newOwnerId}`, { token: adminToken });
  assert.equal(again.status, 404);

  const reuse = await call('POST', '/api/admin/owners', {
    token: adminToken,
    body: { username: 'ichalkaranji_2', password: NEW_PASSWORD, branchId: branches[0].id },
  });
  assert.equal(reuse.status, 201);
  assert.notEqual(reuse.body.id, newOwnerId);

  const login = await call('POST', '/api/auth/login', {
    body: { username: 'ichalkaranji_2', password: NEW_PASSWORD, portal: 'branch' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.id, reuse.body.id);

  const cleanup = await call('DELETE', `/api/admin/owners/${reuse.body.id}`, { token: adminToken });
  assert.equal(cleanup.status, 200);
});

test('admin cannot delete the admin account or a missing id through owner routes', async () => {
  const adminAccount = await call('DELETE', '/api/admin/owners/1', { token: adminToken });
  assert.equal(adminAccount.status, 404);

  const invalid = await call('DELETE', '/api/admin/owners/abc', { token: adminToken });
  assert.equal(invalid.status, 400);

  const branchStillWorks = await call('GET', '/api/members', { token: branchToken });
  assert.equal(branchStillWorks.status, 200);
});

test('admin sees all data for one showroom and branch users cannot', async () => {
  const ich = branches[0];
  assert.equal((await call('GET', `/api/admin/branches/${ich.id}`, { token: branchToken })).status, 403);
  assert.equal((await call('GET', `/api/admin/branches/${ich.id}`)).status, 401);
  assert.equal((await call('GET', '/api/admin/branches/abc', { token: adminToken })).status, 400);
  assert.equal((await call('GET', '/api/admin/branches/999', { token: adminToken })).status, 404);

  const empty = await call('GET', `/api/admin/branches/${ich.id}`, { token: adminToken });
  assert.equal(empty.status, 200);
  assert.equal(empty.body.branch.name, ich.name);
  assert.equal(empty.body.owner.username, 'branch_ich');
  assert.deepEqual(empty.body.totals, {
    memberCount: 0,
    membersWithBills: 0,
    membersWithoutBills: 0,
    billCount: 0,
    totalSales: 0,
  });
  assert.deepEqual(empty.body.members, []);
  assert.deepEqual(empty.body.bills, []);

  const member = await call('POST', '/api/members', {
    token: branchToken,
    body: { name: 'Ravi Patil', phone: '9876543210', address: 'Ichalkaranji', occupation: 'Mistri' },
  });
  assert.equal(member.status, 201);
  const bill = await call('POST', '/api/bills', {
    token: branchToken,
    body: { memberId: member.body.id, amount: 5000, billDate: '2026-01-15', site: 'Site A' },
  });
  assert.equal(bill.status, 201);

  const filled = await call('GET', `/api/admin/branches/${ich.id}`, { token: adminToken });
  assert.equal(filled.body.totals.memberCount, 1);
  assert.equal(filled.body.totals.membersWithBills, 1);
  assert.equal(filled.body.totals.membersWithoutBills, 0);
  assert.equal(filled.body.totals.billCount, 1);
  assert.equal(filled.body.totals.totalSales, 5000);
  assert.deepEqual(filled.body.monthly, [{ period: '2026-01', totalBills: 1, totalSales: 5000 }]);
  assert.deepEqual(filled.body.yearly, [{ period: '2026', totalBills: 1, totalSales: 5000 }]);
  assert.equal(filled.body.ranking.length, 1);
  assert.equal(filled.body.ranking[0].rank, 1);
  assert.equal(filled.body.ranking[0].tier, null);
  assert.equal(filled.body.eligibility.goa, 0);
  assert.equal(filled.body.members[0].name, 'Ravi Patil');
  assert.equal(filled.body.members[0].billCount, 1);
  assert.equal(filled.body.members[0].totalAmount, 5000);
  assert.equal(filled.body.bills[0].memberName, 'Ravi Patil');
  assert.equal(filled.body.bills[0].memberPhone, '9876543210');
  assert.equal(filled.body.bills[0].site, 'Site A');

  await call('DELETE', `/api/members/${member.body.id}`, { token: branchToken });
  const afterDelete = await call('GET', `/api/admin/branches/${ich.id}`, { token: adminToken });
  assert.equal(afterDelete.body.totals.memberCount, 0);
  assert.equal(afterDelete.body.totals.billCount, 1);
  assert.equal(afterDelete.body.members[0].isDeleted, true);
  assert.equal(afterDelete.body.bills.length, 1);
});

test('admin sets a new username and password for an owner and the old login stops working', async () => {
  const created = await call('POST', '/api/admin/owners', {
    token: adminToken,
    body: { username: 'patch_owner', password: NEW_PASSWORD, branchId: branches[2].id },
  });
  assert.equal(created.status, 201);
  const id = created.body.id;

  const before = await call('POST', '/api/auth/login', {
    body: { username: 'patch_owner', password: NEW_PASSWORD, portal: 'branch' },
  });
  assert.equal(before.status, 200);

  assert.equal((await call('PATCH', `/api/admin/owners/${id}`, { token: branchToken, body: { username: 'x_owner' } })).status, 403);
  assert.equal((await call('PATCH', `/api/admin/owners/${id}`, { token: adminToken, body: {} })).status, 400);
  assert.equal((await call('PATCH', '/api/admin/owners/999', { token: adminToken, body: { username: 'ghost_owner' } })).status, 404);
  assert.equal((await call('PATCH', `/api/admin/owners/${id}`, { token: adminToken, body: { username: 'ab' } })).status, 400);
  assert.equal((await call('PATCH', `/api/admin/owners/${id}`, { token: adminToken, body: { username: 'branch_ich' } })).status, 409);

  const updated = await call('PATCH', `/api/admin/owners/${id}`, {
    token: adminToken,
    body: { username: 'patch_owner_2', password: 'Changed@1234' },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.username, 'patch_owner_2');
  assert.equal(updated.body.passwordHash, undefined);

  assert.equal((await call('GET', '/api/members', { token: before.body.token })).status, 401);

  const oldLogin = await call('POST', '/api/auth/login', {
    body: { username: 'patch_owner', password: NEW_PASSWORD, portal: 'branch' },
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await call('POST', '/api/auth/login', {
    body: { username: 'patch_owner_2', password: 'Changed@1234', portal: 'branch' },
  });
  assert.equal(newLogin.status, 200);
  assert.equal(newLogin.body.user.branchName, branches[2].name);
});

test('existing database migrates so a removed username can be reused', () => {
  const file = path.join(os.tmpdir(), `balaji-migrate-${process.pid}.db`);
  fs.rmSync(file, { force: true });
  const old = new DatabaseSync(file);
  old.exec(`
    CREATE TABLE branches (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL UNIQUE, is_active INTEGER NOT NULL DEFAULT 1);
    INSERT INTO branches (code, name) VALUES ('ICH', 'Ichalkaranji');
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin', 'branch')), branch_id INTEGER REFERENCES branches(id), is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), CHECK ((role = 'branch' AND branch_id IS NOT NULL) OR (role = 'admin' AND branch_id IS NULL)));
    INSERT INTO users (username, password_hash, role, branch_id, is_active) VALUES ('old_owner', 'x', 'branch', 1, 0);
  `);
  old.close();

  const db = openDatabase(file);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
  db.prepare("INSERT INTO users (username, password_hash, role, branch_id) VALUES ('old_owner', 'x', 'branch', 1)").run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
  db.close();
  fs.rmSync(file, { force: true });
});
