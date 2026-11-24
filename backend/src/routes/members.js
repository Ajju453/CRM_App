'use strict';

const express = require('express');
const { createAuditLogger } = require('../db');
const { HttpError, parseId } = require('../validation');

const OCCUPATIONS = ['Contractor', 'Engineer', 'Mistri'];

function parseMemberInput(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.replace(/[\s-]/g, '') : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!name || name.length > 100) {
    throw new HttpError(400, 'Name is required (max 100 characters)');
  }
  if (!/^\+?\d{10,15}$/.test(phone)) {
    throw new HttpError(400, 'Enter a valid phone number');
  }
  if (address.length > 300) {
    throw new HttpError(400, 'Address is too long (max 300 characters)');
  }
  if (!OCCUPATIONS.includes(body.occupation)) {
    throw new HttpError(400, 'Occupation must be Contractor, Engineer or Mistri');
  }
  return { name, phone, address: address || null, occupation: body.occupation };
}

function membersRouter(db) {
  const router = express.Router();
  const audit = createAuditLogger(db);
  const listMembers = db.prepare(`
    SELECT m.id, m.name, m.phone, m.address, m.occupation, m.created_at AS createdAt,
           COUNT(b.id) AS billCount, COALESCE(SUM(b.amount), 0) AS totalAmount
    FROM members m
    LEFT JOIN bills b ON b.member_id = m.id
    WHERE m.branch_id = ? AND m.is_deleted = 0
      AND (m.name LIKE ? OR m.phone LIKE ?)
    GROUP BY m.id
    ORDER BY m.name COLLATE NOCASE
  `);
  const findActivePhone = db.prepare('SELECT id FROM members WHERE branch_id = ? AND phone = ? AND is_deleted = 0');
  const insertMember = db.prepare(
    'INSERT INTO members (branch_id, name, phone, address, occupation) VALUES (?, ?, ?, ?, ?)'
  );
  const getMember = db.prepare(`
    SELECT id, name, phone, address, occupation, created_at AS createdAt
    FROM members WHERE id = ? AND branch_id = ? AND is_deleted = 0
  `);
  const memberBills = db.prepare(`
    SELECT id, site, bill_date AS billDate, bill_time AS billTime, amount
    FROM bills WHERE member_id = ? AND branch_id = ?
    ORDER BY bill_date DESC, id DESC
  `);
  const softDeleteMember = db.prepare(`
    UPDATE members SET is_deleted = 1, deleted_at = datetime('now')
    WHERE id = ? AND branch_id = ? AND is_deleted = 0
  `);

  router.get('/', (req, res) => {
    const term = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const like = `%${term}%`;
    res.json(listMembers.all(req.user.branchId, like, like));
  });

  // A member with their bills and total, for the member drill-down.
  router.get('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const { branchId } = req.user;
    const member = getMember.get(id, branchId);
    if (!member) {
      throw new HttpError(404, 'Member not found');
    }
    const bills = memberBills.all(id, branchId);
    const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);
    res.json({ ...member, billCount: bills.length, totalAmount, bills });
  });

  router.post('/', (req, res) => {
    const input = parseMemberInput(req.body || {});
    const { branchId } = req.user;
    if (findActivePhone.get(branchId, input.phone)) {
      throw new HttpError(409, 'A member with this phone number already exists in your showroom');
    }
    const result = insertMember.run(branchId, input.name, input.phone, input.address, input.occupation);
    const id = Number(result.lastInsertRowid);
    audit(req.user, 'member.create', 'member', id);
    res.status(201).json(getMember.get(id, branchId));
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const result = softDeleteMember.run(id, req.user.branchId);
    if (result.changes === 0) {
      throw new HttpError(404, 'Member not found');
    }
    audit(req.user, 'member.delete', 'member', id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { membersRouter, parseMemberInput };
