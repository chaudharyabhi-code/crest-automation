import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../../endpoints/index.js';
import fs from 'fs';
import path from 'path';

test.describe('Manage Assets - Risk & Concentration All Assets (with Manual Assets)', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Risk Contributors Comparison - API vs Combined SQL (automated + manual)', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const threshold = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

    console.log('\n=== Risk & Concentration All Assets (with Manual Assets) ===');

    // 1. Call API
    const response = await apiClient.get(analysisEndpoints.riskContributors(userId));
    const apiData = response.body?.data?.top_assets || [];
    console.log(`API returned ${apiData.length} risk contributors`);

    // 2. Run combined SQL (automated + manual assets)
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'manage-assets', 'risk_concentration-all-assets.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const dbResult = await dbClient.query(sqlQuery);
    const dbRows = dbResult.rows.map(r => ({
      name: r.name,
      percentage: parseFloat(r.percentage) || 0,
      asset_type: r.asset_type
    }));
    console.log(`DB returned ${dbRows.length} risk contributors (incl. manual assets)`);

    // 3. Compare
    const dbMap = {};
    dbRows.forEach(r => { dbMap[r.name] = r; });

    const comparisons = [];
    let allPassed = true;

    for (const apiItem of apiData) {
      const dbItem = dbMap[apiItem.name];

      if (!dbItem) {
        comparisons.push({ name: apiItem.name, apiPct: apiItem.percentage, dbPct: 'NOT FOUND', diff: '-', asset_type: '-', pass: false });
        allPassed = false;
        continue;
      }

      const apiPct = parseFloat(apiItem.percentage) || 0;
      const diff = Math.abs(apiPct - dbItem.percentage);
      const pass = diff <= threshold;

      comparisons.push({
        name: apiItem.name,
        apiPct: apiPct.toFixed(2),
        dbPct: dbItem.percentage.toFixed(2),
        diff: diff.toFixed(2),
        asset_type: dbItem.asset_type,
        pass
      });

      if (!pass) allPassed = false;
    }

    for (const dbItem of dbRows) {
      if (!apiData.find(a => a.name === dbItem.name)) {
        comparisons.push({ name: dbItem.name, apiPct: 'NOT FOUND', dbPct: dbItem.percentage.toFixed(2), diff: '-', asset_type: dbItem.asset_type, pass: false });
        allPassed = false;
      }
    }

    // 4. Build report
    let report = `
=== Risk & Concentration All Assets (with Manual Assets) ===

API Contributors: ${apiData.length}
DB Contributors (incl. manual): ${dbRows.length}
Threshold: ${threshold}%

=== Comparison ===\n`;

    for (const c of comparisons) {
      report += `
  ${c.name} [${c.asset_type}]
    API:  ${c.apiPct}%
    DB:   ${c.dbPct}%
    Diff: ${c.diff}%
    Pass: ${c.pass ? '✅' : '❌'}
`;
    }

    report += `\n=== Summary ===\nAll Passed: ${allPassed ? '✅ YES' : '❌ NO'}`;

    console.log(report);

    test.info().attach('risk-concentration-all-assets-manual.txt', {
      body: report,
      contentType: 'text/plain'
    });

    test.info().attach('risk-concentration-all-assets-manual.json', {
      body: JSON.stringify({ userId, apiData, dbRows, comparisons, summary: { apiCount: apiData.length, dbCount: dbRows.length, allPassed } }, null, 2),
      contentType: 'application/json'
    });

    expect(allPassed).toBe(true);
  });

});
