import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';

test.describe('Portfolio Volatility Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Portfolio Volatility Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    // 1. API call using centralized endpoint
    const response = await apiClient.get(dashboardEndpoints.volatility(userId));

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract API value - volatility comes as percentage (e.g., "10.53%")
    const apiVolValue = extractApiValue(
      response.body,
      'data.value'
    );

    if (!apiVolValue) {
      throw new Error('Volatility value not found in API response');
    }

    console.log(`\nAPI Volatility: ${apiVolValue}`);

    // 3. Handle percentage format - remove % sign if present
    // API returns "10.53%" and DB has 10.53 (both represent 10.53%)
    // We remove the % sign to get numeric value for comparison
    const cleanedApiValue = apiVolValue.toString().replace('%', '').trim();

    // 4. Compare with SQL using generic helper
    // Both values are percentages: API "10.53%" becomes 10.53, DB is already 10.53
    // The 0.25% threshold means the difference between these values must be < 0.25
    const result = await compareApiWithSql({
      apiValue: cleanedApiValue,
      sqlFilePath: 'portfolio_volatility_test.sql', // SQL file name from queries/ folder
      userId: userId,
      sqlColumn: 'annualized_volatility_pct',
      testName: 'Portfolio Volatility Verification',
      isPercentage: true  // This tells the helper to use percentage formatting in the report
    });

    console.log(result.formattedReport);

    // 5. Attach to HTML report
    test.info().attach('volatility-comparison.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 6. Also attach additional SQL metrics if needed
    test.info().attach('volatility-details.json', {
      body: JSON.stringify({
        apiResponse: response.body,
        sqlValue: result.sqlValue,
        comparison: result.comparison
      }, null, 2),
      contentType: 'application/json'
    });

    // 7. Assert - test passes if difference < 0.25%
    expect(result.comparison.pass).toBe(true);
  });

});