import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { extractApiValue } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import fs from 'fs';
import path from 'path';

test.describe('Holdings Count Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Holdings Count Verification - Equity, MF, ETF', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    // 1. API call using centralized endpoint
    const response = await apiClient.get(dashboardEndpoints.portfolioSummary(userId));

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract holdings counts from portfolio summary
    const summary = response.body?.data?.summary || [];
    const apiFind = (title) => {
      const item = summary.find(s => s.title === title);
      return item?.value || null;
    };

    // Parse API values to numbers (they might come as strings)
    const apiEquityCountRaw = apiFind('Equity Holdings');
    const apiMfCountRaw = apiFind('MF Holdings');
    const apiEtfCountRaw = apiFind('ETF Holdings');

    const apiEquityCount = apiEquityCountRaw !== null ? parseInt(apiEquityCountRaw) : 0;
    const apiMfCount = apiMfCountRaw !== null ? parseInt(apiMfCountRaw) : 0;
    const apiEtfCount = apiEtfCountRaw !== null ? parseInt(apiEtfCountRaw) : 0;

    console.log('\n=== API Holdings Counts ===');
    console.log(`Equity Holdings: ${apiEquityCount} (raw: ${apiEquityCountRaw}, type: ${typeof apiEquityCountRaw})`);
    console.log(`MF Holdings: ${apiMfCount} (raw: ${apiMfCountRaw}, type: ${typeof apiMfCountRaw})`);
    console.log(`ETF Holdings: ${apiEtfCount} (raw: ${apiEtfCountRaw}, type: ${typeof apiEtfCountRaw})`);

    if (apiEquityCountRaw === null && apiMfCountRaw === null && apiEtfCountRaw === null) {
      throw new Error('No holdings count data found in API response');
    }

    // 3. Execute SQL query to get database counts
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'holdings_count_test.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const dbResult = await dbClient.query(sqlQuery);
    const dbRow = dbResult.rows[0];

    if (!dbRow) {
      throw new Error('No data returned from SQL query');
    }

    const dbEquityCount = parseInt(dbRow.equity_count);
    const dbMfCount = parseInt(dbRow.mf_count);
    const dbEtfCount = parseInt(dbRow.etf_count);

    console.log('\n=== Database Holdings Counts ===');
    console.log(`Equity Count: ${dbEquityCount} (type: ${typeof dbEquityCount})`);
    console.log(`MF Count: ${dbMfCount} (type: ${typeof dbMfCount})`);
    console.log(`ETF Count: ${dbEtfCount} (type: ${typeof dbEtfCount})`)

    // 4. Compare counts (exact match required for counts)
    const equityMatch = apiEquityCount === dbEquityCount;
    const mfMatch = apiMfCount === dbMfCount;
    const etfMatch = apiEtfCount === dbEtfCount;

    // 5. Create comparison report
    const comparisonReport = `
=== Holdings Count Verification ===

Equity Holdings:
  API Value:    ${apiEquityCount}
  DB Value:     ${dbEquityCount}
  Match:        ${equityMatch ? '✅ Pass' : '❌ Fail'}

MF Holdings:
  API Value:    ${apiMfCount}
  DB Value:     ${dbMfCount}
  Match:        ${mfMatch ? '✅ Pass' : '❌ Fail'}

ETF Holdings:
  API Value:    ${apiEtfCount}
  DB Value:     ${dbEtfCount}
  Match:        ${etfMatch ? '✅ Pass' : '❌ Fail'}

Overall Result: ${equityMatch && mfMatch && etfMatch ? '✅ All Counts Match' : '❌ Mismatch Found'}
`;

    console.log(comparisonReport);

    // 6. Attach report to test output
    test.info().attach('holdings-count-comparison.txt', {
      body: comparisonReport,
      contentType: 'text/plain'
    });

    // 7. Attach detailed JSON
    test.info().attach('holdings-count-details.json', {
      body: JSON.stringify({
        userId,
        apiValues: {
          equity: apiEquityCount,
          mf: apiMfCount,
          etf: apiEtfCount
        },
        dbValues: {
          equity: dbEquityCount,
          mf: dbMfCount,
          etf: dbEtfCount
        },
        matches: {
          equity: equityMatch,
          mf: mfMatch,
          etf: etfMatch
        },
        notes: {
          equity: 'demat_holdings table count',
          mf: 'mf table count',
          etf: 'etf_holdings table count'
        }
      }, null, 2),
      contentType: 'application/json'
    });

    // 8. Assert - all counts must match exactly
    expect(equityMatch, `Equity count mismatch: API=${apiEquityCount}, DB=${dbEquityCount}`).toBe(true);
    expect(mfMatch, `MF count mismatch: API=${apiMfCount}, DB=${dbMfCount}`).toBe(true);
    expect(etfMatch, `ETF count mismatch: API=${apiEtfCount}, DB=${dbEtfCount}`).toBe(true);
  });

});