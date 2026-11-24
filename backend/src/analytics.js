'use strict';

const { TRIP_TIERS, tierFor } = require('./trips');

// Members with sales, highest total first. Ties are ordered by name.
function rankMembers(rows) {
  return rows
    .filter((row) => row.totalSales > 0)
    .sort((a, b) => b.totalSales - a.totalSales || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, rank: index + 1, tier: tierFor(row.totalSales) }));
}

// Ranked members who reached each trip tier, keyed by tier id.
function tierQualifiers(ranked) {
  return Object.fromEntries(
    TRIP_TIERS.map((tier) => [tier.id, ranked.filter((row) => row.totalSales >= tier.threshold)])
  );
}

function eligibilityCounts(qualifiers) {
  return Object.fromEntries(Object.entries(qualifiers).map(([id, rows]) => [id, rows.length]));
}

// Groups bills by the leading characters of bill_date: 7 for month (YYYY-MM), 4 for year (YYYY).
function salesByPeriod(bills, length) {
  const totals = new Map();
  for (const bill of bills) {
    const period = bill.billDate.slice(0, length);
    const entry = totals.get(period) ?? { period, totalBills: 0, totalSales: 0 };
    entry.totalBills += 1;
    entry.totalSales += bill.amount;
    totals.set(period, entry);
  }
  return [...totals.values()].sort((a, b) => (a.period < b.period ? 1 : -1));
}

module.exports = { rankMembers, tierQualifiers, eligibilityCounts, salesByPeriod };
