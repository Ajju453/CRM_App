'use strict';

const express = require('express');
const { parseDateRange, HttpError } = require('../validation');
const { TRIP_TIERS } = require('../trips');
const { rankMembers, tierQualifiers, eligibilityCounts } = require('../analytics');

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function leaderboardRouter(db) {
  const router = express.Router();
  const memberTotals = db.prepare(`
    SELECT m.id AS memberId, m.name, m.phone, m.branch_id AS branchId, br.name AS branchName,
           COALESCE(SUM(b.amount), 0) AS totalSales
    FROM members m
    JOIN branches br ON br.id = m.branch_id
    LEFT JOIN bills b ON b.member_id = m.id
      AND (? IS NULL OR b.bill_date >= ?)
      AND (? IS NULL OR b.bill_date <= ?)
    WHERE m.is_deleted = 0
    GROUP BY m.id
  `);

  router.get('/', (req, res) => {
    const { from, to } = parseDateRange(req.query);
    const requested = Number(req.query.limit ?? DEFAULT_LIMIT);
    if (!Number.isInteger(requested) || requested <= 0) {
      throw new HttpError(400, 'Limit must be a positive whole number');
    }
    const limit = Math.min(requested, MAX_LIMIT);

    const isBranch = req.user.role === 'branch';
    const rows = memberTotals
      .all(from, from, to, to)
      .filter((row) => !isBranch || row.branchId === req.user.branchId);
    const ranked = rankMembers(rows);
    const qualifiers = tierQualifiers(ranked);

    res.json({
      from,
      to,
      tiers: TRIP_TIERS.map(({ id, name, threshold }) => ({ id, name, threshold })),
      eligibility: eligibilityCounts(qualifiers),
      qualifiers,
      top: ranked.slice(0, limit),
    });
  });

  return router;
}

module.exports = { leaderboardRouter };
