import { test, expect } from '../../../fixtures/fixtures.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function toRupees(amount, unit) {
  const a = parseFloat(amount) || 0;
  return unit ? a * (UNIT_MULTIPLIERS[unit] || 1) : a;
}

function getEquityFromAllAssets(responseBody) {
  if (!Array.isArray(responseBody?.data)) return 0;
  const equityAsset = responseBody.data.find(asset =>
    asset.name?.toLowerCase() === 'equity' ||
    asset.asset_type?.toLowerCase() === 'equity'
  );
  if (!equityAsset) return 0;
  return toRupees(equityAsset.amount, equityAsset.unit);
}

function getEquityFromFilteredAllocation(responseBody) {
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

test.describe('Manage Assets - Asset Allocation Equity Filter (with Manual Assets)', () => {

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

  // Test 1: Equity from All Assets View
  // Asset Allocation API (no filter) → extract equity entry, compare with Performance Chart (equity filter)
  test.describe('Equity from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`All Assets Equity vs Performance Chart Equity for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Equity from All Assets View - ${testDate} ===`);

        const allAssetsResp = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const equityFromAll = getEquityFromAllAssets(allAssetsResp.body);

        const equityPerfResp = await apiClient.get(
          dashboardEndpoints.equityPerformanceChart(userId, testDate)
        );
        const equityFromPerf = getLastPerfChartValue(equityPerfResp.body);

        const comparison = compareValues(equityFromAll.toString(), equityFromPerf, threshold);

        const report = `
=== Equity from All Assets View - ${testDate} ===
Asset Allocation (All) - Equity:  ₹${equityFromAll.toLocaleString()}
Performance Chart (Equity):       ₹${equityFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`equity-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });

  // Test 2: Equity from Filtered View
  // Asset Allocation API (equity filter) vs Performance Chart API (equity filter)
  test.describe('Equity from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Filtered Equity vs Performance Chart Equity for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Equity from Filtered View - ${testDate} ===`);

        const equityAssetResp = await apiClient.get(
          dashboardEndpoints.equityAssetAllocation(userId, testDate)
        );
        const equityFromFiltered = getEquityFromFilteredAllocation(equityAssetResp.body);

        const equityPerfResp = await apiClient.get(
          dashboardEndpoints.equityPerformanceChart(userId, testDate)
        );
        const equityFromPerf = getLastPerfChartValue(equityPerfResp.body);

        const comparison = compareValues(equityFromFiltered.toString(), equityFromPerf, threshold);

        const report = `
=== Equity from Filtered View - ${testDate} ===
Asset Allocation (Equity Filter):  ₹${equityFromFiltered.toLocaleString()}
Performance Chart (Equity Filter): ₹${equityFromPerf.toLocaleString()}
Difference:                        ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                         ${threshold}%
Result:                            ${comparison.message}
`;
        console.log(report);

        test.info().attach(`equity-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
