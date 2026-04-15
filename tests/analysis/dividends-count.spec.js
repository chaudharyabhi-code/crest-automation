import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareDividendsCount } from '../../utils/testHelpers.js';
import { analysisEndpoints } from '../../endpoints/index.js';

test.describe('Analysis Dividends Count Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  // Test: Recent Dividends Count (Last 1 Year)
  test('Recent Dividends Count - Last 1 Year', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing Recent Dividends Count ===');

    // Note: The API doesn't require from_date and to_date parameters
    // The SQL query uses CURRENT_DATE and INTERVAL '1 year' to filter dividends
    // So we call the API without date parameters to get the default behavior
    const response = await apiClient.get(analysisEndpoints.recentDividends(userId));

    console.log('\n=== API Response (Recent Dividends) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // Extract count from API response
    const apiCount = Array.isArray(response.body?.data) ? response.body.data.length : 0;

    console.log(`\nAPI Dividends Count: ${apiCount}`);

    // Compare with SQL
    const result = await compareDividendsCount({
      apiCount: apiCount,
      sqlFilePath: 'recent_dividends_count.sql',
      userId: userId,
      testName: 'Recent Dividends Count'
    });

    console.log(result.formattedReport);

    // Attach to test report
    test.info().attach('recent-dividends-count.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // Assert exact match
    expect(result.match).toBe(true);
    expect(result.diff).toBe(0);
  });
});
