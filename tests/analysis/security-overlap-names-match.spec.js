import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../endpoints/index.js';

test.describe('Analysis Security Overlap Names Match Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Security Overlap Names Match - API vs SQL', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing Security Overlap Names Match ===');

    // 1. Call API
    const response = await apiClient.get(analysisEndpoints.securitiesOverlap(userId));

    const securities = response.body?.data?.Securities;
    if (!Array.isArray(securities)) {
      throw new Error('data.Securities not found or not an array in API response');
    }

    // 2. Run SQL (returns full rows including security_name)
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'security_overlap_names_match.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const dbResult = await dbClient.query(sqlQuery);
    const dbRows = dbResult.rows || [];

    // 3. Normalize names (trim + uppercase + collapse whitespace) and build sets
    const normalize = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

    const apiNames = securities.map(s => s?.name).filter(Boolean);
    const dbNames = dbRows.map(r => r?.security_name).filter(Boolean);

    const apiSet = new Set(apiNames.map(normalize));
    const dbSet = new Set(dbNames.map(normalize));

    const onlyInApi = [...apiSet].filter(n => !dbSet.has(n)).sort();
    const onlyInDb = [...dbSet].filter(n => !apiSet.has(n)).sort();
    const intersection = [...apiSet].filter(n => dbSet.has(n)).sort();

    const match = onlyInApi.length === 0 && onlyInDb.length === 0 && apiSet.size === dbSet.size;

    const formattedReport = `
=== Security Overlap Names Match - API vs SQL ===
User ID:                ${userId}
API Names (count):      ${apiNames.length}  (unique: ${apiSet.size})
DB Names  (count):      ${dbNames.length}   (unique: ${dbSet.size})
Common Names:           ${intersection.length}
Only in API:            ${onlyInApi.length}${onlyInApi.length ? '\n  - ' + onlyInApi.join('\n  - ') : ''}
Only in DB:             ${onlyInDb.length}${onlyInDb.length ? '\n  - ' + onlyInDb.join('\n  - ') : ''}
Result:                 ${match ? '✅ Names Match' : '❌ Mismatch'}
`;

    console.log(formattedReport);

    test.info().attach('security-overlap-names-match.txt', {
      body: formattedReport,
      contentType: 'text/plain',
    });

    test.info().attach('security-overlap-names-details.json', {
      body: JSON.stringify({
        userId,
        apiNames,
        dbNames,
        onlyInApi,
        onlyInDb,
        intersection,
      }, null, 2),
      contentType: 'application/json',
    });

    expect(onlyInApi).toEqual([]);
    expect(onlyInDb).toEqual([]);
  });

});
