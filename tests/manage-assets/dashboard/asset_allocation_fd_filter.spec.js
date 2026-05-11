import { test, expect } from '../../../fixtures/fixtures.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function toRupees(amount, unit) {
  const a = parseFloat(amount) || 0;
  return unit ? a * (UNIT_MULTIPLIERS[unit] || 1) : a;
}

function getFdFromAllAssets(responseBody) {
  if (!Array.isArray(responseBody?.data)) return 0;
  const asset = responseBody.data.find(a =>
    a.name?.toLowerCase() === 'fd' ||
    a.name?.toLowerCase().includes('fixed') ||
    a.name?.toLowerCase().includes('term') ||
    a.asset_type?.toLowerCase() === 'fd' ||
    a.asset_type?.toLowerCase().includes('fixed') ||
    a.asset_type?.toLowerCase().includes('term')
  );
  if (!asset) return 0;
  return toRupees(asset.amount, asset.unit);
}

function getFdFromFilteredAllocation(responseBody) {
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

test.describe('Manage Assets - Asset Allocation Fixed Deposits Filter (with Manual Assets)', () => {

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

  // Test 1: FD from All Assets View
  test.describe('Fixed Deposits from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`All Assets FD vs Performance Chart FD for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Fixed Deposits from All Assets View - ${testDate} ===`);

        const allAssetsResp = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const fdFromAll = getFdFromAllAssets(allAssetsResp.body);

        const fdPerfResp = await apiClient.get(
          dashboardEndpoints.fdPerformanceChart(userId, testDate)
        );
        const fdFromPerf = getLastPerfChartValue(fdPerfResp.body);

        const comparison = compareValues(fdFromAll.toString(), fdFromPerf, threshold);

        const report = `
=== Fixed Deposits from All Assets View - ${testDate} ===
Asset Allocation (All) - FD:      ₹${fdFromAll.toLocaleString()}
Performance Chart (FD):           ₹${fdFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`fd-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });

  // Test 2: FD from Filtered View
  test.describe('Fixed Deposits from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Filtered FD vs Performance Chart FD for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Fixed Deposits from Filtered View - ${testDate} ===`);

        const fdAssetResp = await apiClient.get(
          dashboardEndpoints.fdAssetAllocation(userId, testDate)
        );
        const fdFromFiltered = getFdFromFilteredAllocation(fdAssetResp.body);

        const fdPerfResp = await apiClient.get(
          dashboardEndpoints.fdPerformanceChart(userId, testDate)
        );
        const fdFromPerf = getLastPerfChartValue(fdPerfResp.body);

        const comparison = compareValues(fdFromFiltered.toString(), fdFromPerf, threshold);

        const report = `
=== Fixed Deposits from Filtered View - ${testDate} ===
Asset Allocation (FD Filter):     ₹${fdFromFiltered.toLocaleString()}
Performance Chart (FD Filter):    ₹${fdFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`fd-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
