import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../utils/historicalDateHelper.js';
import { extractUnitAndValue, compareValues } from '../../utils/comparison.js';

test.describe('Asset Allocation NPS Filter Tests', () => {

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
        const userId = process.env.USER_ID;

        console.log(`\n=== Testing NPS from All Assets View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITHOUT filter (all assets)
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
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
          dashboardEndpoints.npsPerformanceChart(userId, testDate)
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
        const userId = process.env.USER_ID;

        console.log(`\n=== Testing NPS from Filtered View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITH NPS filter
        const npsAssetResponse = await apiClient.get(
          dashboardEndpoints.npsAssetAllocation(userId, testDate)
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
          dashboardEndpoints.npsPerformanceChart(userId, testDate)
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

  // Summary test for all dates and both test types
  test('NPS Filter Tests Summary - All Dates', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const dates = getTestDates();
    const allAssetsResults = [];
    const filteredResults = [];
    let allAssetsAllPassed = true;
    let filteredAllPassed = true;

    console.log('\n=== NPS Filter Tests Summary ===');
    console.log(`Testing ${dates.length} dates: ${dates.join(', ')}`);

    for (const testDate of dates) {
      // Test 1: All Assets View
      try {
        // Get all assets
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );

        let npsFromAll = 0;
        if (Array.isArray(allAssetsResponse.body?.data)) {
          const npsAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase() === 'nps' ||
            asset.name?.toLowerCase().includes('pension')
          );
          if (npsAsset) {
            const amount = parseFloat(npsAsset.amount) || 0;
            const unit = npsAsset.unit || '';
            npsFromAll = unit ? amount * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : amount;
          }
        }

        // Get performance chart with NPS filter
        const perfResponse = await apiClient.get(
          dashboardEndpoints.npsPerformanceChart(userId, testDate)
        );

        let npsFromPerf = 0;
        if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
          const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
          if (lastPoint) {
            const total = parseFloat(lastPoint.total) || 0;
            const unit = lastPoint.unit || '';
            npsFromPerf = unit ? total * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : total;
          }
        }

        const comparison = compareValues(npsFromAll.toString(), npsFromPerf);

        allAssetsResults.push({
          date: testDate,
          passed: comparison.pass,
          diffPct: comparison.diffPct,
          allAssetsValue: `₹${npsFromAll.toLocaleString()}`,
          perfChartValue: `₹${npsFromPerf.toLocaleString()}`
        });

        if (!comparison.pass) {
          allAssetsAllPassed = false;
        }
      } catch (error) {
        allAssetsResults.push({
          date: testDate,
          passed: false,
          error: error.message
        });
        allAssetsAllPassed = false;
      }

      // Test 2: Filtered View
      try {
        // Get filtered NPS assets
        const filteredResponse = await apiClient.get(
          dashboardEndpoints.npsAssetAllocation(userId, testDate)
        );

        let npsFromFiltered = 0;
        if (Array.isArray(filteredResponse.body?.data)) {
          filteredResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';
            const rupeeValue = unit ? amount * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : amount;
            npsFromFiltered += rupeeValue;
          });
        }

        // Get performance chart with NPS filter
        const perfResponse = await apiClient.get(
          dashboardEndpoints.npsPerformanceChart(userId, testDate)
        );

        let npsFromPerf = 0;
        if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
          const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
          if (lastPoint) {
            const total = parseFloat(lastPoint.total) || 0;
            const unit = lastPoint.unit || '';
            npsFromPerf = unit ? total * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : total;
          }
        }

        const comparison = compareValues(npsFromFiltered.toString(), npsFromPerf);

        filteredResults.push({
          date: testDate,
          passed: comparison.pass,
          diffPct: comparison.diffPct,
          filteredValue: `₹${npsFromFiltered.toLocaleString()}`,
          perfChartValue: `₹${npsFromPerf.toLocaleString()}`
        });

        if (!comparison.pass) {
          filteredAllPassed = false;
        }
      } catch (error) {
        filteredResults.push({
          date: testDate,
          passed: false,
          error: error.message
        });
        filteredAllPassed = false;
      }
    }

    // Create summary report
    const summaryReport = `
=== NPS Filter Tests Summary ===
Total Dates Tested: ${dates.length}

=== Test 1: NPS from All Assets View ===
Passed: ${allAssetsResults.filter(r => r.passed).length}/${allAssetsResults.length}
${allAssetsResults.map(r => `
  ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}

=== Test 2: NPS from Filtered View ===
Passed: ${filteredResults.filter(r => r.passed).length}/${filteredResults.length}
${filteredResults.map(r => `
  ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}

Overall Result: ${allAssetsAllPassed && filteredAllPassed ? '✅ All tests passed' : '❌ Some tests failed'}
`;

    console.log(summaryReport);

    // Attach summary to test report
    test.info().attach('nps-filter-summary.txt', {
      body: summaryReport,
      contentType: 'text/plain'
    });

    // Assert both test types passed
    expect(allAssetsAllPassed).toBe(true);
    expect(filteredAllPassed).toBe(true);
  });
});