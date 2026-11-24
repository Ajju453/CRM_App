'use strict';

const express = require('express');
const { createAuditLogger } = require('../db');
const { parseMemberInput } = require('./members');
const { HttpError, isValidDate, parseDateRange, parseId } = require('../validation');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function parseBillInput(body) {
  const amount = Number(body.amount);
  const site = typeof body.site === 'string' ? body.site.trim() : '';
  const billTime = body.billTime === undefined || body.billTime === null || body.billTime === ''
    ? null
    : body.billTime;
  if (!isValidDate(body.billDate)) {
    throw new HttpError(400, 'Bill date must be a valid YYYY-MM-DD date');
  }
  if (billTime !== null && (typeof billTime !== 'string' || !TIME_PATTERN.test(billTime))) {
    throw new HttpError(400, 'Bill time must use the HH:MM format');
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, 'Amount must be a positive whole number');
  }
  if (site.length > 150) {
    throw new HttpError(400, 'Site is too long (max 150 characters)');
  }
  return { amount, billDate: body.billDate, billTime, site: site || null };
}

function hasMemberId(body) {
  return body.memberId !== undefined && body.memberId !== null && body.memberId !== '';
}

function billsRouter(db) {
  const router = express.Router();
  const audit = createAuditLogger(db);
  const findActiveMember = db.prepare(
    'SELECT id, name FROM members WHERE id = ? AND branch_id = ? AND is_deleted = 0'
  );
  const findActivePhone = db.prepare(
    'SELECT id, name FROM members WHERE branch_id = ? AND phone = ? AND is_deleted = 0'
  );
  const insertMember = db.prepare(
    'INSERT INTO members (branch_id, name, phone, address, occupation) VALUES (?, ?, ?, ?, ?)'
  );
  const insertBill = db.prepare(
    'INSERT INTO bills (branch_id, member_id, site, bill_date, bill_time, amount) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const listBills = db.prepare(`
    SELECT b.id, b.member_id AS memberId, m.name AS memberName, m.phone AS memberPhone, b.site,
           b.bill_date AS billDate, b.bill_time AS billTime, b.amount
    FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE b.branch_id = ?
      AND (? IS NULL OR b.bill_date >= ?)
      AND (? IS NULL OR b.bill_date <= ?)
    ORDER BY b.bill_date DESC, b.id DESC
    LIMIT ?
  `);
  const deleteBill = db.prepare('DELETE FROM bills WHERE id = ? AND branch_id = ?');

  // Uses the chosen member, or finds the member by phone, or creates a new one.
  function resolveMember(branchId, body) {
    if (hasMemberId(body)) {
      const memberId = parseId(body.memberId);
      const member = findActiveMember.get(memberId, branchId);
      if (!member) {
        throw new HttpError(404, 'Member not found');
      }
      return { id: member.id, name: member.name, created: false };
    }
    const input = parseMemberInput(body);
    const existing = findActivePhone.get(branchId, input.phone);
    if (existing) {
      return { id: existing.id, name: existing.name, created: false };
    }
    const result = insertMember.run(branchId, input.name, input.phone, input.address, input.occupation);
    return { id: Number(result.lastInsertRowid), name: input.name, created: true };
  }

  router.post('/', (req, res) => {
    const body = req.body || {};
    const input = parseBillInput(body);
    const { branchId } = req.user;

    db.exec('BEGIN');
    let member;
    let id;
    try {
      member = resolveMember(branchId, body);
      const result = insertBill.run(
        branchId, member.id, input.site, input.billDate, input.billTime, input.amount
      );
      id = Number(result.lastInsertRowid);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    if (member.created) {
      audit(req.user, 'member.create', 'member', member.id);
    }
    audit(req.user, 'bill.create', 'bill', id);
    res.status(201).json({
      id,
      memberId: member.id,
      memberName: member.name,
      createdMember: member.created,
      ...input,
    });
  });

  router.get('/', (req, res) => {
    const { from, to } = parseDateRange(req.query);
    const requested = Number(req.query.limit ?? DEFAULT_LIMIT);
    const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;
    res.json(listBills.all(req.user.branchId, from, from, to, to, limit));
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const result = deleteBill.run(id, req.user.branchId);
    if (result.changes === 0) {
      throw new HttpError(404, 'Bill not found');
    }
    audit(req.user, 'bill.delete', 'bill', id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { billsRouter };
