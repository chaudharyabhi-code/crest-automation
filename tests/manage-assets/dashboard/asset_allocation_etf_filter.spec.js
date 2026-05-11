import { test, expect } from '../../../fixtures/fixtures.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function toRupees(amount, unit) {
  const a = parseFloat(amount) || 0;
  return unit ? a * (UNIT_MULTIPLIERS[unit] || 1) : a;
}

function getEtfFromAllAssets(responseBody) {
  if (!Array.isArray(responseBody?.data)) return 0;
  const etfAsset = responseBody.data.find(asset =>
    asset.name?.toLowerCase() === 'etf' ||
    asset.name?.toLowerCase().includes('etf') ||
    asset.asset_type?.toLowerCase().includes('etf')
  );
  if (!etfAsset) return 0;
  return toRupees(etfAsset.amount, etfAsset.unit);
}

function getEtfFromFilteredAllocation(responseBody) {
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

test.describe('Manage Assets - Asset Allocation ETF Filter (with Manual Assets)', () => {

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

  // Test 1: ETF from All Assets View
  // Asset Allocation API (no filter) → extract ETF entry, compare with Performance Chart (ETF filter)
  test.describe('ETF from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`All Assets ETF vs Performance Chart ETF for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== ETF from All Assets View - ${testDate} ===`);

        const allAssetsResp = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const etfFromAll = getEtfFromAllAssets(allAssetsResp.body);

        const etfPerfResp = await apiClient.get(
          dashboardEndpoints.etfPerformanceChart(userId, testDate)
        );
        const etfFromPerf = getLastPerfChartValue(etfPerfResp.body);

        const comparison = compareValues(etfFromAll.toString(), etfFromPerf, threshold);

        const report = `
=== ETF from All Assets View - ${testDate} ===
Asset Allocation (All) - ETF:     ₹${etfFromAll.toLocaleString()}
Performance Chart (ETF):          ₹${etfFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`etf-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });

  // Test 2: ETF from Filtered View
  // Asset Allocation API (ETF filter) vs Performance Chart API (ETF filter)
  test.describe('ETF from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Filtered ETF vs Performance Chart ETF for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== ETF from Filtered View - ${testDate} ===`);

        const etfAssetResp = await apiClient.get(
          dashboardEndpoints.etfAssetAllocation(userId, testDate)
        );
        const etfFromFiltered = getEtfFromFilteredAllocation(etfAssetResp.body);

        const etfPerfResp = await apiClient.get(
          dashboardEndpoints.etfPerformanceChart(userId, testDate)
        );
        const etfFromPerf = getLastPerfChartValue(etfPerfResp.body);

        const comparison = compareValues(etfFromFiltered.toString(), etfFromPerf, threshold);

        const report = `
=== ETF from Filtered View - ${testDate} ===
Asset Allocation (ETF Filter):    ₹${etfFromFiltered.toLocaleString()}
Performance Chart (ETF Filter):   ₹${etfFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`etf-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
