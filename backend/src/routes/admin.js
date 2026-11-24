'use strict';

const express = require('express');
const { createAuditLogger } = require('../db');
const { hashPassword } = require('../security');
const { HttpError, parseId } = require('../validation');
const { rankMembers, tierQualifiers, eligibilityCounts, salesByPeriod } = require('../analytics');

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function parseUsername(value) {
  const username = typeof value === 'string' ? value.trim() : '';
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpError(400, 'Username must be 3-32 letters, digits or underscores');
  }
  return username;
}

function parsePassword(value) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new HttpError(400, `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`);
  }
  return password;
}

function parseOwnerInput(body) {
  const username = parseUsername(body.username);
  const password = parsePassword(body.password);
  const branchId = Number(body.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw new HttpError(400, 'Choose a showroom');
  }
  return { username, password, branchId };
}

// Only the fields sent are changed; at least one is required.
function parseOwnerUpdate(body) {
  const input = { username: null, password: null };
  if (body.username !== undefined) input.username = parseUsername(body.username);
  if (body.password !== undefined) input.password = parsePassword(body.password);
  if (input.username === null && input.password === null) {
    throw new HttpError(400, 'Enter a new username or password');
  }
  return input;
}

function adminRouter(db) {
  const router = express.Router();
  const audit = createAuditLogger(db);
  const ownerColumns = `
    SELECT u.id, u.username, u.branch_id AS branchId, b.name AS branchName, u.created_at AS createdAt
    FROM users u
    JOIN branches b ON b.id = u.branch_id
    WHERE u.role = 'branch'
  `;
  const listOwners = db.prepare(`${ownerColumns} AND u.is_active = 1
    ORDER BY b.name COLLATE NOCASE, u.username COLLATE NOCASE`);
  const getOwner = db.prepare(`${ownerColumns} AND u.id = ? AND u.is_active = 1`);
  const activeBranch = db.prepare('SELECT id FROM branches WHERE id = ? AND is_active = 1');
  const findUsername = db.prepare('SELECT id FROM users WHERE username = ? AND is_active = 1');
  const insertOwner = db.prepare(
    "INSERT INTO users (username, password_hash, role, branch_id) VALUES (?, ?, 'branch', ?)"
  );
  const deactivateOwner = db.prepare(
    "UPDATE users SET is_active = 0 WHERE id = ? AND role = 'branch' AND is_active = 1"
  );
  const updateOwner = db.prepare(`
    UPDATE users SET username = COALESCE(?, username), password_hash = COALESCE(?, password_hash)
    WHERE id = ? AND role = 'branch' AND is_active = 1
  `);
  const revokeSessions = db.prepare('DELETE FROM sessions WHERE user_id = ?');
  const deleteBill = db.prepare('DELETE FROM bills WHERE id = ?');
  const getBranch = db.prepare('SELECT id, code, name FROM branches WHERE id = ?');
  const branchOwner = db.prepare(`SELECT id, username, created_at AS createdAt FROM users
    WHERE role = 'branch' AND branch_id = ? AND is_active = 1 ORDER BY id LIMIT 1`);
  const branchMembers = db.prepare(`
    SELECT m.id, m.name, m.phone, m.address, m.occupation, m.is_deleted AS isDeleted,
           m.created_at AS createdAt, COUNT(b.id) AS billCount, COALESCE(SUM(b.amount), 0) AS totalAmount
    FROM members m
    LEFT JOIN bills b ON b.member_id = m.id
    WHERE m.branch_id = ?
    GROUP BY m.id
    ORDER BY m.name COLLATE NOCASE
  `);
  const branchBills = db.prepare(`
    SELECT b.id, b.member_id AS memberId, m.name AS memberName, m.phone AS memberPhone, b.site,
           b.bill_date AS billDate, b.bill_time AS billTime, b.amount
    FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE b.branch_id = ?
    ORDER BY b.bill_date DESC, b.id DESC
  `);

  router.get('/owners', (req, res) => {
    res.json(listOwners.all());
  });

  router.get('/branches/:id', (req, res) => {
    const id = parseId(req.params.id);
    const branch = getBranch.get(id);
    if (!branch) {
      throw new HttpError(404, 'Showroom not found');
    }
    const members = branchMembers.all(id).map((m) => ({ ...m, isDeleted: Boolean(m.isDeleted) }));
    const bills = branchBills.all(id);
    const activeMembers = members.filter((m) => !m.isDeleted);
    const ranked = rankMembers(
      activeMembers.map((m) => ({
        memberId: m.id,
        name: m.name,
        phone: m.phone,
        totalSales: m.totalAmount,
      }))
    );
    const qualifiers = tierQualifiers(ranked);
    const totalSales = bills.reduce((sum, b) => sum + b.amount, 0);
    res.json({
      branch,
      owner: branchOwner.get(id) ?? null,
      totals: {
        memberCount: activeMembers.length,
        membersWithBills: activeMembers.filter((m) => m.billCount > 0).length,
        membersWithoutBills: activeMembers.filter((m) => m.billCount === 0).length,
        billCount: bills.length,
        totalSales,
      },
      monthly: salesByPeriod(bills, 7),
      yearly: salesByPeriod(bills, 4),
      ranking: ranked,
      qualifiers,
      eligibility: eligibilityCounts(qualifiers),
      members,
      bills,
    });
  });

  router.post('/owners', (req, res) => {
    const input = parseOwnerInput(req.body || {});
    if (!activeBranch.get(input.branchId)) {
      throw new HttpError(400, 'Choose an active showroom');
    }
    if (findUsername.get(input.username)) {
      throw new HttpError(409, 'This username is already in use');
    }
    const result = insertOwner.run(input.username, hashPassword(input.password), input.branchId);
    const id = Number(result.lastInsertRowid);
    audit(req.user, 'owner.create', 'user', id);
    res.status(201).json(getOwner.get(id));
  });

  // Admin sets or changes the owner's login. Owners cannot change it themselves.
  router.patch('/owners/:id', (req, res) => {
    const id = parseId(req.params.id);
    const input = parseOwnerUpdate(req.body || {});
    if (!getOwner.get(id)) {
      throw new HttpError(404, 'Owner not found');
    }
    if (input.username !== null) {
      const taken = findUsername.get(input.username);
      if (taken && taken.id !== id) {
        throw new HttpError(409, 'This username is already in use');
      }
    }
    const passwordHash = input.password === null ? null : hashPassword(input.password);
    updateOwner.run(input.username, passwordHash, id);
    // Changing the login signs the owner out everywhere so the new credentials apply.
    revokeSessions.run(id);
    audit(req.user, 'owner.update', 'user', id);
    res.json(getOwner.get(id));
  });

  router.delete('/owners/:id', (req, res) => {
    const id = parseId(req.params.id);
    const result = deactivateOwner.run(id);
    if (result.changes === 0) {
      throw new HttpError(404, 'Owner not found');
    }
    revokeSessions.run(id);
    audit(req.user, 'owner.delete', 'user', id);
    res.json({ ok: true });
  });

  router.delete('/bills/:id', (req, res) => {
    const id = parseId(req.params.id);
    const result = deleteBill.run(id);
    if (result.changes === 0) {
      throw new HttpError(404, 'Bill not found');
    }
    audit(req.user, 'bill.delete', 'bill', id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { adminRouter };
