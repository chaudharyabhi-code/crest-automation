import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../utils/historicalDateHelper.js';
import { extractUnitAndValue, compareValues } from '../../utils/comparison.js';

test.describe('Asset Allocation Mutual Fund Filter Tests', () => {

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

  // Test 1: Mutual Fund from All Assets View
  // Extract MF value from unfiltered asset allocation and compare with MF-filtered performance chart
  test.describe('Mutual Fund from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`Compare All Assets MF vs Performance Chart MF for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Testing Mutual Fund from All Assets View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITHOUT filter (all assets)
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (All Assets) ===');
        console.log(JSON.stringify(allAssetsResponse.body, null, 2));

        // 2. Extract ONLY the Mutual Fund value from all assets response
        let mfValueFromAllAssets = 0;

        if (Array.isArray(allAssetsResponse.body?.data)) {
          // Find the mutual fund entry in the response
          const mfAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase().includes('mutual') ||
            asset.name?.toLowerCase() === 'mf' ||
            asset.asset_type?.toLowerCase().includes('mutual')
          );

          if (mfAsset) {
            const amount = parseFloat(mfAsset.amount) || 0;
            const unit = mfAsset.unit || '';

            // Convert to base rupee value
            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            mfValueFromAllAssets = rupeeValue;

            console.log(`\nMutual Fund from All Assets: ${amount} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          } else {
            console.log('\nNo Mutual Fund found in All Assets response');
          }
        }

        // 3. Call Performance Chart API WITH MF filter
        const mfPerfResponse = await apiClient.get(
          dashboardEndpoints.mfPerformanceChart(userId, testDate)
        );

        console.log('\n=== Performance Chart API Response (MF Filter) ===');
        console.log(JSON.stringify(mfPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let mfValueFromPerfChart = 0;

        if (Array.isArray(mfPerfResponse.body?.data) && mfPerfResponse.body.data.length > 0) {
          const lastDataPoint = mfPerfResponse.body.data[mfPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            mfValueFromPerfChart = rupeeValue;

            console.log(`\nMutual Fund from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          mfValueFromAllAssets.toString(),
          mfValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== Mutual Fund from All Assets View - ${testDate} ===
Asset Allocation (All) - MF:      ₹${mfValueFromAllAssets.toLocaleString()}
Performance Chart (MF):           ₹${mfValueFromPerfChart.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                          ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`mf-all-assets-${testDate}.txt`, {
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

  // Test 2: Mutual Fund from Filtered View
  // Compare MF-filtered asset allocation with MF-filtered performance chart
  test.describe('Mutual Fund from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Compare Filtered MF vs Performance Chart MF for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Testing Mutual Fund from Filtered View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITH MF filter
        const mfAssetResponse = await apiClient.get(
          dashboardEndpoints.mfAssetAllocation(userId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (MF Filter) ===');
        console.log(JSON.stringify(mfAssetResponse.body, null, 2));

        // 2. Extract total value from filtered Asset Allocation
        let mfValueFromFilteredAssets = 0;

        if (Array.isArray(mfAssetResponse.body?.data)) {
          // Sum all values (should all be mutual funds)
          mfAssetResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';

            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            mfValueFromFilteredAssets += rupeeValue;
          });

          console.log(`\nMutual Fund from Filtered Asset Allocation: ₹${mfValueFromFilteredAssets.toLocaleString()}`);
        } else if (typeof mfAssetResponse.body?.data === 'object') {
          // Handle case where data might be a single object
          const asset = mfAssetResponse.body.data;
          const amount = parseFloat(asset.amount || asset.total || '0') || 0;
          const unit = asset.unit || '';

          let rupeeValue = amount;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = amount * (multipliers[unit] || 1);
          }

          mfValueFromFilteredAssets = rupeeValue;
          console.log(`\nMutual Fund from Filtered Asset Allocation: ₹${mfValueFromFilteredAssets.toLocaleString()}`);
        }

        // 3. Call Performance Chart API WITH MF filter
        const mfPerfResponse = await apiClient.get(
          dashboardEndpoints.mfPerformanceChart(userId, testDate)
        );

        console.log('\n=== Performance Chart API Response (MF Filter) ===');
        console.log(JSON.stringify(mfPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let mfValueFromPerfChart = 0;

        if (Array.isArray(mfPerfResponse.body?.data) && mfPerfResponse.body.data.length > 0) {
          const lastDataPoint = mfPerfResponse.body.data[mfPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            mfValueFromPerfChart = rupeeValue;

            console.log(`\nMutual Fund from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          mfValueFromFilteredAssets.toString(),
          mfValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== Mutual Fund from Filtered View - ${testDate} ===
Asset Allocation (MF Filter):     ₹${mfValueFromFilteredAssets.toLocaleString()}
Performance Chart (MF Filter):    ₹${mfValueFromPerfChart.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                          ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`mf-filtered-${testDate}.txt`, {
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
  test('Mutual Fund Filter Tests Summary - All Dates', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const dates = getTestDates();
    const allAssetsResults = [];
    const filteredResults = [];
    let allAssetsAllPassed = true;
    let filteredAllPassed = true;

    console.log('\n=== Mutual Fund Filter Tests Summary ===');
    console.log(`Testing ${dates.length} dates: ${dates.join(', ')}`);

    for (const testDate of dates) {
      // Test 1: All Assets View
      try {
        // Get all assets
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );

        let mfFromAll = 0;
        if (Array.isArray(allAssetsResponse.body?.data)) {
          const mfAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase().includes('mutual') || asset.name?.toLowerCase() === 'mf'
          );
          if (mfAsset) {
            const amount = parseFloat(mfAsset.amount) || 0;
            const unit = mfAsset.unit || '';
            mfFromAll = unit ? amount * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : amount;
          }
        }

        // Get performance chart with MF filter
        const perfResponse = await apiClient.get(
          dashboardEndpoints.mfPerformanceChart(userId, testDate)
        );

        let mfFromPerf = 0;
        if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
          const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
          if (lastPoint) {
            const total = parseFloat(lastPoint.total) || 0;
            const unit = lastPoint.unit || '';
            mfFromPerf = unit ? total * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : total;
          }
        }

        const comparison = compareValues(mfFromAll.toString(), mfFromPerf);

        allAssetsResults.push({
          date: testDate,
          passed: comparison.pass,
          diffPct: comparison.diffPct,
          allAssetsValue: `₹${mfFromAll.toLocaleString()}`,
          perfChartValue: `₹${mfFromPerf.toLocaleString()}`
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
        // Get filtered MF assets
        const filteredResponse = await apiClient.get(
          dashboardEndpoints.mfAssetAllocation(userId, testDate)
        );

        let mfFromFiltered = 0;
        if (Array.isArray(filteredResponse.body?.data)) {
          filteredResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';
            const rupeeValue = unit ? amount * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : amount;
            mfFromFiltered += rupeeValue;
          });
        }

        // Get performance chart with MF filter
        const perfResponse = await apiClient.get(
          dashboardEndpoints.mfPerformanceChart(userId, testDate)
        );

        let mfFromPerf = 0;
        if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
          const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
          if (lastPoint) {
            const total = parseFloat(lastPoint.total) || 0;
            const unit = lastPoint.unit || '';
            mfFromPerf = unit ? total * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : total;
          }
        }

        const comparison = compareValues(mfFromFiltered.toString(), mfFromPerf);

        filteredResults.push({
          date: testDate,
          passed: comparison.pass,
          diffPct: comparison.diffPct,
          filteredValue: `₹${mfFromFiltered.toLocaleString()}`,
          perfChartValue: `₹${mfFromPerf.toLocaleString()}`
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
=== Mutual Fund Filter Tests Summary ===
Total Dates Tested: ${dates.length}

=== Test 1: Mutual Fund from All Assets View ===
Passed: ${allAssetsResults.filter(r => r.passed).length}/${allAssetsResults.length}
${allAssetsResults.map(r => `
  ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}

=== Test 2: Mutual Fund from Filtered View ===
Passed: ${filteredResults.filter(r => r.passed).length}/${filteredResults.length}
${filteredResults.map(r => `
  ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}

Overall Result: ${allAssetsAllPassed && filteredAllPassed ? '✅ All tests passed' : '❌ Some tests failed'}
`;

    console.log(summaryReport);

    // Attach summary to test report
    test.info().attach('mf-filter-summary.txt', {
      body: summaryReport,
      contentType: 'text/plain'
    });

    // Assert both test types passed
    expect(allAssetsAllPassed).toBe(true);
    expect(filteredAllPassed).toBe(true);
  });
});