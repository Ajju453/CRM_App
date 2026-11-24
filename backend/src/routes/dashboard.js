'use strict';

const express = require('express');
const { parseDateRange } = require('../validation');

function dashboardRouter(db) {
  const router = express.Router();
  const countMembers = db.prepare('SELECT COUNT(*) AS n FROM members WHERE branch_id = ? AND is_deleted = 0');
  const countMembersWithPurchase = db.prepare(`
    SELECT COUNT(DISTINCT m.id) AS n
    FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE b.branch_id = ? AND m.is_deleted = 0
      AND (? IS NULL OR b.bill_date >= ?)
      AND (? IS NULL OR b.bill_date <= ?)
  `);
  const salesTotals = db.prepare(`
    SELECT COUNT(*) AS totalBills, COALESCE(SUM(b.amount), 0) AS totalSales
    FROM bills b
    WHERE b.branch_id = ?
      AND (? IS NULL OR b.bill_date >= ?)
      AND (? IS NULL OR b.bill_date <= ?)
  `);
  const monthlySales = db.prepare(`
    SELECT substr(bill_date, 1, 7) AS month, COUNT(*) AS totalBills, SUM(amount) AS totalSales
    FROM bills
    WHERE branch_id = ?
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `);

  const historyBills = db.prepare(`
    SELECT b.id, b.member_id AS memberId, m.name AS memberName, m.phone AS memberPhone, b.site,
           b.bill_date AS billDate, b.bill_time AS billTime, b.amount
    FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE b.branch_id = ?
      AND (? IS NULL OR b.bill_date >= ?)
      AND (? IS NULL OR b.bill_date <= ?)
    ORDER BY b.bill_date DESC, b.id DESC
  `);

  router.get('/', (req, res) => {
    const { branchId } = req.user;
    const { from, to } = parseDateRange(req.query);
    const range = [from, from, to, to];
    const totalMembers = countMembers.get(branchId).n;
    const membersWithPurchase = countMembersWithPurchase.get(branchId, ...range).n;
    const sales = salesTotals.get(branchId, ...range);
    res.json({
      totalMembers,
      membersWithPurchase,
      membersWithoutPurchase: totalMembers - membersWithPurchase,
      totalBills: sales.totalBills,
      totalSales: sales.totalSales,
      monthly: monthlySales.all(branchId),
      history: historyBills.all(branchId, ...range),
    });
  });

  return router;
}

module.exports = { dashboardRouter };
