'use strict';

const LAKH = 100000;

// Thresholds are member total sales in whole rupees, ordered from lowest to highest.
const TRIP_TIERS = Object.freeze([
  Object.freeze({ id: 'goa', name: 'Goa', threshold: 20 * LAKH }),
  Object.freeze({ id: 'kerala', name: 'Kerala', threshold: 35 * LAKH }),
  Object.freeze({ id: 'kashmir', name: 'Kashmir', threshold: 60 * LAKH }),
  Object.freeze({ id: 'bangkok', name: 'Bangkok', threshold: 80 * LAKH }),
]);

// Returns the highest tier reached, or null when below the lowest threshold.
function tierFor(totalSales) {
  let reached = null;
  for (const tier of TRIP_TIERS) {
    if (totalSales >= tier.threshold) reached = tier;
  }
  return reached;
}

module.exports = { TRIP_TIERS, tierFor };
