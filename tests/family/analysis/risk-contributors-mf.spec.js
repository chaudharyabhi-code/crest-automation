import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { compareRiskContributors } from '../../../utils/family/testHelpers.js';
import { familyAnalysisEndpoints as analysisEndpoints } from '../../../endpoints/index.js';

test.describe('Analysis Risk and Concentration Tests - Mutual Funds Only (Family)', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  // Test: Compare mutual funds risk contributors between API and SQL
  test('Mutual Funds Risk Contributors Comparison - API vs SQL', async ({ apiClient }) => {
    const familyId = process.env.FAMILY_ID;

    console.log('\n=== Testing Mutual Funds Risk Contributors Comparison ===');

    // Call the API
    const response = await apiClient.get(analysisEndpoints.mfRiskContributors(familyId));

    console.log('\n=== API Response (MF Risk Contributors) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // Extract data from API response
    const apiData = response.body?.data?.top_assets || [];

    console.log(`\nTotal MF Risk Contributors in API: ${apiData.length}`);

    // Compare with SQL
    const result = await compareRiskContributors({
      apiData: apiData,
      sqlFilePath: 'family/risk_concentration_mf.sql',
      familyId: familyId,
      testName: 'Mutual Funds Risk Contributors Comparison',
      threshold: 0.25
    });

    console.log(result.formattedReport);

    // Attach to test report
    test.info().attach('mf-risk-contributors-comparison.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // Assert all values match within threshold
    expect(result.match).toBe(true);
  });
});
