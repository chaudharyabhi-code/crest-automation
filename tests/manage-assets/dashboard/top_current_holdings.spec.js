import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { compareValues } from '../../../utils/comparison.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';
import fs from 'fs';
import path from 'path';

test.describe('Manage Assets - Top Current Holdings (with Manual Assets)', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Top Current Holdings Value and Percentage Verification (with Manual Assets)', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const threshold = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

    console.log('\n=== Top Current Holdings (with Manual Assets) Test ===');
    console.log(`User ID: ${userId}`);

    // 1. Get top holdings from API
    const topHoldingsResponse = await apiClient.get(
      dashboardEndpoints.topHoldings(userId)
    );

    const apiHoldingsData = topHoldingsResponse.body?.data || [];
    console.log(`\nAPI returned ${apiHoldingsData.length} top holdings`);

    // 2. Get combined top holdings from DB (automated + manual assets)
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'manage-assets', 'top_current_holdings.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const dbResult = await dbClient.query(sqlQuery);
    const dbTopHoldings = dbResult.rows.map(r => ({
      id: parseInt(r.id),
      name: r.holding_name,
      balance: parseFloat(r.current_balance) || 0,
      type: r.holding_type,
      percentage: parseFloat(r.portfolio_percentage) || 0
    }));

    console.log(`DB returned ${dbTopHoldings.length} top holdings (incl. manual assets)`);

    // 3. Compare each holding from API with DB
    const topHoldingsComparison = [];
    let allPassed = true;

    for (const apiHolding of apiHoldingsData) {
      const dbHolding = dbTopHoldings.find(h => h.id === apiHolding.id);

      if (dbHolding) {
        const valueCmp = compareValues(apiHolding.value, dbHolding.balance, threshold);

        const apiPctStr = apiHolding.percentage || '';
        const apiPctNum = parseFloat(apiPctStr.replace(/[^0-9.]/g, '')) || 0;
        const apiPctRounded = Math.round(apiPctNum * 10) / 10;
        const dbPctRounded = Math.round(dbHolding.percentage * 10) / 10;
        const pctCmp = compareValues(apiPctRounded.toString(), dbPctRounded, threshold);

        const namePass = apiHolding.name === dbHolding.name;
        const typePass = apiHolding.type === dbHolding.type;

        const dbValueFormatted = valueCmp.apiUnit
          ? `₹${valueCmp.dbRounded.toFixed(2)} ${valueCmp.apiUnit}`
          : `₹${valueCmp.dbRounded.toFixed(2)}`;

        const holdingResult = {
          id: apiHolding.id,
          name: { api: apiHolding.name, db: dbHolding.name, pass: namePass },
          type: { api: apiHolding.type, db: dbHolding.type, pass: typePass },
          value: {
            api: apiHolding.value,
            db: dbValueFormatted,
            dbRaw: dbHolding.balance,
            dbConverted: valueCmp.dbRounded,
            diffPct: valueCmp.diffPct,
            pass: valueCmp.pass
          },
          percentage: {
            api: apiPctStr,
            apiNumeric: apiPctRounded,
            db: `${dbPctRounded.toFixed(1)}%`,
            dbRaw: dbHolding.percentage,
            diffPct: pctCmp.diffPct,
            pass: pctCmp.pass
          },
          overallPass: namePass && typePass && valueCmp.pass && pctCmp.pass
        };

        topHoldingsComparison.push(holdingResult);
        if (!holdingResult.overallPass) allPassed = false;

      } else {
        topHoldingsComparison.push({
          id: apiHolding.id,
          name: { api: apiHolding.name, db: 'NOT FOUND', pass: false },
          type: { api: apiHolding.type, db: '-', pass: false },
          value: { api: apiHolding.value, db: '-', dbRaw: 0, diffPct: '-', pass: false },
          percentage: { api: apiHolding.percentage, db: '-', dbRaw: 0, diffPct: '-', pass: false },
          overallPass: false
        });
        allPassed = false;
      }
    }

    // Check for DB holdings not in API
    for (const dbHolding of dbTopHoldings) {
      const apiHolding = apiHoldingsData.find(h => h.id === dbHolding.id);
      if (!apiHolding) {
        topHoldingsComparison.push({
          id: dbHolding.id,
          name: { api: 'NOT FOUND', db: dbHolding.name, pass: false },
          type: { api: '-', db: dbHolding.type, pass: false },
          value: { api: '-', db: `₹${dbHolding.balance}`, dbRaw: dbHolding.balance, diffPct: '-', pass: false },
          percentage: { api: '-', db: `${dbHolding.percentage.toFixed(1)}%`, dbRaw: dbHolding.percentage, diffPct: '-', pass: false },
          overallPass: false
        });
        allPassed = false;
      }
    }

    console.log(`\nCompared ${topHoldingsComparison.length} holdings`);

    // 4. Build report
    let detailedReport = `
=== Top Current Holdings Verification (with Manual Assets) ===

API Holdings Count: ${apiHoldingsData.length}
DB Holdings Count (incl. manual): ${dbTopHoldings.length}
Total Compared: ${topHoldingsComparison.length}
Threshold: ${threshold}%

=== Holdings Comparison ===\n`;

    for (const holding of topHoldingsComparison) {
      detailedReport += `
--- Holding ID: ${holding.id} ---
  Name:
    API:  ${holding.name.api}
    DB:   ${holding.name.db}
    Pass: ${holding.name.pass ? '✅' : '❌'}

  Type:
    API:  ${holding.type.api}
    DB:   ${holding.type.db}
    Pass: ${holding.type.pass ? '✅' : '❌'}

  Value:
    API:  ${holding.value.api}
    DB:   ${holding.value.db}
    Diff: ${holding.value.diffPct}%
    Pass: ${holding.value.pass ? '✅' : '❌'}

  Percentage:
    API:  ${holding.percentage.api} (${holding.percentage.apiNumeric}%)
    DB:   ${holding.percentage.db}
    Diff: ${holding.percentage.diffPct}%
    Pass: ${holding.percentage.pass ? '✅' : '❌'}

  Overall: ${holding.overallPass ? '✅ PASS' : '❌ FAIL'}
`;
    }

    detailedReport += `\n=== Summary ===\nAll Holdings Passed: ${allPassed ? '✅ YES' : '❌ NO'}`;

    console.log(detailedReport);

    test.info().attach('top-holdings-manual-report.txt', {
      body: detailedReport,
      contentType: 'text/plain'
    });

    test.info().attach('top-holdings-manual-details.json', {
      body: JSON.stringify({
        userId,
        apiHoldings: apiHoldingsData,
        dbHoldings: dbTopHoldings,
        comparison: topHoldingsComparison,
        summary: {
          apiCount: apiHoldingsData.length,
          dbCount: dbTopHoldings.length,
          comparedCount: topHoldingsComparison.length,
          allPassed
        }
      }, null, 2),
      contentType: 'application/json'
    });

    expect(allPassed).toBe(true);
  });

});
