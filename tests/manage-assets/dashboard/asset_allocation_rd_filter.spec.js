import { test, expect } from '../../../fixtures/fixtures.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function toRupees(amount, unit) {
  const a = parseFloat(amount) || 0;
  return unit ? a * (UNIT_MULTIPLIERS[unit] || 1) : a;
}

function getRdFromAllAssets(responseBody) {
  if (!Array.isArray(responseBody?.data)) return 0;
  const asset = responseBody.data.find(a =>
    a.name?.toLowerCase() === 'rd' ||
    a.name?.toLowerCase().includes('recurring') ||
    a.asset_type?.toLowerCase() === 'rd' ||
    a.asset_type?.toLowerCase().includes('recurring')
  );
  if (!asset) return 0;
  return toRupees(asset.amount, asset.unit);
}

function getRdFromFilteredAllocation(responseBody) {
  if (!Array.isArray(responseBody?.data)) {
    if (typeof responseBody?.data === 'object' && responseBody?.data) {
      const a = responseBody.data;
      return toRupees(a.amount || a.total || 0, a.unit || '');
    }
    return 0;
  }
  return responseBody.data.reduce((sum, asset) => sum + toRupees(asset.amount, asset.unit), 0);
}

function getLastPerfChartValue(responseBody) {
  if (!Array.isArray(responseBody?.data) || responseBody.data.length === 0) return 0;
  const last = responseBody.data[responseBody.data.length - 1];
  return toRupees(last.total, last.unit);
}

test.describe('Manage Assets - Asset Allocation Recurring Deposits Filter (with Manual Assets)', () => {

  test.beforeAll(async () => {
    if (!validateHistoricalDates()) {
      console.warn('Some historical dates may be in the future.');
    }
  });

  const getTestDates = () => {
    const historicalDates = getHistoricalDates();
    const today = new Date().toISOString().split('T')[0];
    return historicalDates.includes(today) ? historicalDates : [today, ...historicalDates];
  };

  const testDates = getTestDates();
  const threshold = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

  // Test 1: RD from All Assets View
  test.describe('Recurring Deposits from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`All Assets RD vs Performance Chart RD for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Recurring Deposits from All Assets View - ${testDate} ===`);

        const allAssetsResp = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const rdFromAll = getRdFromAllAssets(allAssetsResp.body);

        const rdPerfResp = await apiClient.get(
          dashboardEndpoints.rdPerformanceChart(userId, testDate)
        );
        const rdFromPerf = getLastPerfChartValue(rdPerfResp.body);

        const comparison = compareValues(rdFromAll.toString(), rdFromPerf, threshold);

        const report = `
=== Recurring Deposits from All Assets View - ${testDate} ===
Asset Allocation (All) - RD:      ₹${rdFromAll.toLocaleString()}
Performance Chart (RD):           ₹${rdFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`rd-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });

  // Test 2: RD from Filtered View
  test.describe('Recurring Deposits from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Filtered RD vs Performance Chart RD for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Recurring Deposits from Filtered View - ${testDate} ===`);

        const rdAssetResp = await apiClient.get(
          dashboardEndpoints.rdAssetAllocation(userId, testDate)
        );
        const rdFromFiltered = getRdFromFilteredAllocation(rdAssetResp.body);

        const rdPerfResp = await apiClient.get(
          dashboardEndpoints.rdPerformanceChart(userId, testDate)
        );
        const rdFromPerf = getLastPerfChartValue(rdPerfResp.body);

        const comparison = compareValues(rdFromFiltered.toString(), rdFromPerf, threshold);

        const report = `
=== Recurring Deposits from Filtered View - ${testDate} ===
Asset Allocation (RD Filter):     ₹${rdFromFiltered.toLocaleString()}
Performance Chart (RD Filter):    ₹${rdFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`rd-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
