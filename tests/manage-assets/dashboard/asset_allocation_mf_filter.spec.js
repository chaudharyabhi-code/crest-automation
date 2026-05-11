import { test, expect } from '../../../fixtures/fixtures.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function toRupees(amount, unit) {
  const a = parseFloat(amount) || 0;
  return unit ? a * (UNIT_MULTIPLIERS[unit] || 1) : a;
}

function getMfFromAllAssets(responseBody) {
  if (!Array.isArray(responseBody?.data)) return 0;
  const mfAsset = responseBody.data.find(asset =>
    asset.name?.toLowerCase().includes('mutual') ||
    asset.name?.toLowerCase() === 'mf' ||
    asset.asset_type?.toLowerCase().includes('mutual')
  );
  if (!mfAsset) return 0;
  return toRupees(mfAsset.amount, mfAsset.unit);
}

function getMfFromFilteredAllocation(responseBody) {
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

test.describe('Manage Assets - Asset Allocation MF Filter (with Manual Assets)', () => {

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

  // Test 1: MF from All Assets View
  // Asset Allocation API (no filter) → extract MF entry, compare with Performance Chart (MF filter)
  test.describe('Mutual Fund from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`All Assets MF vs Performance Chart MF for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Mutual Fund from All Assets View - ${testDate} ===`);

        const allAssetsResp = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const mfFromAll = getMfFromAllAssets(allAssetsResp.body);

        const mfPerfResp = await apiClient.get(
          dashboardEndpoints.mfPerformanceChart(userId, testDate)
        );
        const mfFromPerf = getLastPerfChartValue(mfPerfResp.body);

        const comparison = compareValues(mfFromAll.toString(), mfFromPerf, threshold);

        const report = `
=== Mutual Fund from All Assets View - ${testDate} ===
Asset Allocation (All) - MF:      ₹${mfFromAll.toLocaleString()}
Performance Chart (MF):           ₹${mfFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`mf-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });

  // Test 2: MF from Filtered View
  // Asset Allocation API (MF filter) vs Performance Chart API (MF filter)
  test.describe('Mutual Fund from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Filtered MF vs Performance Chart MF for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Mutual Fund from Filtered View - ${testDate} ===`);

        const mfAssetResp = await apiClient.get(
          dashboardEndpoints.mfAssetAllocation(userId, testDate)
        );
        const mfFromFiltered = getMfFromFilteredAllocation(mfAssetResp.body);

        const mfPerfResp = await apiClient.get(
          dashboardEndpoints.mfPerformanceChart(userId, testDate)
        );
        const mfFromPerf = getLastPerfChartValue(mfPerfResp.body);

        const comparison = compareValues(mfFromFiltered.toString(), mfFromPerf, threshold);

        const report = `
=== Mutual Fund from Filtered View - ${testDate} ===
Asset Allocation (MF Filter):     ₹${mfFromFiltered.toLocaleString()}
Performance Chart (MF Filter):    ₹${mfFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`mf-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
