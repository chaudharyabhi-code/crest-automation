import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import { getHistoricalDates, createHistoricalSummaryReport, validateHistoricalDates } from '../../utils/historicalDateHelper.js';
import { extractUnitAndValue } from '../../utils/comparison.js';

test.describe('Historical Performance Chart Verification Tests', () => {

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

  // Run test for each historical date
  const historicalDates = getHistoricalDates();

  historicalDates.forEach(testDate => {
    test(`Historical Performance Chart for ${testDate}`, async ({ apiClient }) => {
      const userId = process.env.USER_ID;

      console.log(`\n=== Testing Historical Performance Chart for Date: ${testDate} ===`);

      // 1. API call for historical performance chart
      const response = await apiClient.get(
        dashboardEndpoints.historicalPerformanceChart(userId, testDate)
      );

      console.log('\n=== API Response ===');
      console.log(`Date: ${testDate}`);
      console.log(JSON.stringify(response.body, null, 2));

      // 2. Extract LATEST (last) value from performance chart API response
      let apiTotalWealth;
      let performanceMetrics = {};

      // Check if data is directly an array (as seen in actual response)
      if (Array.isArray(response.body?.data) && response.body.data.length > 0) {
        // Get the LAST (most recent) data point from the chart
        const lastDataPoint = response.body.data[response.body.data.length - 1];

        if (lastDataPoint) {
          // Extract wealth value from the last data point
          // The API returns total and unit separately
          const totalValue = parseFloat(lastDataPoint.total) || 0;
          const unit = lastDataPoint.unit || '';

          // Convert to base rupee value
          let rupeeValue = totalValue;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = totalValue * (multipliers[unit] || 1);
          }

          apiTotalWealth = rupeeValue;

          // Extract performance metrics if available
          performanceMetrics.date = lastDataPoint.date;
          performanceMetrics.day = lastDataPoint.day;
          performanceMetrics.originalValue = `${totalValue} ${unit}`;

          console.log(`\n=== Using LAST data point from chart ===`);
          console.log(`Chart Date: ${performanceMetrics.date} (${performanceMetrics.day})`);
          console.log(`Chart Value: ${performanceMetrics.originalValue} = ₹${rupeeValue.toLocaleString()}`);
        }
      } else if (response.body?.data?.chart_data) {
        const chartData = response.body.data.chart_data;
        if (Array.isArray(chartData) && chartData.length > 0) {
          // Get the LAST (most recent) data point from the chart
          const lastDataPoint = chartData[chartData.length - 1];

          if (lastDataPoint) {
            // Extract wealth value from the last data point
            apiTotalWealth = lastDataPoint.total_wealth ||
                           lastDataPoint.value ||
                           lastDataPoint.y ||
                           lastDataPoint.wealth ||
                           lastDataPoint.portfolio_value;

            // Extract performance metrics if available
            performanceMetrics.returns = lastDataPoint.returns;
            performanceMetrics.percentage = lastDataPoint.returns_percentage;
            performanceMetrics.date = lastDataPoint.date || lastDataPoint.x || lastDataPoint.time;

            console.log(`\n=== Using LAST data point from chart ===`);
            console.log(`Chart Date: ${performanceMetrics.date || 'unknown'}`);
            console.log(`Chart Value: ${apiTotalWealth}`);
          }
        }
      } else if (response.body?.data?.performance) {
        // Direct performance object
        const perf = response.body.data.performance;
        apiTotalWealth = perf.total_wealth || perf.current_value || perf.value;
        performanceMetrics.returns = perf.returns || perf.total_returns;
        performanceMetrics.percentage = perf.returns_percentage || perf.returns_pct;
      } else if (response.body?.data?.summary) {
        // Summary array structure
        apiTotalWealth = extractApiValue(
          response.body,
          'data.summary',
          item => item.title === 'Total Wealth' ||
                 item.title === 'Current Value' ||
                 item.title === 'Portfolio Value'
        );
      } else if (response.body?.data?.total_wealth) {
        // Direct total_wealth field
        apiTotalWealth = response.body.data.total_wealth;
      } else if (response.body?.data?.total) {
        // Direct total field
        apiTotalWealth = response.body.data.total;
      }

      if (apiTotalWealth === undefined || apiTotalWealth === null) {
        console.error('Could not extract total wealth from API response structure:',
          JSON.stringify(response.body, null, 2));
        throw new Error(`Total wealth value not found in Performance Chart API response for date ${testDate}`);
      }

      console.log(`\nAPI Total Wealth for ${testDate}: ${apiTotalWealth}`);
      if (performanceMetrics.returns) {
        console.log(`Performance Returns: ${performanceMetrics.returns}`);
      }
      if (performanceMetrics.percentage) {
        console.log(`Returns Percentage: ${performanceMetrics.percentage}%`);
      }

      // 3. Compare with SQL using historical_allocation_test.sql (grand_total)
      const result = await compareApiWithSql({
        apiValue: apiTotalWealth.toString(),
        sqlFilePath: 'historical_allocation_test.sql',
        userId: userId,
        sqlColumn: 'grand_total',
        testName: `Historical Performance Chart - ${testDate}`,
        endDate: testDate  // Pass the historical date for SQL replacement
      });

      // Add performance metrics to the report if available
      if (performanceMetrics.returns || performanceMetrics.percentage) {
        result.formattedReport += `\n\n=== Performance Metrics ===`;
        if (performanceMetrics.returns) {
          result.formattedReport += `\nAPI Returns: ${performanceMetrics.returns}`;
        }
        if (performanceMetrics.percentage) {
          result.formattedReport += `\nAPI Returns %: ${performanceMetrics.percentage}%`;
        }
      }

      console.log(result.formattedReport);

      // 4. Attach comparison details to test report
      test.info().attach(`historical-performance-${testDate}.txt`, {
        body: `Historical Date: ${testDate}\n${result.formattedReport}`,
        contentType: 'text/plain'
      });

      // 5. Attach API response for debugging
      test.info().attach(`api-response-performance-${testDate}.json`, {
        body: JSON.stringify(response.body, null, 2),
        contentType: 'application/json'
      });

      // 6. Assert test passes if difference is within threshold
      expect(result.comparison.pass).toBe(true);

      // Additional validation
      expect(result.comparison.diffPct).toBeLessThanOrEqual(
        parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
      );

      // Optionally validate returns percentage if available from both API and DB
      if (performanceMetrics.percentage && result.sqlValue?.returns_percentage) {
        const returnsDiff = Math.abs(
          parseFloat(performanceMetrics.percentage) -
          parseFloat(result.sqlValue.returns_percentage)
        );
        console.log(`Returns % Difference: ${returnsDiff.toFixed(2)}%`);

        // Returns percentage can have higher variance, using 1% threshold
        expect(returnsDiff).toBeLessThanOrEqual(1.0);
      }
    });
  });

  // Summary test to validate all dates at once
  test('Historical Performance Chart Summary - All Dates', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const dates = getHistoricalDates();
    const results = [];
    let allPassed = true;

    console.log('\n=== Historical Performance Chart Summary Test ===');
    console.log(`Testing ${dates.length} historical dates: ${dates.join(', ')}`);

    for (const testDate of dates) {
      try {
        // Call API for this date
        const response = await apiClient.get(
          dashboardEndpoints.historicalPerformanceChart(userId, testDate)
        );

        // Extract value using the same logic as individual tests
        let apiValue = 0;

        // Check if data is directly an array
        if (Array.isArray(response.body?.data) && response.body.data.length > 0) {
          const lastPoint = response.body.data[response.body.data.length - 1];
          if (lastPoint) {
            const totalValue = parseFloat(lastPoint.total) || 0;
            const unit = lastPoint.unit || '';

            // Convert to base rupee value
            let rupeeValue = totalValue;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = totalValue * (multipliers[unit] || 1);
            }
            apiValue = rupeeValue;
          }
        } else if (response.body?.data?.chart_data && Array.isArray(response.body.data.chart_data)) {
          const lastPoint = response.body.data.chart_data[response.body.data.chart_data.length - 1];
          apiValue = lastPoint?.total_wealth || lastPoint?.value || lastPoint?.y || 0;
        }

        // Fallback to other structures
        if (!apiValue) {
          apiValue = response.body?.data?.total ||
                    response.body?.data?.total_wealth ||
                    response.body?.data?.performance?.total_wealth ||
                    0;
        }

        // Compare with SQL using historical_allocation_test.sql
        const result = await compareApiWithSql({
          apiValue: apiValue.toString(),
          sqlFilePath: 'historical_allocation_test.sql',
          userId: userId,
          sqlColumn: 'grand_total',
          testName: `Date: ${testDate}`,
          endDate: testDate  // Pass the historical date for SQL replacement
        });

        results.push({
          date: testDate,
          passed: result.comparison.pass,
          diffPct: result.comparison.diffPct,
          apiValue: result.apiValue,
          dbValue: result.dbRoundedFormatted
        });

        if (!result.comparison.pass) {
          allPassed = false;
        }

      } catch (error) {
        results.push({
          date: testDate,
          passed: false,
          error: error.message
        });
        allPassed = false;
      }
    }

    // Create summary report using the helper function
    const summaryReport = createHistoricalSummaryReport('Historical Performance Chart', results);
    console.log(summaryReport);

    // Attach summary to test report
    test.info().attach('historical-performance-summary.txt', {
      body: summaryReport,
      contentType: 'text/plain'
    });

    // Assert all dates passed
    expect(allPassed).toBe(true);
  });

});