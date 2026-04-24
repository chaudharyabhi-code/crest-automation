import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';

test.describe('Cash & Equivalent Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Cash & Equivalent Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    // 1. API call using centralized endpoint
    const response = await apiClient.get(dashboardEndpoints.portfolioSummary(userId));

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract API value using generic helper
    const apiCashAndEquivalent = extractApiValue(
      response.body,
      'data.summary',
      item => item.title === 'Cash & Equivalent'
    );

    if (!apiCashAndEquivalent) {
      throw new Error('Cash & Equivalent not found in API response');
    }

    console.log(`\nAPI Cash & Equivalent: ${apiCashAndEquivalent}`);

    // 3. Compare with SQL using generic helper
    const result = await compareApiWithSql({
      apiValue: apiCashAndEquivalent,
      sqlFilePath: 'cash-and-equivalent.sql',
      userId: userId,
      sqlColumn: 'total_cash_and_equivalent',
      testName: 'Cash & Equivalent Verification'
    });

    console.log(result.formattedReport);

    // 4. Attach to HTML report
    test.info().attach('comparison-summary.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 5. Assert
    expect(result.comparison.pass).toBe(true);
  });

});
