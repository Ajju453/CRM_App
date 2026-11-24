'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { openDatabase } = require('../src/db');
const { seedDatabase } = require('../src/seed');
const { createApp } = require('../src/app');
const { createLoginLimiter } = require('../src/security');
const { tierFor, TRIP_TIERS } = require('../src/trips');

const PASSWORD = 'Test@12345';
const LAKH = 100000;

let server;
let base;
let db;
let branchA;
let branchB;
let tokenA;
let tokenB;
let adminToken;
let memberA;
let memberB;
let memberC;
let memberDeleted;

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

function addMember(branchId, name, phone, isDeleted = 0) {
  const result = db
    .prepare("INSERT INTO members (branch_id, name, phone, occupation, is_deleted) VALUES (?, ?, ?, 'Contractor', ?)")
    .run(branchId, name, phone, isDeleted);
  return Number(result.lastInsertRowid);
}

function addBill(branchId, memberId, billDate, amount) {
  const result = db
    .prepare('INSERT INTO bills (branch_id, member_id, bill_date, amount) VALUES (?, ?, ?, ?)')
    .run(branchId, memberId, billDate, amount);
  return Number(result.lastInsertRowid);
}

before(async () => {
  db = openDatabase(':memory:');
  seedDatabase(db, () => PASSWORD);
  server = createApp(db, { limiter: createLoginLimiter() }).listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;

  const [first, second] = db.prepare('SELECT id, code FROM branches ORDER BY id').all();
  branchA = first;
  branchB = second;

  const admin = await call('POST', '/api/auth/login', {
    body: { username: 'admin', password: PASSWORD, portal: 'admin' },
  });
  adminToken = admin.body.token;
  const loginA = await call('POST', '/api/auth/login', {
    body: { username: `branch_${branchA.code.toLowerCase()}`, password: PASSWORD, portal: 'branch' },
  });
  tokenA = loginA.body.token;
  const loginB = await call('POST', '/api/auth/login', {
    body: { username: `branch_${branchB.code.toLowerCase()}`, password: PASSWORD, portal: 'branch' },
  });
  tokenB = loginB.body.token;

  memberA = addMember(branchA.id, 'Asha', '9000000001');
  memberB = addMember(branchB.id, 'Bharat', '9000000002');
  memberC = addMember(branchA.id, 'Chetan', '9000000003');
  memberDeleted = addMember(branchB.id, 'Deleted Person', '9000000004', 1);

  addBill(branchA.id, memberA, '2026-03-10', 20 * LAKH);
  addBill(branchA.id, memberA, '2026-04-10', 5 * LAKH);
  addBill(branchA.id, memberC, '2026-04-11', 10 * LAKH);
  addBill(branchB.id, memberB, '2026-02-01', 85 * LAKH);
  addBill(branchB.id, memberDeleted, '2026-02-02', 90 * LAKH);
});

after(() => {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

test('tierFor picks the highest threshold reached and handles boundaries', () => {
  assert.deepEqual(TRIP_TIERS.map((t) => t.threshold), [20 * LAKH, 35 * LAKH, 60 * LAKH, 80 * LAKH]);
  assert.equal(tierFor(0), null);
  assert.equal(tierFor(20 * LAKH - 1), null);
  assert.equal(tierFor(20 * LAKH).id, 'goa');
  assert.equal(tierFor(35 * LAKH - 1).id, 'goa');
  assert.equal(tierFor(35 * LAKH).id, 'kerala');
  assert.equal(tierFor(60 * LAKH).id, 'kashmir');
  assert.equal(tierFor(80 * LAKH).id, 'bangkok');
});

test('leaderboard requires login', async () => {
  assert.equal((await call('GET', '/api/leaderboard')).status, 401);
});

test('leaderboard ranks active members across showrooms with tiers and eligibility', async () => {
  const res = await call('GET', '/api/leaderboard', { token: adminToken });
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.top.map((row) => [row.name, row.totalSales, row.tier?.id ?? null]),
    [
      ['Bharat', 85 * LAKH, 'bangkok'],
      ['Asha', 25 * LAKH, 'goa'],
      ['Chetan', 10 * LAKH, null],
    ]
  );
  assert.equal(res.body.top[0].rank, 1);
  assert.equal(res.body.top.some((row) => row.name === 'Deleted Person'), false);
  assert.deepEqual(res.body.eligibility, { goa: 2, kerala: 1, kashmir: 1, bangkok: 1 });
});

test('branch leaderboard lists and counts only its own showroom', async () => {
  const res = await call('GET', '/api/leaderboard', { token: tokenA });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.top.map((row) => [row.rank, row.name]), [
    [1, 'Asha'],
    [2, 'Chetan'],
  ]);
  assert.equal(res.body.top[0].tier.id, 'goa');
  assert.equal(res.body.top[1].tier, null);
  assert.deepEqual(res.body.eligibility, { goa: 1, kerala: 0, kashmir: 0, bangkok: 0 });
  assert.equal(res.body.showroom, undefined);
  assert.equal(res.body.top.some((row) => row.name === 'Bharat'), false);
});

test('admin leaderboard covers all showrooms', async () => {
  const res = await call('GET', '/api/leaderboard', { token: adminToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.top.length, 3);
  assert.equal(res.body.showroom, undefined);
});

test('leaderboard date range and limit are validated and applied', async () => {
  const ranged = await call('GET', '/api/leaderboard?from=2026-04-01&to=2026-04-30', { token: adminToken });
  assert.deepEqual(ranged.body.top.map((row) => [row.name, row.totalSales]), [
    ['Chetan', 10 * LAKH],
    ['Asha', 5 * LAKH],
  ]);

  const limited = await call('GET', '/api/leaderboard?limit=1', { token: adminToken });
  assert.equal(limited.body.top.length, 1);

  assert.equal((await call('GET', '/api/leaderboard?from=2026-13-01', { token: adminToken })).status, 400);
  assert.equal((await call('GET', '/api/leaderboard?limit=0', { token: adminToken })).status, 400);
});

test('branch owner deletes only bills in their own showroom', async () => {
  const billB = addBill(branchB.id, memberB, '2026-05-01', 1 * LAKH);
  const billA = addBill(branchA.id, memberC, '2026-05-02', 1 * LAKH);

  assert.equal((await call('DELETE', `/api/bills/${billA}`, { token: tokenB })).status, 404);
  assert.equal((await call('DELETE', `/api/bills/${billB}`, { token: tokenA })).status, 404);

  const own = await call('DELETE', `/api/bills/${billA}`, { token: tokenA });
  assert.equal(own.status, 200);
  assert.equal((await call('DELETE', `/api/bills/${billA}`, { token: tokenA })).status, 404);

  assert.equal((await call('DELETE', `/api/bills/abc`, { token: tokenA })).status, 400);
  assert.equal((await call('DELETE', `/api/bills/${billB}`)).status, 401);
});

test('deleting a bill lowers the leaderboard total', async () => {
  const bill = addBill(branchA.id, memberA, '2026-06-01', 10 * LAKH);
  const beforeDelete = await call('GET', '/api/leaderboard', { token: adminToken });
  const asha = beforeDelete.body.top.find((row) => row.name === 'Asha');
  assert.equal(asha.totalSales, 35 * LAKH);
  assert.equal(asha.tier.id, 'kerala');

  assert.equal((await call('DELETE', `/api/bills/${bill}`, { token: tokenA })).status, 200);

  const after = await call('GET', '/api/leaderboard', { token: adminToken });
  assert.equal(after.body.top.find((row) => row.name === 'Asha').totalSales, 25 * LAKH);
});

test('admin deletes a bill in any showroom and gets 404 for missing bills', async () => {
  const bill = addBill(branchB.id, memberB, '2026-07-01', 1 * LAKH);
  assert.equal((await call('DELETE', `/api/admin/bills/${bill}`, { token: tokenA })).status, 403);
  assert.equal((await call('DELETE', `/api/admin/bills/${bill}`, { token: adminToken })).status, 200);
  assert.equal((await call('DELETE', `/api/admin/bills/${bill}`, { token: adminToken })).status, 404);
});
