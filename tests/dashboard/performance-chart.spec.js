import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';

test.describe('Performance Chart Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Performance Chart Latest Value Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const entityType = process.env.ENTITY_TYPE || 'asset';

    // Optional parameters from environment or defaults
    const fromDate = process.env.FROM_DATE || '';
    const toDate = process.env.TO_DATE || fromDate;
    const assetClassId = process.env.ASSET_CLASS_ID || '';

    // 1. API call using centralized endpoint with options
    const response = await apiClient.get(
      dashboardEndpoints.performanceChart(userId, {
        fromDate,
        toDate,
        assetClassId,
        entityType
      })
    );

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract the latest value from performance chart data
    let perfChartLatestValue = null;
    let latestPoint = null;

    if (response.body?.data && Array.isArray(response.body.data) && response.body.data.length > 0) {
      // Get the last point in the chart (most recent)
      latestPoint = response.body.data[response.body.data.length - 1];
      const total = latestPoint?.total;
      const unit = latestPoint?.unit;

      if (total !== undefined && unit) {
        // Format the value with unit (e.g., "1234.56 L")
        perfChartLatestValue = `${total} ${unit}`;

        console.log('\n=== Performance Chart Details ===');
        console.log(`Latest Date: ${latestPoint?.date}`);
        console.log(`Latest Total: ₹${total} ${unit}`);
        console.log(`Data Points Count: ${response.body.data.length}`);

        // Show first and last few data points for context
        if (response.body.data.length > 1) {
          console.log('\nFirst data point:', response.body.data[0]);
          console.log('Last data point:', latestPoint);
        }
      } else {
        throw new Error('Total or unit not found in the latest performance chart data point');
      }
    } else {
      throw new Error('Performance chart data not found or empty in API response');
    }

    // 3. Compare with SQL using generic helper
    const result = await compareApiWithSql({
      apiValue: perfChartLatestValue,
      sqlFilePath: 'total_wealth_test.sql', // Using the same SQL for total wealth
      userId: userId,
      sqlColumn: 'grand_total',
      testName: 'Performance Chart Latest Value Verification'
    });

    console.log(result.formattedReport);

    // 4. Attach detailed report to HTML output
    test.info().attach('performance-chart-comparison.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 5. Also attach the chart details
    test.info().attach('performance-chart-details.json', {
      body: JSON.stringify({
        parameters: { userId, fromDate, toDate, assetClassId, entityType },
        latestDataPoint: latestPoint,
        totalDataPoints: response.body.data?.length || 0,
        extractedValue: perfChartLatestValue,
        sqlValue: result.sqlValue,
        comparison: result.comparison
      }, null, 2),
      contentType: 'application/json'
    });

    // 6. Assert - test passes if difference < 0.25%
    expect(result.comparison.pass).toBe(true);
  });

});