import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../../utils/family/testHelpers.js';
import { familyDashboardEndpoints as dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { extractUnitAndValue, compareValues } from '../../../utils/comparison.js';

test.describe('Asset Allocation Bank Deposits Filter Tests (Family)', () => {

  test.beforeAll(async () => {
    await dbClient.init();

    // Validate that historical dates are in the past
    const datesValid = validateHistoricalDates();
    if (!datesValid) {
      console.warn('Some historical dates may be in the future.');
    }
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  // Get all test dates (current day + historical dates)
  const getTestDates = () => {
    const historicalDates = getHistoricalDates();
    const today = new Date().toISOString().split('T')[0];

    // Add today if not already in the list
    if (!historicalDates.includes(today)) {
      return [today, ...historicalDates];
    }
    return historicalDates;
  };

  const testDates = getTestDates();

  // Test 1: Bank Deposits from All Assets View
  // Extract Bank Deposits value from unfiltered asset allocation and compare with Bank Deposits-filtered performance chart
  test.describe('Bank Deposits from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`Compare All Assets Bank Deposits vs Performance Chart Bank Deposits for ${testDate}`, async ({ apiClient }) => {
        const familyId = process.env.FAMILY_ID;

        console.log(`\n=== Testing Bank Deposits from All Assets View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITHOUT filter (all assets)
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(familyId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (All Assets) ===');
        console.log(JSON.stringify(allAssetsResponse.body, null, 2));

        // 2. Extract ONLY the Bank Deposits value from all assets response
        let bankDepositsValueFromAllAssets = 0;

        if (Array.isArray(allAssetsResponse.body?.data)) {
          // Find the bank deposits entry in the response
          // Look for various possible names: Cash, Bank Deposits, Deposits, etc.
          const bankDepositsAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase() === 'cash' ||
            asset.name?.toLowerCase().includes('deposit') ||
            asset.name?.toLowerCase().includes('bank') ||
            asset.asset_type?.toLowerCase() === 'cash' ||
            asset.asset_type?.toLowerCase().includes('deposit')
          );

          if (bankDepositsAsset) {
            const amount = parseFloat(bankDepositsAsset.amount) || 0;
            const unit = bankDepositsAsset.unit || '';

            // Convert to base rupee value
            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            bankDepositsValueFromAllAssets = rupeeValue;

            console.log(`\nBank Deposits from All Assets: ${amount} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          } else {
            console.log('\nNo Bank Deposits found in All Assets response');
          }
        }

        // 3. Call Performance Chart API WITH Bank Deposits filter
        const bankDepositsPerfResponse = await apiClient.get(
          dashboardEndpoints.bankDepositsPerformanceChart(familyId, testDate)
        );

        console.log('\n=== Performance Chart API Response (Bank Deposits Filter) ===');
        console.log(JSON.stringify(bankDepositsPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let bankDepositsValueFromPerfChart = 0;

        if (Array.isArray(bankDepositsPerfResponse.body?.data) && bankDepositsPerfResponse.body.data.length > 0) {
          const lastDataPoint = bankDepositsPerfResponse.body.data[bankDepositsPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            bankDepositsValueFromPerfChart = rupeeValue;

            console.log(`\nBank Deposits from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          bankDepositsValueFromAllAssets.toString(),
          bankDepositsValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== Bank Deposits from All Assets View - ${testDate} ===
Asset Allocation (All) - Bank Deposits:  ₹${bankDepositsValueFromAllAssets.toLocaleString()}
Performance Chart (Bank Deposits):       ₹${bankDepositsValueFromPerfChart.toLocaleString()}
Difference:                              ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                               ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                                 ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`bank-deposits-all-assets-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        // 7. Assert
        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );
      });
    });
  });

  // Test 2: Bank Deposits from Filtered View
  // Compare Bank Deposits-filtered asset allocation with Bank Deposits-filtered performance chart
  test.describe('Bank Deposits from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Compare Filtered Bank Deposits vs Performance Chart Bank Deposits for ${testDate}`, async ({ apiClient }) => {
        const familyId = process.env.FAMILY_ID;

        console.log(`\n=== Testing Bank Deposits from Filtered View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITH Bank Deposits filter
        const bankDepositsAssetResponse = await apiClient.get(
          dashboardEndpoints.bankDepositsAssetAllocation(familyId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (Bank Deposits Filter) ===');
        console.log(JSON.stringify(bankDepositsAssetResponse.body, null, 2));

        // 2. Extract total value from filtered Asset Allocation
        let bankDepositsValueFromFilteredAssets = 0;

        if (Array.isArray(bankDepositsAssetResponse.body?.data)) {
          // Sum all values (should all be bank deposits)
          bankDepositsAssetResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';

            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            bankDepositsValueFromFilteredAssets += rupeeValue;
          });

          console.log(`\nBank Deposits from Filtered Asset Allocation: ₹${bankDepositsValueFromFilteredAssets.toLocaleString()}`);
        } else if (typeof bankDepositsAssetResponse.body?.data === 'object') {
          // Handle case where data might be a single object
          const asset = bankDepositsAssetResponse.body.data;
          const amount = parseFloat(asset.amount || asset.total || '0') || 0;
          const unit = asset.unit || '';

          let rupeeValue = amount;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = amount * (multipliers[unit] || 1);
          }

          bankDepositsValueFromFilteredAssets = rupeeValue;
          console.log(`\nBank Deposits from Filtered Asset Allocation: ₹${bankDepositsValueFromFilteredAssets.toLocaleString()}`);
        }

        // 3. Call Performance Chart API WITH Bank Deposits filter
        const bankDepositsPerfResponse = await apiClient.get(
          dashboardEndpoints.bankDepositsPerformanceChart(familyId, testDate)
        );

        console.log('\n=== Performance Chart API Response (Bank Deposits Filter) ===');
        console.log(JSON.stringify(bankDepositsPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let bankDepositsValueFromPerfChart = 0;

        if (Array.isArray(bankDepositsPerfResponse.body?.data) && bankDepositsPerfResponse.body.data.length > 0) {
          const lastDataPoint = bankDepositsPerfResponse.body.data[bankDepositsPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            bankDepositsValueFromPerfChart = rupeeValue;

            console.log(`\nBank Deposits from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          bankDepositsValueFromFilteredAssets.toString(),
          bankDepositsValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== Bank Deposits from Filtered View - ${testDate} ===
Asset Allocation (Bank Deposits Filter): ₹${bankDepositsValueFromFilteredAssets.toLocaleString()}
Performance Chart (Bank Deposits Filter):₹${bankDepositsValueFromPerfChart.toLocaleString()}
Difference:                              ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                               ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                                 ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`bank-deposits-filtered-${testDate}.txt`, {
          body: report,
          contentType: 'text/plain'
        });

        // 7. Assert
        expect(comparison.pass).toBe(true);
        expect(comparison.diffPct).toBeLessThanOrEqual(
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );
      });
    });
  });

});