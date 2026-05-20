import fs from 'fs';
import path from 'path';
import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { familyAnalysisEndpoints as analysisEndpoints } from '../../../endpoints/index.js';

test.describe('Analysis Security Overlap Count Tests (Family)', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Security Overlap Count - API vs SQL', async ({ apiClient }) => {
    const familyId = process.env.FAMILY_ID;

    console.log('\n=== Testing Security Overlap Count ===');

    // 1. Call API
    const response = await apiClient.get(analysisEndpoints.securitiesOverlap(familyId));

    console.log('\n=== API Response (Securities Overlap) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Count Securities array length
    const securities = response.body?.data?.Securities;
    if (!Array.isArray(securities)) {
      throw new Error('data.Securities not found or not an array in API response');
    }
    const apiCount = securities.length;
    console.log(`\nAPI Securities Count: ${apiCount}`);

    // 3. Run SQL
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'family', 'security_overlap_count.sql'),
      'utf-8'
    ).replace(/{FAMILY_ID}/g, familyId);

    const dbResult = await dbClient.query(sqlQuery);
    const sqlCount = parseInt(dbResult.rows[0]?.total_securities_count, 10) || 0;
    console.log(`DB Securities Count:  ${sqlCount}`);

    // 4. Compare (exact match)
    const match = apiCount === sqlCount;
    const diff = apiCount - sqlCount;

    const formattedReport = `
=== Security Overlap Count - API vs SQL ===
User ID:                ${familyId}
API Securities Count:   ${apiCount}
DB Securities Count:    ${sqlCount}
Difference:             ${diff}
Result:                 ${match ? '✅ Exact Match' : '❌ Mismatch'}
`;

    console.log(formattedReport);

    test.info().attach('security-overlap-count.txt', {
      body: formattedReport,
      contentType: 'text/plain',
    });

    expect(match).toBe(true);
    expect(diff).toBe(0);
  });

});
