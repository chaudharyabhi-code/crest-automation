import { test, expect } from '../../../fixtures/fixtures.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { compareValues } from '../../../utils/comparison.js';

const UNIT_MULTIPLIERS = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };

function toRupees(amount, unit) {
  const a = parseFloat(amount) || 0;
  return unit ? a * (UNIT_MULTIPLIERS[unit] || 1) : a;
}

function getBankDepositsFromAllAssets(responseBody) {
  if (!Array.isArray(responseBody?.data)) return 0;
  const asset = responseBody.data.find(a =>
    a.name?.toLowerCase() === 'cash' ||
    a.name?.toLowerCase().includes('deposit') ||
    a.name?.toLowerCase().includes('bank') ||
    a.asset_type?.toLowerCase() === 'cash' ||
    a.asset_type?.toLowerCase().includes('deposit')
  );
  if (!asset) return 0;
  return toRupees(asset.amount, asset.unit);
}

function getBankDepositsFromFilteredAllocation(responseBody) {
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

test.describe('Manage Assets - Asset Allocation Bank Deposits Filter (with Manual Assets)', () => {

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

  // Test 1: Bank Deposits from All Assets View
  test.describe('Bank Deposits from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`All Assets Bank Deposits vs Performance Chart Bank Deposits for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Bank Deposits from All Assets View - ${testDate} ===`);

        const allAssetsResp = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );
        const bankFromAll = getBankDepositsFromAllAssets(allAssetsResp.body);

        const bankPerfResp = await apiClient.get(
          dashboardEndpoints.bankDepositsPerformanceChart(userId, testDate)
        );
        const bankFromPerf = getLastPerfChartValue(bankPerfResp.body);

        const comparison = compareValues(bankFromAll.toString(), bankFromPerf, threshold);

        const report = `
=== Bank Deposits from All Assets View - ${testDate} ===
Asset Allocation (All) - Bank Deposits:  ₹${bankFromAll.toLocaleString()}
Performance Chart (Bank Deposits):       ₹${bankFromPerf.toLocaleString()}
Difference:                              ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                               ${threshold}%
Result:                                  ${comparison.message}
`;
        console.log(report);

        test.info().attach(`bank-deposits-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });

  // Test 2: Bank Deposits from Filtered View
  test.describe('Bank Deposits from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Filtered Bank Deposits vs Performance Chart Bank Deposits for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Bank Deposits from Filtered View - ${testDate} ===`);

        const bankAssetResp = await apiClient.get(
          dashboardEndpoints.bankDepositsAssetAllocation(userId, testDate)
        );
        const bankFromFiltered = getBankDepositsFromFilteredAllocation(bankAssetResp.body);

        const bankPerfResp = await apiClient.get(
          dashboardEndpoints.bankDepositsPerformanceChart(userId, testDate)
        );
        const bankFromPerf = getLastPerfChartValue(bankPerfResp.body);

        const comparison = compareValues(bankFromFiltered.toString(), bankFromPerf, threshold);

        const report = `
=== Bank Deposits from Filtered View - ${testDate} ===
Asset Allocation (Bank Deposits Filter): ₹${bankFromFiltered.toLocaleString()}
Performance Chart (Bank Deposits):       ₹${bankFromPerf.toLocaleString()}
Difference:                              ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                               ${threshold}%
Result:                                  ${comparison.message}
`;
        console.log(report);

        test.info().attach(`bank-deposits-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
