import { test, expect } from '../../../fixtures/fixtures.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function toRupees(amount, unit) {
  const a = parseFloat(amount) || 0;
  return unit ? a * (UNIT_MULTIPLIERS[unit] || 1) : a;
}

function getCryptoFromAllAssets(responseBody) {
  if (!Array.isArray(responseBody?.data)) return 0;
  const asset = responseBody.data.find(a =>
    a.name?.toLowerCase() === 'crypto' ||
    a.name?.toLowerCase().includes('crypto') ||
    a.asset_type?.toLowerCase().includes('crypto')
  );
  if (!asset) return 0;
  return toRupees(asset.amount, asset.unit);
}

function getCryptoFromFilteredAllocation(responseBody) {
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

test.describe('Manage Assets - Asset Allocation Crypto Filter (with Manual Assets)', () => {

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

  // Test 1: Crypto from All Assets View
  test.describe('Crypto from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`All Assets Crypto vs Performance Chart Crypto for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Crypto from All Assets View - ${testDate} ===`);

        const allAssetsResp = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const cryptoFromAll = getCryptoFromAllAssets(allAssetsResp.body);

        const cryptoPerfResp = await apiClient.get(
          dashboardEndpoints.cryptoPerformanceChart(userId, testDate)
        );
        const cryptoFromPerf = getLastPerfChartValue(cryptoPerfResp.body);

        const comparison = compareValues(cryptoFromAll.toString(), cryptoFromPerf, threshold);

        const report = `
=== Crypto from All Assets View - ${testDate} ===
Asset Allocation (All) - Crypto:  ₹${cryptoFromAll.toLocaleString()}
Performance Chart (Crypto):       ₹${cryptoFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`crypto-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });

  // Test 2: Crypto from Filtered View
  test.describe('Crypto from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Filtered Crypto vs Performance Chart Crypto for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Crypto from Filtered View - ${testDate} ===`);

        const cryptoAssetResp = await apiClient.get(
          dashboardEndpoints.cryptoAssetAllocation(userId, testDate)
        );
        const cryptoFromFiltered = getCryptoFromFilteredAllocation(cryptoAssetResp.body);

        const cryptoPerfResp = await apiClient.get(
          dashboardEndpoints.cryptoPerformanceChart(userId, testDate)
        );
        const cryptoFromPerf = getLastPerfChartValue(cryptoPerfResp.body);

        const comparison = compareValues(cryptoFromFiltered.toString(), cryptoFromPerf, threshold);

        const report = `
=== Crypto from Filtered View - ${testDate} ===
Asset Allocation (Crypto Filter): ₹${cryptoFromFiltered.toLocaleString()}
Performance Chart (Crypto Filter):₹${cryptoFromPerf.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;
        console.log(report);

        test.info().attach(`crypto-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
