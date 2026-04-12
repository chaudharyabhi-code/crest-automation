import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import { getHistoricalDates, validateHistoricalDates } from '../../utils/historicalDateHelper.js';
import { extractUnitAndValue, compareValues } from '../../utils/comparison.js';

test.describe('Asset Allocation Equity Filter Tests', () => {

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

  // Test 1: Equity from All Assets View
  // Extract equity value from unfiltered asset allocation and compare with equity-filtered performance chart
  test.describe('Equity from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`Compare All Assets Equity vs Performance Chart Equity for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Testing Equity from All Assets View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITHOUT filter (all assets)
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (All Assets) ===');
        console.log(JSON.stringify(allAssetsResponse.body, null, 2));

        // 2. Extract ONLY the Equity value from all assets response
        let equityValueFromAllAssets = 0;

        if (Array.isArray(allAssetsResponse.body?.data)) {
          // Find the equity entry in the response
          const equityAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase() === 'equity' ||
            asset.asset_type?.toLowerCase() === 'equity'
          );

          if (equityAsset) {
            const amount = parseFloat(equityAsset.amount) || 0;
            const unit = equityAsset.unit || '';

            // Convert to base rupee value
            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            equityValueFromAllAssets = rupeeValue;

            console.log(`\nEquity from All Assets: ${amount} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          } else {
            console.log('\nNo Equity found in All Assets response');
          }
        }

        // 3. Call Performance Chart API WITH Equity filter
        const equityPerfResponse = await apiClient.get(
          dashboardEndpoints.equityPerformanceChart(userId, testDate)
        );

        console.log('\n=== Performance Chart API Response (Equity Filter) ===');
        console.log(JSON.stringify(equityPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let equityValueFromPerfChart = 0;

        if (Array.isArray(equityPerfResponse.body?.data) && equityPerfResponse.body.data.length > 0) {
          const lastDataPoint = equityPerfResponse.body.data[equityPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            equityValueFromPerfChart = rupeeValue;

            console.log(`\nEquity from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          equityValueFromAllAssets.toString(),
          equityValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== Equity from All Assets View - ${testDate} ===
Asset Allocation (All) - Equity:  ₹${equityValueFromAllAssets.toLocaleString()}
Performance Chart (Equity):        ₹${equityValueFromPerfChart.toLocaleString()}
Difference:                        ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                         ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                           ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`equity-all-assets-${testDate}.txt`, {
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

  // Test 2: Equity from Filtered View
  // Compare equity-filtered asset allocation with equity-filtered performance chart
  test.describe('Equity from Filtered View', () => {
    testDates.forEach(testDate => {
      test(`Compare Filtered Equity vs Performance Chart Equity for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        console.log(`\n=== Testing Equity from Filtered View for Date: ${testDate} ===`);

        // 1. Call Asset Allocation API WITH Equity filter
        const equityAssetResponse = await apiClient.get(
          dashboardEndpoints.equityAssetAllocation(userId, testDate)
        );

        console.log('\n=== Asset Allocation API Response (Equity Filter) ===');
        console.log(JSON.stringify(equityAssetResponse.body, null, 2));

        // 2. Extract total value from filtered Asset Allocation
        let equityValueFromFilteredAssets = 0;

        if (Array.isArray(equityAssetResponse.body?.data)) {
          // Sum all values (should all be equity)
          equityAssetResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';

            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            equityValueFromFilteredAssets += rupeeValue;
          });

          console.log(`\nEquity from Filtered Asset Allocation: ₹${equityValueFromFilteredAssets.toLocaleString()}`);
        } else if (typeof equityAssetResponse.body?.data === 'object') {
          // Handle case where data might be a single object
          const asset = equityAssetResponse.body.data;
          const amount = parseFloat(asset.amount || asset.total || '0') || 0;
          const unit = asset.unit || '';

          let rupeeValue = amount;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = amount * (multipliers[unit] || 1);
          }

          equityValueFromFilteredAssets = rupeeValue;
          console.log(`\nEquity from Filtered Asset Allocation: ₹${equityValueFromFilteredAssets.toLocaleString()}`);
        }

        // 3. Call Performance Chart API WITH Equity filter
        const equityPerfResponse = await apiClient.get(
          dashboardEndpoints.equityPerformanceChart(userId, testDate)
        );

        console.log('\n=== Performance Chart API Response (Equity Filter) ===');
        console.log(JSON.stringify(equityPerfResponse.body, null, 2));

        // 4. Extract the latest value from Performance Chart
        let equityValueFromPerfChart = 0;

        if (Array.isArray(equityPerfResponse.body?.data) && equityPerfResponse.body.data.length > 0) {
          const lastDataPoint = equityPerfResponse.body.data[equityPerfResponse.body.data.length - 1];

          if (lastDataPoint) {
            const totalValue = parseFloat(lastDataPoint.total) || 0;
            const unit = lastDataPoint.unit || '';

            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }

            equityValueFromPerfChart = rupeeValue;

            console.log(`\nEquity from Performance Chart: ${totalValue} ${unit} = ₹${rupeeValue.toLocaleString()}`);
          }
        }

        // 5. Compare the two values
        const comparison = compareValues(
          equityValueFromFilteredAssets.toString(),
          equityValueFromPerfChart,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        const report = `
=== Equity from Filtered View - ${testDate} ===
Asset Allocation (Equity Filter):  ₹${equityValueFromFilteredAssets.toLocaleString()}
Performance Chart (Equity Filter): ₹${equityValueFromPerfChart.toLocaleString()}
Difference:                        ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                         ${process.env.COMPARISON_THRESHOLD_PCT || '0.25'}%
Result:                           ${comparison.message}
`;

        console.log(report);

        // 6. Attach to test report
        test.info().attach(`equity-filtered-${testDate}.txt`, {
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
  test('Equity Filter Tests Summary - All Dates', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const dates = getTestDates();
    const allAssetsResults = [];
    const filteredResults = [];
    let allAssetsAllPassed = true;
    let filteredAllPassed = true;

    console.log('\n=== Equity Filter Tests Summary ===');
    console.log(`Testing ${dates.length} dates: ${dates.join(', ')}`);

    for (const testDate of dates) {
      // Test 1: All Assets View
      try {
        // Get all assets
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );

        let equityFromAll = 0;
        if (Array.isArray(allAssetsResponse.body?.data)) {
          const equityAsset = allAssetsResponse.body.data.find(asset =>
            asset.name?.toLowerCase() === 'equity'
          );
          if (equityAsset) {
            const amount = parseFloat(equityAsset.amount) || 0;
            const unit = equityAsset.unit || '';
            equityFromAll = unit ? amount * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : amount;
          }
        }

        // Get performance chart with equity filter
        const perfResponse = await apiClient.get(
          dashboardEndpoints.equityPerformanceChart(userId, testDate)
        );

        let equityFromPerf = 0;
        if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
          const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
          if (lastPoint) {
            const total = parseFloat(lastPoint.total) || 0;
            const unit = lastPoint.unit || '';
            equityFromPerf = unit ? total * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : total;
          }
        }

        const comparison = compareValues(equityFromAll.toString(), equityFromPerf);

        allAssetsResults.push({
          date: testDate,
          passed: comparison.pass,
          diffPct: comparison.diffPct,
          allAssetsValue: `₹${equityFromAll.toLocaleString()}`,
          perfChartValue: `₹${equityFromPerf.toLocaleString()}`
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
        // Get filtered equity assets
        const filteredResponse = await apiClient.get(
          dashboardEndpoints.equityAssetAllocation(userId, testDate)
        );

        let equityFromFiltered = 0;
        if (Array.isArray(filteredResponse.body?.data)) {
          filteredResponse.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';
            const rupeeValue = unit ? amount * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : amount;
            equityFromFiltered += rupeeValue;
          });
        }

        // Get performance chart with equity filter
        const perfResponse = await apiClient.get(
          dashboardEndpoints.equityPerformanceChart(userId, testDate)
        );

        let equityFromPerf = 0;
        if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
          const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
          if (lastPoint) {
            const total = parseFloat(lastPoint.total) || 0;
            const unit = lastPoint.unit || '';
            equityFromPerf = unit ? total * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : total;
          }
        }

        const comparison = compareValues(equityFromFiltered.toString(), equityFromPerf);

        filteredResults.push({
          date: testDate,
          passed: comparison.pass,
          diffPct: comparison.diffPct,
          filteredValue: `₹${equityFromFiltered.toLocaleString()}`,
          perfChartValue: `₹${equityFromPerf.toLocaleString()}`
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
=== Equity Filter Tests Summary ===
Total Dates Tested: ${dates.length}

=== Test 1: Equity from All Assets View ===
Passed: ${allAssetsResults.filter(r => r.passed).length}/${allAssetsResults.length}
${allAssetsResults.map(r => `
  ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}

=== Test 2: Equity from Filtered View ===
Passed: ${filteredResults.filter(r => r.passed).length}/${filteredResults.length}
${filteredResults.map(r => `
  ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}

Overall Result: ${allAssetsAllPassed && filteredAllPassed ? '✅ All tests passed' : '❌ Some tests failed'}
`;

    console.log(summaryReport);

    // Attach summary to test report
    test.info().attach('equity-filter-summary.txt', {
      body: summaryReport,
      contentType: 'text/plain'
    });

    // Assert both test types passed
    expect(allAssetsAllPassed).toBe(true);
    expect(filteredAllPassed).toBe(true);
  });
});