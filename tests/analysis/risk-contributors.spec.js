import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareRiskContributors } from '../../utils/testHelpers.js';
import { analysisEndpoints } from '../../endpoints/index.js';

test.describe('Analysis Risk and Concentration Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  // Test: Compare risk contributors between API and SQL
  test('Risk Contributors Comparison - API vs SQL', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing Risk Contributors Comparison ===');

    // Call the API
    const response = await apiClient.get(analysisEndpoints.riskContributors(userId));

    console.log('\n=== API Response (Risk Contributors) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // Extract data from API response
    const apiData = response.body?.data?.top_assets || [];

    console.log(`\nTotal Risk Contributors in API: ${apiData.length}`);

    // Compare with SQL - Exact match required (no threshold)
    const result = await compareRiskContributors({
      apiData: apiData,
      sqlFilePath: 'risk_and_concentration_allassets.sql',
      userId: userId,
      testName: 'Risk Contributors Comparison',
      threshold: 0 // Exact match required
    });

    console.log(result.formattedReport);

    // Attach to test report
    test.info().attach('risk-contributors-comparison.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // Assert all values match within threshold
    expect(result.match).toBe(true);
  });
});
