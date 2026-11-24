'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { openDatabase } = require('../src/db');
const { seedDatabase } = require('../src/seed');
const { createApp } = require('../src/app');
const { createLoginLimiter } = require('../src/security');

const PASSWORD = 'Test@12345';

let server;
let base;
let branches;
let ichToken;
let sglToken;
let memberId;

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

function login(username, password = PASSWORD) {
  return call('POST', '/api/auth/login', { body: { username, password, portal: 'branch' } });
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

test('seeding creates seven branches, an admin and branch users once', () => {
  const db = openDatabase(':memory:');
  const first = seedDatabase(db, () => PASSWORD);
  assert.equal(first.length, 8);
  assert.equal(seedDatabase(db, () => PASSWORD).length, 0);
});

test('lists the seven active branches', async () => {
  const res = await call('GET', '/api/branches');
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 7);
  branches = res.body;
});

test('rejects a wrong password', async () => {
  const res = await login('branch_ich', 'wrong-password');
  assert.equal(res.status, 401);
});

test('login needs no portal and rejects unknown portal names', async () => {
  const noPortal = await call('POST', '/api/auth/login', { body: { username: 'branch_ich', password: PASSWORD } });
  assert.equal(noPortal.status, 200);
  assert.equal(noPortal.body.user.role, 'branch');

  const unknown = await call('POST', '/api/auth/login', {
    body: { username: 'branch_ich', password: PASSWORD, portal: 'owner' },
  });
  assert.equal(unknown.status, 400);
});

test('branch user logs in with username and password and sees their showroom name', async () => {
  const ich = await login('branch_ich');
  assert.equal(ich.status, 200);
  assert.equal(ich.body.user.role, 'branch');
  assert.equal(ich.body.user.branchName, branches[0].name);
  ichToken = ich.body.token;

  const sgl = await login('branch_sgl');
  assert.equal(sgl.status, 200);
  sglToken = sgl.body.token;
});

test('branch accounts cannot log in through the admin portal and admin cannot use the branch portal', async () => {
  const branchInAdmin = await call('POST', '/api/auth/login', {
    body: { username: 'branch_ich', password: PASSWORD, portal: 'admin' },
  });
  assert.equal(branchInAdmin.status, 401);

  const adminInBranch = await login('admin');
  assert.equal(adminInBranch.status, 401);

  const admin = await call('POST', '/api/auth/login', {
    body: { username: 'admin', password: PASSWORD, portal: 'admin' },
  });
  assert.equal(admin.status, 200);
  assert.equal(admin.body.user.branchName, null);
  const res = await call('GET', '/api/members', { token: admin.body.token });
  assert.equal(res.status, 403);
});

test('requests without a valid session are rejected', async () => {
  assert.equal((await call('GET', '/api/members')).status, 401);
  assert.equal((await call('GET', '/api/members', { token: 'not-a-token' })).status, 401);
});

test('branch user adds and searches members with validation', async () => {
  const created = await call('POST', '/api/members', {
    token: ichToken,
    body: { name: 'Ramesh Patil', phone: '98765 43210', address: 'Ichalkaranji', occupation: 'Contractor' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.phone, '9876543210');
  memberId = created.body.id;

  const duplicate = await call('POST', '/api/members', {
    token: ichToken,
    body: { name: 'Other', phone: '9876543210', occupation: 'Mistri' },
  });
  assert.equal(duplicate.status, 409);

  const badPhone = await call('POST', '/api/members', {
    token: ichToken,
    body: { name: 'Other', phone: '123', occupation: 'Mistri' },
  });
  assert.equal(badPhone.status, 400);

  const badOccupation = await call('POST', '/api/members', {
    token: ichToken,
    body: { name: 'Other', phone: '9123456789', occupation: 'Doctor' },
  });
  assert.equal(badOccupation.status, 400);

  const search = await call('GET', '/api/members?search=ramesh', { token: ichToken });
  assert.equal(search.body.length, 1);

  const otherBranch = await call('GET', '/api/members', { token: sglToken });
  assert.equal(otherBranch.body.length, 0);
});

test('bills are validated, listed and reflected in the dashboard', async () => {
  const bill = await call('POST', '/api/bills', {
    token: ichToken,
    body: { memberId, site: 'Plot 4', billDate: '2026-11-20', billTime: '10:30', amount: 25000 },
  });
  assert.equal(bill.status, 201);

  const zeroAmount = await call('POST', '/api/bills', {
    token: ichToken,
    body: { memberId, billDate: '2026-11-20', amount: 0 },
  });
  assert.equal(zeroAmount.status, 400);

  const invalidDate = await call('POST', '/api/bills', {
    token: ichToken,
    body: { memberId, billDate: '2026-02-30', amount: 100 },
  });
  assert.equal(invalidDate.status, 400);

  const unknownMember = await call('POST', '/api/bills', {
    token: ichToken,
    body: { memberId: 999, billDate: '2026-11-20', amount: 100 },
  });
  assert.equal(unknownMember.status, 404);

  const inRange = await call('GET', '/api/bills?from=2026-11-01&to=2026-11-30', { token: ichToken });
  assert.equal(inRange.body.length, 1);
  assert.equal(inRange.body[0].memberName, 'Ramesh Patil');

  const outOfRange = await call('GET', '/api/bills?from=2026-12-01', { token: ichToken });
  assert.equal(outOfRange.body.length, 0);

  const dashboard = await call('GET', '/api/dashboard', { token: ichToken });
  assert.equal(dashboard.body.totalMembers, 1);
  assert.equal(dashboard.body.membersWithPurchase, 1);
  assert.equal(dashboard.body.membersWithoutPurchase, 0);
  assert.equal(dashboard.body.totalBills, 1);
  assert.equal(dashboard.body.totalSales, 25000);
});

test('members can be removed only from their own showroom', async () => {
  const otherBranch = await call('DELETE', `/api/members/${memberId}`, { token: sglToken });
  assert.equal(otherBranch.status, 404);

  const removed = await call('DELETE', `/api/members/${memberId}`, { token: ichToken });
  assert.equal(removed.status, 200);

  const list = await call('GET', '/api/members', { token: ichToken });
  assert.equal(list.body.length, 0);

  const again = await call('DELETE', `/api/members/${memberId}`, { token: ichToken });
  assert.equal(again.status, 404);

  const dashboard = await call('GET', '/api/dashboard', { token: ichToken });
  assert.equal(dashboard.body.totalMembers, 0);
  assert.equal(dashboard.body.totalSales, 25000);
});

test('logout invalidates the session', async () => {
  const out = await call('POST', '/api/auth/logout', { token: sglToken });
  assert.equal(out.status, 200);
  const me = await call('GET', '/api/auth/me', { token: sglToken });
  assert.equal(me.status, 401);
});

test('repeated failed logins are rate limited', async () => {
  for (let i = 0; i < 5; i += 1) {
    const res = await login('branch_tbt', 'wrong-password');
    assert.equal(res.status, 401);
  }
  const blocked = await login('branch_tbt');
  assert.equal(blocked.status, 429);
});

test('a bill with a new phone creates the member, and the next bill reuses them', async () => {
  const first = await call('POST', '/api/bills', {
    token: ichToken,
    body: {
      name: 'Suresh Kale',
      phone: '91234 56780',
      occupation: 'Engineer',
      address: 'Kolhapur Road',
      site: 'Plot 9',
      billDate: '2026-11-21',
      billTime: '09:15',
      amount: 12000,
    },
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.createdMember, true);
  assert.equal(first.body.memberName, 'Suresh Kale');

  const second = await call('POST', '/api/bills', {
    token: ichToken,
    body: { name: 'Suresh K', phone: '9123456780', occupation: 'Engineer', site: 'Plot 10', billDate: '2026-11-22', amount: 8000 },
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.createdMember, false);
  assert.equal(second.body.memberId, first.body.memberId);

  const invalidPhone = await call('POST', '/api/bills', {
    token: ichToken,
    body: { name: 'Bad', phone: '12', occupation: 'Engineer', billDate: '2026-11-22', amount: 100 },
  });
  assert.equal(invalidPhone.status, 400);

  const members = await call('GET', '/api/members?search=9123456780', { token: ichToken });
  assert.equal(members.body.length, 1);
  assert.equal(members.body[0].billCount, 2);
  assert.equal(members.body[0].totalAmount, 20000);

  const detail = await call('GET', `/api/members/${first.body.memberId}`, { token: ichToken });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.bills.length, 2);
  assert.equal(detail.body.totalAmount, 20000);

  const sglAgain = await login('branch_sgl');
  const otherBranch = await call('GET', `/api/members/${first.body.memberId}`, { token: sglAgain.body.token });
  assert.equal(otherBranch.status, 404);

  const history = await call('GET', '/api/dashboard?from=2026-11-21&to=2026-11-22', { token: ichToken });
  assert.equal(history.body.history.length, 2);
  assert.equal(history.body.history[0].memberPhone, '9123456780');
});
