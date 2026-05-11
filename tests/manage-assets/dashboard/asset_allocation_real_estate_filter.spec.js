import { test, expect } from '../../../fixtures/fixtures.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function toRupees(amount, unit) {
  const a = parseFloat(amount) || 0;
  return unit ? a * (UNIT_MULTIPLIERS[unit] || 1) : a;
}

function getRealEstateFromAllAssets(responseBody) {
  if (!Array.isArray(responseBody?.data)) return 0;
  const asset = responseBody.data.find(a =>
    a.name?.toLowerCase() === 'real estate' ||
    a.name?.toLowerCase().includes('real estate') ||
    a.name?.toLowerCase().includes('realestate') ||
    a.name?.toLowerCase().includes('property') ||
    a.asset_type?.toLowerCase().includes('real estate') ||
    a.asset_type?.toLowerCase().includes('realestate') ||
    a.asset_type?.toLowerCase().includes('property')
  );
  if (!asset) return 0;
  return toRupees(asset.amount, asset.unit);
}

function getRealEstateFromFilteredAllocation(responseBody) {
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

test.describe('Manage Assets - Asset Allocation Real Estate Filter (with Manual Assets)', () => {

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

  // Test 1: Real Estate from All Assets View
  test.describe('Real Estate from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`All Assets Real Estate vs Performance Chart Real Estate for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Real Estate from All Assets View - ${testDate} ===`);

        const allAssetsResp = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const reFromAll = getRealEstateFromAllAssets(allAssetsResp.body);

        const rePerfResp = await apiClient.get(
          dashboardEndpoints.realEstatePerformanceChart(userId, testDate)
        );
        const reFromPerf = getLastPerfChartValue(rePerfResp.body);

        const comparison = compareValues(reFromAll.toString(), reFromPerf, threshold);

        const report = `
=== Real Estate from All Assets View - ${testDate} ===
Asset Allocation (All) - Real Estate:  ₹${reFromAll.toLocaleString()}
Performance Chart (Real Estate):       ₹${reFromPerf.toLocaleString()}
Difference:                            ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                             ${threshold}%
Result:                                ${comparison.message}
`;
        console.log(report);

        test.info().attach(`real-estate-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });

  // Test 2: Real Estate from Filtered View
  test.describe('Real Estate from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Filtered Real Estate vs Performance Chart Real Estate for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Real Estate from Filtered View - ${testDate} ===`);

        const reAssetResp = await apiClient.get(
          dashboardEndpoints.realEstateAssetAllocation(userId, testDate)
        );
        const reFromFiltered = getRealEstateFromFilteredAllocation(reAssetResp.body);

        const rePerfResp = await apiClient.get(
          dashboardEndpoints.realEstatePerformanceChart(userId, testDate)
        );
        const reFromPerf = getLastPerfChartValue(rePerfResp.body);

        const comparison = compareValues(reFromFiltered.toString(), reFromPerf, threshold);

        const report = `
=== Real Estate from Filtered View - ${testDate} ===
Asset Allocation (Real Estate Filter): ₹${reFromFiltered.toLocaleString()}
Performance Chart (Real Estate Filter):₹${reFromPerf.toLocaleString()}
Difference:                            ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                             ${threshold}%
Result:                                ${comparison.message}
`;
        console.log(report);

        test.info().attach(`real-estate-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
