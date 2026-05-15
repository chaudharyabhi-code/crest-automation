import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import fs from 'fs';
import path from 'path';

test.describe('Manage Assets - Risk Concentration Mutual Funds (automated + manual)', () => {

  test.beforeAll(async () => { await dbClient.init(); });
  test.afterAll(async () => { await dbClient.close(); });

  test('Risk Concentration - Mutual Funds (automated + manual)', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const assetClassId = process.env.ASSET_CLASS_ID_MUTUAL_FUNDS || '21';
    const threshold = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

    console.log('\n=== Risk Concentration - Mutual Funds (automated + manual) ===');

    const response = await apiClient.get(
      `/api/v1/analysis/risk/contributors?asset_class_id=${assetClassId}&entity_type=asset&member_user_id=${userId}`
    );
    const apiData = response.body?.data?.top_assets || [];
    console.log(`API returned ${apiData.length} contributors`);

    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'manage-assets', 'risk_concentration-mf.sql'), 'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const dbResult = await dbClient.query(sqlQuery);
    const dbRows = dbResult.rows.map(r => ({ name: r.name, percentage: parseFloat(r.percentage) || 0 }));
    console.log(`DB returned ${dbRows.length} contributors`);

    const dbMap = {};
    dbRows.forEach(r => { dbMap[r.name] = r; });

    const comparisons = [];
    let allPassed = true;

    for (const apiItem of apiData) {
      const dbItem = dbMap[apiItem.name];
      if (!dbItem) {
        comparisons.push({ name: apiItem.name, apiPct: apiItem.percentage, dbPct: 'NOT FOUND', diff: '-', pass: false });
        allPassed = false;
        continue;
      }
      const apiPct = parseFloat(apiItem.percentage) || 0;
      const diff = Math.abs(apiPct - dbItem.percentage);
      const pass = diff <= threshold;
      comparisons.push({ name: apiItem.name, apiPct: apiPct.toFixed(2), dbPct: dbItem.percentage.toFixed(2), diff: diff.toFixed(2), pass });
      if (!pass) allPassed = false;
    }

    const dbOnlyItems = dbRows.filter(d => !apiData.find(a => a.name === d.name));

    let report = `
=== Risk Concentration - Mutual Funds (automated + manual) ===
Asset Class ID: ${assetClassId}
API Contributors: ${apiData.length}
DB Contributors:  ${dbRows.length}
Threshold: ${threshold}%

=== Comparison ===\n`;

    for (const c of comparisons) {
      report += `\n  ${c.name}\n    API:  ${c.apiPct}%\n    DB:   ${c.dbPct}%\n    Diff: ${c.diff}%\n    Pass: ${c.pass ? '✅' : '❌'}\n`;
    }

    if (dbOnlyItems.length > 0) {
      report += `\n=== DB Only (informational) ===\n`;
      dbOnlyItems.forEach(d => { report += `  ${d.name}: ${d.percentage.toFixed(2)}% (not returned by API)\n`; });
    }

    report += `\n=== Summary ===\nAll Passed: ${allPassed ? '✅ YES' : '❌ NO'}`;
    console.log(report);

    test.info().attach('risk-concentration-mf-manual.txt', { body: report, contentType: 'text/plain' });
    test.info().attach('risk-concentration-mf-manual.json', {
      body: JSON.stringify({ userId, assetClassId, apiData, dbRows, comparisons }, null, 2),
      contentType: 'application/json'
    });

    expect(allPassed).toBe(true);
  });

});
