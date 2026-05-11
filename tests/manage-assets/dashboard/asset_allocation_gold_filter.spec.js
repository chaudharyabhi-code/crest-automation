import { test, expect } from '../../../fixtures/fixtures.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function toRupees(amount, unit) {
  const a = parseFloat(amount) || 0;
  return unit ? a * (UNIT_MULTIPLIERS[unit] || 1) : a;
}

function getGoldFromAllAssets(responseBody) {
  if (!Array.isArray(responseBody?.data)) return 0;
  const asset = responseBody.data.find(a =>
    a.name?.toLowerCase() === 'gold' ||
    a.name?.toLowerCase().includes('gold') ||
    a.asset_type?.toLowerCase().includes('gold')
  );
  if (!asset) return 0;
  return toRupees(asset.amount, asset.unit);
}

function getGoldFromFilteredAllocation(responseBody) {
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

test.describe('Manage Assets - Asset Allocation Gold Filter (with Manual Assets)', () => {

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

  // Test 1: Gold from All Assets View
  test.describe('Gold from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`All Assets Gold vs Performance Chart Gold for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Gold from All Assets View - ${testDate} ===`);

        const allAssetsResp = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const goldFromAll = getGoldFromAllAssets(allAssetsResp.body);

        const goldPerfResp = await apiClient.get(
          dashboardEndpoints.goldPerformanceChart(userId, testDate)
        );
        const goldFromPerf = getLastPerfChartValue(goldPerfResp.body);

        const comparison = compareValues(goldFromAll.toString(), goldFromPerf, threshold);

        const report = `
=== Gold from All Assets View - ${testDate} ===
Asset Allocation (All) - Gold:    ₹${goldFromAll.toLocaleString()}
Performance Chart (Gold):         ₹${goldFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`gold-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });

  // Test 2: Gold from Filtered View
  test.describe('Gold from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Filtered Gold vs Performance Chart Gold for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Gold from Filtered View - ${testDate} ===`);

        const goldAssetResp = await apiClient.get(
          dashboardEndpoints.goldAssetAllocation(userId, testDate)
        );
        const goldFromFiltered = getGoldFromFilteredAllocation(goldAssetResp.body);

        const goldPerfResp = await apiClient.get(
          dashboardEndpoints.goldPerformanceChart(userId, testDate)
        );
        const goldFromPerf = getLastPerfChartValue(goldPerfResp.body);

        const comparison = compareValues(goldFromFiltered.toString(), goldFromPerf, threshold);

        const report = `
=== Gold from Filtered View - ${testDate} ===
Asset Allocation (Gold Filter):   ₹${goldFromFiltered.toLocaleString()}
Performance Chart (Gold Filter):  ₹${goldFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`gold-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
