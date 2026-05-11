import fs from 'fs';
import path from 'path';
import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, createHistoricalSummaryReport, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function sumApiAllocation(responseBody) {
  let total = 0;
  const breakdown = [];

  const items = Array.isArray(responseBody?.data) ? responseBody.data : [];
  items.forEach(asset => {
    const name = asset.name || asset.asset_type || asset.type || 'Unknown';
    const amount = parseFloat(asset.amount) || 0;
    const unit = asset.unit || '';
    const rupeeValue = unit ? amount * (UNIT_MULTIPLIERS[unit] || 1) : amount;
    total += rupeeValue;
    breakdown.push({ name, amount, unit, rupeeValue });
  });

  return { total, breakdown };
}

async function getGrandTotal(userId, testDate) {
  const sql = fs
    .readFileSync(path.join(process.cwd(), 'queries', 'historical_allocation_test.sql'), 'utf-8')
    .replace(/{USER_ID}/g, userId)
    .replace(/{END_DATE}/g, testDate)
    .replace(/{HISTORICAL_DATES}/g, `'${testDate}'`);
  const result = await dbClient.query(sql);
  return parseFloat(result.rows[0]?.grand_total) || 0;
}

async function getManualAssetsTotal(userId, testDate) {
  const sql = fs
    .readFileSync(path.join(process.cwd(), 'queries', 'manage-assets', 'historial-assets-sum.sql'), 'utf-8')
    .replace(/{USER_ID}/g, userId)
    .replace(/{END_DATE}/g, testDate);
  const result = await dbClient.query(sql);
  return parseFloat(result.rows[0]?.total_current_value) || 0;
}

test.describe('Manage Assets - Historical Asset Allocation (with Manual Assets)', () => {

  test.beforeAll(async () => {
    await dbClient.init();
    if (!validateHistoricalDates()) {
      console.warn('Some historical dates may be in the future.');
    }
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  const historicalDates = getHistoricalDates();
  const threshold = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

  historicalDates.forEach(testDate => {
    test(`Historical Asset Allocation (with Manual Assets) for ${testDate}`, async ({ apiClient }) => {
      const userId = process.env.USER_ID;

      console.log(`\n=== Testing Historical Asset Allocation (with Manual Assets) for Date: ${testDate} ===`);

      // 1. API call - same endpoint as previous
      const response = await apiClient.get(
        dashboardEndpoints.historicalAssetAllocation(userId, testDate)
      );

      console.log('\n=== API Response ===');
      console.log(JSON.stringify(response.body, null, 2));

      const { total: apiTotal, breakdown } = sumApiAllocation(response.body);

      console.log('\n=== Asset Allocation Breakdown ===');
      breakdown.forEach(a => {
        console.log(`${a.name}: ${a.amount} ${a.unit} = ₹${a.rupeeValue.toLocaleString()}`);
      });
      console.log(`API Total: ₹${apiTotal.toLocaleString()}`);

      // 2. DB - aggregated grand_total + manual assets total
      const grandTotal = await getGrandTotal(userId, testDate);
      const manualTotal = await getManualAssetsTotal(userId, testDate);
      const combinedTotal = grandTotal + manualTotal;

      console.log('\n=== Database Values ===');
      console.log(`grand_total (DB):        ₹${grandTotal.toLocaleString()}`);
      console.log(`manual assets total:     ₹${manualTotal.toLocaleString()}`);
      console.log(`Combined DB Total:       ₹${combinedTotal.toLocaleString()}`);

      // 3. Compare
      const comparison = compareValues(apiTotal.toString(), combinedTotal, threshold);

      const formattedReport = `
=== Historical Asset Allocation (with Manual Assets) - ${testDate} ===
API Total:                  ₹${apiTotal.toLocaleString()}
SQL grand_total:            ₹${grandTotal.toLocaleString()}
SQL manual assets total:    ₹${manualTotal.toLocaleString()}
Combined DB Total:          ₹${combinedTotal.toLocaleString()}
Difference:                 ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                  ${threshold}%
Result:                     ${comparison.message}
`;

      console.log(formattedReport);

      test.info().attach(`historical-asset-allocation-manual-${testDate}.txt`, {
        body: formattedReport,
        contentType: 'text/plain'
      });
      test.info().attach(`api-response-${testDate}.json`, {
        body: JSON.stringify(response.body, null, 2),
        contentType: 'application/json'
      });

      expect(comparison.pass).toBe(true);
      expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
    });
  });

  test('Historical Asset Allocation Summary (with Manual Assets) - All Dates', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const dates = getHistoricalDates();
    const results = [];
    let allPassed = true;

    console.log('\n=== Historical Asset Allocation (with Manual Assets) Summary ===');
    console.log(`Testing ${dates.length} dates: ${dates.join(', ')}`);

    for (const testDate of dates) {
      try {
        const response = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const { total: apiTotal } = sumApiAllocation(response.body);

        const grandTotal = await getGrandTotal(userId, testDate);
        const manualTotal = await getManualAssetsTotal(userId, testDate);
        const combinedTotal = grandTotal + manualTotal;

        const comparison = compareValues(apiTotal.toString(), combinedTotal, threshold);

        results.push({
          date: testDate,
          passed: comparison.pass,
          diffPct: comparison.diffPct,
          apiValue: apiTotal,
          dbValue: `${grandTotal} + ${manualTotal} = ${combinedTotal}`
        });

        if (!comparison.pass) allPassed = false;
      } catch (error) {
        results.push({ date: testDate, passed: false, error: error.message });
        allPassed = false;
      }
    }

    const summaryReport = createHistoricalSummaryReport(
      'Historical Asset Allocation (with Manual Assets)',
      results
    );
    console.log(summaryReport);

    test.info().attach('historical-asset-allocation-manual-summary.txt', {
      body: summaryReport,
      contentType: 'text/plain'
    });

    expect(allPassed).toBe(true);
  });
});
