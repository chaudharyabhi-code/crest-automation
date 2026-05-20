import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../../utils/family/testHelpers.js';
import { familyDashboardEndpoints as dashboardEndpoints } from '../../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../../utils/historicalDateHelper.js';
import { extractUnitAndValue, compareValues } from '../../../utils/comparison.js';

test.describe('Asset Allocation NPS Filter Tests (Family)', () => {

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

  // Test 1: NPS from All Assets View
  // Extract NPS value from unfiltered asset allocation and compare with NPS-filtered performance chart
  test.describe('NPS from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`Compare All Assets NPS vs Performance Chart NPS for ${testDate}`, async ({ apiClient }) => {
        const familyId = process.env.FAMILY_ID;

        console.log(`\n=== Testing NPS from All Assets View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITHOUT filter (all assets)
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(familyId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (All Assets) ===');
        console.log(JSON.stringify(allAssetsResponse.body, null, 2));

        // 2. Extract ONLY the NPS value from all assets response
        let npsValueFromAllAssets = 0;

        if (Array.isArray(allAssetsResponse.body?.data)) {
          // Find the NPS entry in the response
          const npsAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase() === 'nps' ||
            asset.name?.toLowerCase().includes('pension') ||
            asset.asset_type?.toLowerCase() === 'nps'
          );

          if (npsAsset) {
            const amount = parseFloat(npsAsset.amount) || 0;
            const unit = npsAsset.unit || '';

            // Convert to base rupee value
            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            npsValueFromAllAssets = rupeeValue;

            console.log(`\nNPS from All Assets: ${amount} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          } else {
            console.log('\nNo NPS found in All Assets response');
          }
        }

        // 3. Call Performance Chart API WITH NPS filter
        const npsPerfResponse = await apiClient.get(
          dashboardEndpoints.npsPerformanceChart(familyId, testDate)
        );

        console.log('\n=== Performance Chart API Response (NPS Filter) ===');
        console.log(JSON.stringify(npsPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let npsValueFromPerfChart = 0;

        if (Array.isArray(npsPerfResponse.body?.data) && npsPerfResponse.body.data.length > 0) {
          const lastDataPoint = npsPerfResponse.body.data[npsPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            npsValueFromPerfChart = rupeeValue;

            console.log(`\nNPS from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          npsValueFromAllAssets.toString(),
          npsValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== NPS from All Assets View - ${testDate} ===
Asset Allocation (All) - NPS:        ₹${npsValueFromAllAssets.toLocaleString()}
Performance Chart (NPS):             ₹${npsValueFromPerfChart.toLocaleString()}
Difference:                          ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                           ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                             ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`nps-all-assets-${testDate}.txt`, {
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

  // Test 2: NPS from Filtered View
  // Compare NPS-filtered asset allocation with NPS-filtered performance chart
  test.describe('NPS from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Compare Filtered NPS vs Performance Chart NPS for ${testDate}`, async ({ apiClient }) => {
        const familyId = process.env.FAMILY_ID;

        console.log(`\n=== Testing NPS from Filtered View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITH NPS filter
        const npsAssetResponse = await apiClient.get(
          dashboardEndpoints.npsAssetAllocation(familyId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (NPS Filter) ===');
        console.log(JSON.stringify(npsAssetResponse.body, null, 2));

        // 2. Extract total value from filtered Asset Allocation
        let npsValueFromFilteredAssets = 0;

        if (Array.isArray(npsAssetResponse.body?.data)) {
          // Sum all values (should all be NPS)
          npsAssetResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';

            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            npsValueFromFilteredAssets += rupeeValue;
          });

          console.log(`\nNPS from Filtered Asset Allocation: ₹${npsValueFromFilteredAssets.toLocaleString()}`);
        } else if (typeof npsAssetResponse.body?.data === 'object') {
          // Handle case where data might be a single object
          const asset = npsAssetResponse.body.data;
          const amount = parseFloat(asset.amount || asset.total || '0') || 0;
          const unit = asset.unit || '';

          let rupeeValue = amount;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = amount * (multipliers[unit] || 1);
          }

          npsValueFromFilteredAssets = rupeeValue;
          console.log(`\nNPS from Filtered Asset Allocation: ₹${npsValueFromFilteredAssets.toLocaleString()}`);
        }

        // 3. Call Performance Chart API WITH NPS filter
        const npsPerfResponse = await apiClient.get(
          dashboardEndpoints.npsPerformanceChart(familyId, testDate)
        );

        console.log('\n=== Performance Chart API Response (NPS Filter) ===');
        console.log(JSON.stringify(npsPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let npsValueFromPerfChart = 0;

        if (Array.isArray(npsPerfResponse.body?.data) && npsPerfResponse.body.data.length > 0) {
          const lastDataPoint = npsPerfResponse.body.data[npsPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            npsValueFromPerfChart = rupeeValue;

            console.log(`\nNPS from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          npsValueFromFilteredAssets.toString(),
          npsValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== NPS from Filtered View - ${testDate} ===
Asset Allocation (NPS Filter):       ₹${npsValueFromFilteredAssets.toLocaleString()}
Performance Chart (NPS Filter):      ₹${npsValueFromPerfChart.toLocaleString()}
Difference:                          ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                           ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                             ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`nps-filtered-${testDate}.txt`, {
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