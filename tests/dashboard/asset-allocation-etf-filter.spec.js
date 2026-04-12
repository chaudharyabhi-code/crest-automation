import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../utils/historicalDateHelper.js';
import { extractUnitAndValue, compareValues } from '../../utils/comparison.js';

test.describe('Asset Allocation ETF Filter Tests', () => {

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

  // Test 1: ETF from All Assets View
  // Extract ETF value from unfiltered asset allocation and compare with ETF-filtered performance chart
  test.describe('ETF from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`Compare All Assets ETF vs Performance Chart ETF for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Testing ETF from All Assets View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITHOUT filter (all assets)
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (All Assets) ===');
        console.log(JSON.stringify(allAssetsResponse.body, null, 2));

        // 2. Extract ONLY the ETF value from all assets response
        let etfValueFromAllAssets = 0;

        if (Array.isArray(allAssetsResponse.body?.data)) {
          // Find the ETF entry in the response
          const etfAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase() === 'etf' ||
            asset.name?.toLowerCase().includes('etf') ||
            asset.asset_type?.toLowerCase() === 'etf'
          );

          if (etfAsset) {
            const amount = parseFloat(etfAsset.amount) || 0;
            const unit = etfAsset.unit || '';

            // Convert to base rupee value
            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            etfValueFromAllAssets = rupeeValue;

            console.log(`\nETF from All Assets: ${amount} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          } else {
            console.log('\nNo ETF found in All Assets response');
          }
        }

        // 3. Call Performance Chart API WITH ETF filter
        const etfPerfResponse = await apiClient.get(
          dashboardEndpoints.etfPerformanceChart(userId, testDate)
        );

        console.log('\n=== Performance Chart API Response (ETF Filter) ===');
        console.log(JSON.stringify(etfPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let etfValueFromPerfChart = 0;

        if (Array.isArray(etfPerfResponse.body?.data) && etfPerfResponse.body.data.length > 0) {
          const lastDataPoint = etfPerfResponse.body.data[etfPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            etfValueFromPerfChart = rupeeValue;

            console.log(`\nETF from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          etfValueFromAllAssets.toString(),
          etfValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== ETF from All Assets View - ${testDate} ===
Asset Allocation (All) - ETF:     ₹${etfValueFromAllAssets.toLocaleString()}
Performance Chart (ETF):          ₹${etfValueFromPerfChart.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                          ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`etf-all-assets-${testDate}.txt`, {
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

  // Test 2: ETF from Filtered View
  // Compare ETF-filtered asset allocation with ETF-filtered performance chart
  test.describe('ETF from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Compare Filtered ETF vs Performance Chart ETF for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Testing ETF from Filtered View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITH ETF filter
        const etfAssetResponse = await apiClient.get(
          dashboardEndpoints.etfAssetAllocation(userId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (ETF Filter) ===');
        console.log(JSON.stringify(etfAssetResponse.body, null, 2));

        // 2. Extract total value from filtered Asset Allocation
        let etfValueFromFilteredAssets = 0;

        if (Array.isArray(etfAssetResponse.body?.data)) {
          // Sum all values (should all be ETFs)
          etfAssetResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';

            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            etfValueFromFilteredAssets += rupeeValue;
          });

          console.log(`\nETF from Filtered Asset Allocation: ₹${etfValueFromFilteredAssets.toLocaleString()}`);
        } else if (typeof etfAssetResponse.body?.data === 'object') {
          // Handle case where data might be a single object
          const asset = etfAssetResponse.body.data;
          const amount = parseFloat(asset.amount || asset.total || '0') || 0;
          const unit = asset.unit || '';

          let rupeeValue = amount;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = amount * (multipliers[unit] || 1);
          }

          etfValueFromFilteredAssets = rupeeValue;
          console.log(`\nETF from Filtered Asset Allocation: ₹${etfValueFromFilteredAssets.toLocaleString()}`);
        }

        // 3. Call Performance Chart API WITH ETF filter
        const etfPerfResponse = await apiClient.get(
          dashboardEndpoints.etfPerformanceChart(userId, testDate)
        );

        console.log('\n=== Performance Chart API Response (ETF Filter) ===');
        console.log(JSON.stringify(etfPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let etfValueFromPerfChart = 0;

        if (Array.isArray(etfPerfResponse.body?.data) && etfPerfResponse.body.data.length > 0) {
          const lastDataPoint = etfPerfResponse.body.data[etfPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            etfValueFromPerfChart = rupeeValue;

            console.log(`\nETF from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          etfValueFromFilteredAssets.toString(),
          etfValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== ETF from Filtered View - ${testDate} ===
Asset Allocation (ETF Filter):    ₹${etfValueFromFilteredAssets.toLocaleString()}
Performance Chart (ETF Filter):   ₹${etfValueFromPerfChart.toLocaleString()}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                          ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`etf-filtered-${testDate}.txt`, {
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
  test('ETF Filter Tests Summary - All Dates', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const dates = getTestDates();
    const allAssetsResults = [];
    const filteredResults = [];
    let allAssetsAllPassed = true;
    let filteredAllPassed = true;

    console.log('\n=== ETF Filter Tests Summary ===');
    console.log(`Testing ${dates.length} dates: ${dates.join(', ')}`);

    for (const testDate of dates) {
      // Test 1: All Assets View
      try {
        // Get all assets
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );

        let etfFromAll = 0;
        if (Array.isArray(allAssetsResponse.body?.data)) {
          const etfAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase() === 'etf' || asset.name?.toLowerCase().includes('etf')
          );
          if (etfAsset) {
            const amount = parseFloat(etfAsset.amount) || 0;
            const unit = etfAsset.unit || '';
            etfFromAll = unit ? amount * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : amount;
          }
        }

        // Get performance chart with ETF filter
        const perfResponse = await apiClient.get(
          dashboardEndpoints.etfPerformanceChart(userId, testDate)
        );

        let etfFromPerf = 0;
        if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
          const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
          if (lastPoint) {
            const total = parseFloat(lastPoint.total) || 0;
            const unit = lastPoint.unit || '';
            etfFromPerf = unit ? total * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : total;
          }
        }

        const comparison = compareValues(etfFromAll.toString(), etfFromPerf);

        allAssetsResults.push({
          date: testDate,
          passed: comparison.pass,
          diffPct: comparison.diffPct,
          allAssetsValue: `₹${etfFromAll.toLocaleString()}`,
          perfChartValue: `₹${etfFromPerf.toLocaleString()}`
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
        // Get filtered ETF assets
        const filteredResponse = await apiClient.get(
          dashboardEndpoints.etfAssetAllocation(userId, testDate)
        );

        let etfFromFiltered = 0;
        if (Array.isArray(filteredResponse.body?.data)) {
          filteredResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';
            const rupeeValue = unit ? amount * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : amount;
            etfFromFiltered += rupeeValue;
          });
        }

        // Get performance chart with ETF filter
        const perfResponse = await apiClient.get(
          dashboardEndpoints.etfPerformanceChart(userId, testDate)
        );

        let etfFromPerf = 0;
        if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
          const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
          if (lastPoint) {
            const total = parseFloat(lastPoint.total) || 0;
            const unit = lastPoint.unit || '';
            etfFromPerf = unit ? total * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : total;
          }
        }

        const comparison = compareValues(etfFromFiltered.toString(), etfFromPerf);

        filteredResults.push({
          date: testDate,
          passed: comparison.pass,
          diffPct: comparison.diffPct,
          filteredValue: `₹${etfFromFiltered.toLocaleString()}`,
          perfChartValue: `₹${etfFromPerf.toLocaleString()}`
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
=== ETF Filter Tests Summary ===
Total Dates Tested: ${dates.length}

=== Test 1: ETF from All Assets View ===
Passed: ${allAssetsResults.filter(r => r.passed).length}/${allAssetsResults.length}
${allAssetsResults.map(r => `
  ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}

=== Test 2: ETF from Filtered View ===
Passed: ${filteredResults.filter(r => r.passed).length}/${filteredResults.length}
${filteredResults.map(r => `
  ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}

Overall Result: ${allAssetsAllPassed && filteredAllPassed ? '✅ All tests passed' : '❌ Some tests failed'}
`;

    console.log(summaryReport);

    // Attach summary to test report
    test.info().attach('etf-filter-summary.txt', {
      body: summaryReport,
      contentType: 'text/plain'
    });

    // Assert both test types passed
    expect(allAssetsAllPassed).toBe(true);
    expect(filteredAllPassed).toBe(true);
  });
});