import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { compareRiskContributors } from '../../../utils/family/testHelpers.js';
import { familyAnalysisEndpoints as analysisEndpoints } from '../../../endpoints/index.js';

test.describe('Analysis Risk and Concentration Tests - ETF Only (Family)', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  // Test: Compare ETF risk contributors between API and SQL
  test('ETF Risk Contributors Comparison - API vs SQL', async ({ apiClient }) => {
    const familyId = process.env.FAMILY_ID;

    console.log('\n=== Testing ETF Risk Contributors Comparison ===');

    // Call the API
    const response = await apiClient.get(analysisEndpoints.etfRiskContributors(familyId));

    console.log('\n=== API Response (ETF Risk Contributors) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // Extract data from API response
    const apiData = response.body?.data?.top_assets || [];

    console.log(`\nTotal ETF Risk Contributors in API: ${apiData.length}`);

    // Compare with SQL - Exact match required (no threshold)
    const result = await compareRiskContributors({
      apiData: apiData,
      sqlFilePath: 'family/risk_concentration_etf.sql',
      familyId: familyId,
      testName: 'ETF Risk Contributors Comparison',
      threshold: 0 // Exact match required
    });

    console.log(result.formattedReport);

    // Attach to test report
    test.info().attach('etf-risk-contributors-comparison.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // Assert all values match within threshold
    expect(result.match).toBe(true);
  });
});
