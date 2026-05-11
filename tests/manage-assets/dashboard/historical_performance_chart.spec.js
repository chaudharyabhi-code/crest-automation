import fs from 'fs';
import path from 'path';
import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, createHistoricalSummaryReport, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function extractApiTotalFromChart(responseBody) {
  let apiTotal;
  const meta = {};

  if (Array.isArray(responseBody?.data) && responseBody.data.length > 0) {
    const last = responseBody.data[responseBody.data.length - 1];
    const totalValue = parseFloat(last.total) || 0;
    const unit = last.unit || '';
    apiTotal = unit ? totalValue * (UNIT_MULTIPLIERS[unit] || 1) : totalValue;
    meta.date = last.date;
    meta.day = last.day;
    meta.originalValue = `${totalValue} ${unit}`;
  } else if (responseBody?.data?.chart_data && Array.isArray(responseBody.data.chart_data)) {
    const last = responseBody.data.chart_data[responseBody.data.chart_data.length - 1];
    apiTotal = last?.total_wealth || last?.value || last?.y || 0;
  } else if (responseBody?.data?.total_wealth) {
    apiTotal = responseBody.data.total_wealth;
  } else if (responseBody?.data?.total) {
    apiTotal = responseBody.data.total;
  }

  return { apiTotal, meta };
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

test.describe('Manage Assets - Historical Performance Chart (with Manual Assets)', () => {

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
    test(`Historical Performance Chart (with Manual Assets) for ${testDate}`, async ({ apiClient }) => {
      const userId = process.env.USER_ID;

      console.log(`\n=== Testing Historical Performance Chart (with Manual Assets) for Date: ${testDate} ===`);

      // 1. API call - same endpoint as previous
      const response = await apiClient.get(
        dashboardEndpoints.historicalPerformanceChart(userId, testDate)
      );

      console.log('\n=== API Response ===');
      console.log(JSON.stringify(response.body, null, 2));

      const { apiTotal, meta } = extractApiTotalFromChart(response.body);

      if (apiTotal === undefined || apiTotal === null) {
        throw new Error(`Total wealth value not found in Performance Chart API response for date ${testDate}`);
      }

      if (meta.date) {
        console.log(`Chart Date: ${meta.date} (${meta.day})  Value: ${meta.originalValue}`);
      }
      console.log(`API Total Wealth for ${testDate}: ₹${apiTotal.toLocaleString()}`);

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
=== Historical Performance Chart (with Manual Assets) - ${testDate} ===
API Total:                  ₹${apiTotal.toLocaleString()}
SQL grand_total:            ₹${grandTotal.toLocaleString()}
SQL manual assets total:    ₹${manualTotal.toLocaleString()}
Combined DB Total:          ₹${combinedTotal.toLocaleString()}
Difference:                 ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                  ${threshold}%
Result:                     ${comparison.message}
`;

      console.log(formattedReport);

      test.info().attach(`historical-performance-manual-${testDate}.txt`, {
        body: formattedReport,
        contentType: 'text/plain'
      });
      test.info().attach(`api-response-performance-${testDate}.json`, {
        body: JSON.stringify(response.body, null, 2),
        contentType: 'application/json'
      });

      expect(comparison.pass).toBe(true);
      expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
    });
  });

  test('Historical Performance Chart Summary (with Manual Assets) - All Dates', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const dates = getHistoricalDates();
    const results = [];
    let allPassed = true;

    console.log('\n=== Historical Performance Chart (with Manual Assets) Summary ===');
    console.log(`Testing ${dates.length} dates: ${dates.join(', ')}`);

    for (const testDate of dates) {
      try {
        const response = await apiClient.get(
          dashboardEndpoints.historicalPerformanceChart(userId, testDate)
        );
        const { apiTotal } = extractApiTotalFromChart(response.body);

        const grandTotal = await getGrandTotal(userId, testDate);
        const manualTotal = await getManualAssetsTotal(userId, testDate);
        const combinedTotal = grandTotal + manualTotal;

        const comparison = compareValues((apiTotal || 0).toString(), combinedTotal, threshold);

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
      'Historical Performance Chart (with Manual Assets)',
      results
    );
    console.log(summaryReport);

    test.info().attach('historical-performance-manual-summary.txt', {
      body: summaryReport,
      contentType: 'text/plain'
    });

    expect(allPassed).toBe(true);
  });
});
