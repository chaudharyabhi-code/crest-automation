import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../utils/historicalDateHelper.js';
import { extractUnitAndValue, compareValues } from '../../utils/comparison.js';

test.describe('Asset Allocation Recurring Deposits Filter Tests', () => {

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

  // Test 1: Recurring Deposits from All Assets View
  // Extract RD value from unfiltered asset allocation and compare with RD-filtered performance chart
  test.describe('Recurring Deposits from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`Compare All Assets RD vs Performance Chart RD for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Testing Recurring Deposits from All Assets View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITHOUT filter (all assets)
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (All Assets) ===');
        console.log(JSON.stringify(allAssetsResponse.body, null, 2));

        // 2. Extract ONLY the Recurring Deposits value from all assets response
        let rdValueFromAllAssets = 0;

        if (Array.isArray(allAssetsResponse.body?.data)) {
          // Find the recurring deposits entry in the response
          // Look for various possible names: RD, Recurring Deposits, Recurring Deposit, etc.
          const rdAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase().includes('recurring') ||
            asset.name?.toLowerCase() === 'rd' ||
            asset.asset_type?.toLowerCase().includes('recurring')
          );

          if (rdAsset) {
            const amount = parseFloat(rdAsset.amount) || 0;
            const unit = rdAsset.unit || '';

            // Convert to base rupee value
            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            rdValueFromAllAssets = rupeeValue;

            console.log(`\nRecurring Deposits from All Assets: ${amount} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          } else {
            console.log('\nNo Recurring Deposits found in All Assets response');
          }
        }

        // 3. Call Performance Chart API WITH RD filter
        const rdPerfResponse = await apiClient.get(
          dashboardEndpoints.rdPerformanceChart(userId, testDate)
        );

        console.log('\n=== Performance Chart API Response (RD Filter) ===');
        console.log(JSON.stringify(rdPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let rdValueFromPerfChart = 0;

        if (Array.isArray(rdPerfResponse.body?.data) && rdPerfResponse.body.data.length > 0) {
          const lastDataPoint = rdPerfResponse.body.data[rdPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            rdValueFromPerfChart = rupeeValue;

            console.log(`\nRecurring Deposits from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          rdValueFromAllAssets.toString(),
          rdValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== Recurring Deposits from All Assets View - ${testDate} ===
Asset Allocation (All) - RD:          ₹${rdValueFromAllAssets.toLocaleString()}
Performance Chart (RD):               ₹${rdValueFromPerfChart.toLocaleString()}
Difference:                           ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                            ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                              ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`rd-all-assets-${testDate}.txt`, {
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

  // Test 2: Recurring Deposits from Filtered View
  // Compare RD-filtered asset allocation with RD-filtered performance chart
  test.describe('Recurring Deposits from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Compare Filtered RD vs Performance Chart RD for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Testing Recurring Deposits from Filtered View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITH RD filter
        const rdAssetResponse = await apiClient.get(
          dashboardEndpoints.rdAssetAllocation(userId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (RD Filter) ===');
        console.log(JSON.stringify(rdAssetResponse.body, null, 2));

        // 2. Extract total value from filtered Asset Allocation
        let rdValueFromFilteredAssets = 0;

        if (Array.isArray(rdAssetResponse.body?.data)) {
          // Sum all values (should all be recurring deposits)
          rdAssetResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';

            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            rdValueFromFilteredAssets += rupeeValue;
          });

          console.log(`\nRecurring Deposits from Filtered Asset Allocation: ₹${rdValueFromFilteredAssets.toLocaleString()}`);
        } else if (typeof rdAssetResponse.body?.data === 'object') {
          // Handle case where data might be a single object
          const asset = rdAssetResponse.body.data;
          const amount = parseFloat(asset.amount || asset.total || '0') || 0;
          const unit = asset.unit || '';

          let rupeeValue = amount;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = amount * (multipliers[unit] || 1);
          }

          rdValueFromFilteredAssets = rupeeValue;
          console.log(`\nRecurring Deposits from Filtered Asset Allocation: ₹${rdValueFromFilteredAssets.toLocaleString()}`);
        }

        // 3. Call Performance Chart API WITH RD filter
        const rdPerfResponse = await apiClient.get(
          dashboardEndpoints.rdPerformanceChart(userId, testDate)
        );

        console.log('\n=== Performance Chart API Response (RD Filter) ===');
        console.log(JSON.stringify(rdPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let rdValueFromPerfChart = 0;

        if (Array.isArray(rdPerfResponse.body?.data) && rdPerfResponse.body.data.length > 0) {
          const lastDataPoint = rdPerfResponse.body.data[rdPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            rdValueFromPerfChart = rupeeValue;

            console.log(`\nRecurring Deposits from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          rdValueFromFilteredAssets.toString(),
          rdValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== Recurring Deposits from Filtered View - ${testDate} ===
Asset Allocation (RD Filter):         ₹${rdValueFromFilteredAssets.toLocaleString()}
Performance Chart (RD Filter):        ₹${rdValueFromPerfChart.toLocaleString()}
Difference:                           ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                            ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                              ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`rd-filtered-${testDate}.txt`, {
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