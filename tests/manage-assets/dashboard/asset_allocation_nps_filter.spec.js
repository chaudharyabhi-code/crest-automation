import { test, expect } from '../../../fixtures/fixtures.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function toRupees(amount, unit) {
  const a = parseFloat(amount) || 0;
  return unit ? a * (UNIT_MULTIPLIERS[unit] || 1) : a;
}

function getNpsFromAllAssets(responseBody) {
  if (!Array.isArray(responseBody?.data)) return 0;
  const asset = responseBody.data.find(a =>
    a.name?.toLowerCase() === 'nps' ||
    a.name?.toLowerCase().includes('nps') ||
    a.name?.toLowerCase().includes('pension') ||
    a.asset_type?.toLowerCase() === 'nps' ||
    a.asset_type?.toLowerCase().includes('pension')
  );
  if (!asset) return 0;
  return toRupees(asset.amount, asset.unit);
}

function getNpsFromFilteredAllocation(responseBody) {
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

test.describe('Manage Assets - Asset Allocation NPS Filter (with Manual Assets)', () => {

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

  // Test 1: NPS from All Assets View
  test.describe('NPS from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`All Assets NPS vs Performance Chart NPS for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== NPS from All Assets View - ${testDate} ===`);

        const allAssetsResp = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const npsFromAll = getNpsFromAllAssets(allAssetsResp.body);

        const npsPerfResp = await apiClient.get(
          dashboardEndpoints.npsPerformanceChart(userId, testDate)
        );
        const npsFromPerf = getLastPerfChartValue(npsPerfResp.body);

        const comparison = compareValues(npsFromAll.toString(), npsFromPerf, threshold);

        const report = `
=== NPS from All Assets View - ${testDate} ===
Asset Allocation (All) - NPS:     ₹${npsFromAll.toLocaleString()}
Performance Chart (NPS):          ₹${npsFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`nps-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });

  // Test 2: NPS from Filtered View
  test.describe('NPS from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Filtered NPS vs Performance Chart NPS for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== NPS from Filtered View - ${testDate} ===`);

        const npsAssetResp = await apiClient.get(
          dashboardEndpoints.npsAssetAllocation(userId, testDate)
        );
        const npsFromFiltered = getNpsFromFilteredAllocation(npsAssetResp.body);

        const npsPerfResp = await apiClient.get(
          dashboardEndpoints.npsPerformanceChart(userId, testDate)
        );
        const npsFromPerf = getLastPerfChartValue(npsPerfResp.body);

        const comparison = compareValues(npsFromFiltered.toString(), npsFromPerf, threshold);

        const report = `
=== NPS from Filtered View - ${testDate} ===
Asset Allocation (NPS Filter):    ₹${npsFromFiltered.toLocaleString()}
Performance Chart (NPS Filter):   ₹${npsFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`nps-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
