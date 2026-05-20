import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../../utils/family/testHelpers.js';
import { familyDashboardEndpoints as dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { extractUnitAndValue, compareValues } from '../../../utils/comparison.js';

test.describe('Asset Allocation Fixed Deposits Filter Tests (Family)', () => {

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

  // Test 1: Fixed Deposits from All Assets View
  // Extract FD value from unfiltered asset allocation and compare with FD-filtered performance chart
  test.describe('Fixed Deposits from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`Compare All Assets FD vs Performance Chart FD for ${testDate}`, async ({ apiClient }) => {
        const familyId = process.env.FAMILY_ID;

        console.log(`\n=== Testing Fixed Deposits from All Assets View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITHOUT filter (all assets)
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(familyId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (All Assets) ===');
        console.log(JSON.stringify(allAssetsResponse.body, null, 2));

        // 2. Extract ONLY the Fixed Deposits value from all assets response
        let fdValueFromAllAssets = 0;

        if (Array.isArray(allAssetsResponse.body?.data)) {
          // Find the fixed deposits entry in the response
          // Look for various possible names: FD, Fixed Deposits, Term Deposits, Fixed Deposit, etc.
          const fdAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase().includes('fixed') ||
            asset.name?.toLowerCase() === 'fd' ||
            asset.name?.toLowerCase().includes('term deposit') ||
            asset.asset_type?.toLowerCase().includes('fixed')
          );

          if (fdAsset) {
            const amount = parseFloat(fdAsset.amount) || 0;
            const unit = fdAsset.unit || '';

            // Convert to base rupee value
            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            fdValueFromAllAssets = rupeeValue;

            console.log(`\nFixed Deposits from All Assets: ${amount} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          } else {
            console.log('\nNo Fixed Deposits found in All Assets response');
          }
        }

        // 3. Call Performance Chart API WITH FD filter
        const fdPerfResponse = await apiClient.get(
          dashboardEndpoints.fdPerformanceChart(familyId, testDate)
        );

        console.log('\n=== Performance Chart API Response (FD Filter) ===');
        console.log(JSON.stringify(fdPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let fdValueFromPerfChart = 0;

        if (Array.isArray(fdPerfResponse.body?.data) && fdPerfResponse.body.data.length > 0) {
          const lastDataPoint = fdPerfResponse.body.data[fdPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            fdValueFromPerfChart = rupeeValue;

            console.log(`\nFixed Deposits from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          fdValueFromAllAssets.toString(),
          fdValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== Fixed Deposits from All Assets View - ${testDate} ===
Asset Allocation (All) - FD:          ₹${fdValueFromAllAssets.toLocaleString()}
Performance Chart (FD):               ₹${fdValueFromPerfChart.toLocaleString()}
Difference:                           ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                            ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                              ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`fd-all-assets-${testDate}.txt`, {
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

  // Test 2: Fixed Deposits from Filtered View
  // Compare FD-filtered asset allocation with FD-filtered performance chart
  test.describe('Fixed Deposits from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Compare Filtered FD vs Performance Chart FD for ${testDate}`, async ({ apiClient }) => {
        const familyId = process.env.FAMILY_ID;

        console.log(`\n=== Testing Fixed Deposits from Filtered View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITH FD filter
        const fdAssetResponse = await apiClient.get(
          dashboardEndpoints.fdAssetAllocation(familyId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (FD Filter) ===');
        console.log(JSON.stringify(fdAssetResponse.body, null, 2));

        // 2. Extract total value from filtered Asset Allocation
        let fdValueFromFilteredAssets = 0;

        if (Array.isArray(fdAssetResponse.body?.data)) {
          // Sum all values (should all be fixed deposits)
          fdAssetResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';

            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            fdValueFromFilteredAssets += rupeeValue;
          });

          console.log(`\nFixed Deposits from Filtered Asset Allocation: ₹${fdValueFromFilteredAssets.toLocaleString()}`);
        } else if (typeof fdAssetResponse.body?.data === 'object') {
          // Handle case where data might be a single object
          const asset = fdAssetResponse.body.data;
          const amount = parseFloat(asset.amount || asset.total || '0') || 0;
          const unit = asset.unit || '';

          let rupeeValue = amount;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = amount * (multipliers[unit] || 1);
          }

          fdValueFromFilteredAssets = rupeeValue;
          console.log(`\nFixed Deposits from Filtered Asset Allocation: ₹${fdValueFromFilteredAssets.toLocaleString()}`);
        }

        // 3. Call Performance Chart API WITH FD filter
        const fdPerfResponse = await apiClient.get(
          dashboardEndpoints.fdPerformanceChart(familyId, testDate)
        );

        console.log('\n=== Performance Chart API Response (FD Filter) ===');
        console.log(JSON.stringify(fdPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let fdValueFromPerfChart = 0;

        if (Array.isArray(fdPerfResponse.body?.data) && fdPerfResponse.body.data.length > 0) {
          const lastDataPoint = fdPerfResponse.body.data[fdPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            fdValueFromPerfChart = rupeeValue;

            console.log(`\nFixed Deposits from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          fdValueFromFilteredAssets.toString(),
          fdValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== Fixed Deposits from Filtered View - ${testDate} ===
Asset Allocation (FD Filter):         ₹${fdValueFromFilteredAssets.toLocaleString()}
Performance Chart (FD Filter):        ₹${fdValueFromPerfChart.toLocaleString()}
Difference:                           ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                            ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                              ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`fd-filtered-${testDate}.txt`, {
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