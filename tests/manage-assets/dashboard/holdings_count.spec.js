import fs from 'fs';
import path from 'path';
import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';

test.describe('Manage Assets - Holdings Count (with Manual Assets)', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Holdings Count Verification including Manual Assets - Equity, MF, ETF', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    // 1. API call - same portfolio-summary endpoint
    const response = await apiClient.get(dashboardEndpoints.portfolioSummary(userId));

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    const summary = response.body?.data?.summary || [];
    const apiFind = (title) => {
      const item = summary.find(s => s.title === title);
      return item?.value || null;
    };

    const apiEquityCountRaw = apiFind('Equity Holdings');
    const apiMfCountRaw = apiFind('MF Holdings');
    const apiEtfCountRaw = apiFind('ETF Holdings');

    const apiEquityCount = apiEquityCountRaw !== null ? parseInt(apiEquityCountRaw) : 0;
    const apiMfCount = apiMfCountRaw !== null ? parseInt(apiMfCountRaw) : 0;
    const apiEtfCount = apiEtfCountRaw !== null ? parseInt(apiEtfCountRaw) : 0;

    console.log('\n=== API Holdings Counts ===');
    console.log(`Equity Holdings: ${apiEquityCount}`);
    console.log(`MF Holdings: ${apiMfCount}`);
    console.log(`ETF Holdings: ${apiEtfCount}`);

    if (apiEquityCountRaw === null && apiMfCountRaw === null && apiEtfCountRaw === null) {
      throw new Error('No holdings count data found in API response');
    }

    // 2. SQL #1 - holdings_count_test.sql
    const baseSql = fs
      .readFileSync(path.join(process.cwd(), 'queries', 'holdings_count_test.sql'), 'utf-8')
      .replace(/{USER_ID}/g, userId);
    const baseResult = await dbClient.query(baseSql);
    const baseRow = baseResult.rows[0];
    if (!baseRow) {
      throw new Error('No data returned from base holdings_count SQL');
    }
    const baseEquity = parseInt(baseRow.equity_count) || 0;
    const baseMf = parseInt(baseRow.mf_count) || 0;
    const baseEtf = parseInt(baseRow.etf_count) || 0;

    // 3. SQL #2 - manage-assets/holdings.sql (manual asset counts)
    const manualSql = fs
      .readFileSync(path.join(process.cwd(), 'queries', 'manage-assets', 'holdings.sql'), 'utf-8')
      .replace(/{USER_ID}/g, userId);
    const manualResult = await dbClient.query(manualSql);
    const manualRow = manualResult.rows[0];
    if (!manualRow) {
      throw new Error('No data returned from manage-assets holdings SQL');
    }
    const manualEquity = parseInt(manualRow.equity_count) || 0;
    const manualMf = parseInt(manualRow.mf_count) || 0;
    const manualEtf = parseInt(manualRow.etf_count) || 0;

    // 4. Combined DB counts
    const dbEquityCount = baseEquity + manualEquity;
    const dbMfCount = baseMf + manualMf;
    const dbEtfCount = baseEtf + manualEtf;

    console.log('\n=== Database Holdings Counts ===');
    console.log(`Equity: base=${baseEquity} + manual=${manualEquity} = ${dbEquityCount}`);
    console.log(`MF:     base=${baseMf} + manual=${manualMf} = ${dbMfCount}`);
    console.log(`ETF:    base=${baseEtf} + manual=${manualEtf} = ${dbEtfCount}`);

    // 5. Exact-match comparison
    const equityMatch = apiEquityCount === dbEquityCount;
    const mfMatch = apiMfCount === dbMfCount;
    const etfMatch = apiEtfCount === dbEtfCount;

    const comparisonReport = `
=== Holdings Count Verification (with Manual Assets) ===

Equity Holdings:
  API Value:        ${apiEquityCount}
  DB (base+manual): ${baseEquity} + ${manualEquity} = ${dbEquityCount}
  Match:            ${equityMatch ? '✅ Pass' : '❌ Fail'}

MF Holdings:
  API Value:        ${apiMfCount}
  DB (base+manual): ${baseMf} + ${manualMf} = ${dbMfCount}
  Match:            ${mfMatch ? '✅ Pass' : '❌ Fail'}

ETF Holdings:
  API Value:        ${apiEtfCount}
  DB (base+manual): ${baseEtf} + ${manualEtf} = ${dbEtfCount}
  Match:            ${etfMatch ? '✅ Pass' : '❌ Fail'}

Overall Result: ${equityMatch && mfMatch && etfMatch ? '✅ All Counts Match' : '❌ Mismatch Found'}
`;

    console.log(comparisonReport);

    test.info().attach('holdings-count-manual-assets-comparison.txt', {
      body: comparisonReport,
      contentType: 'text/plain'
    });

    test.info().attach('holdings-count-manual-assets-details.json', {
      body: JSON.stringify({
        userId,
        apiValues: { equity: apiEquityCount, mf: apiMfCount, etf: apiEtfCount },
        dbBase: { equity: baseEquity, mf: baseMf, etf: baseEtf },
        dbManual: { equity: manualEquity, mf: manualMf, etf: manualEtf },
        dbCombined: { equity: dbEquityCount, mf: dbMfCount, etf: dbEtfCount },
        matches: { equity: equityMatch, mf: mfMatch, etf: etfMatch }
      }, null, 2),
      contentType: 'application/json'
    });

    expect(equityMatch, `Equity count mismatch: API=${apiEquityCount}, DB=${dbEquityCount}`).toBe(true);
    expect(mfMatch, `MF count mismatch: API=${apiMfCount}, DB=${dbMfCount}`).toBe(true);
    expect(etfMatch, `ETF count mismatch: API=${apiEtfCount}, DB=${dbEtfCount}`).toBe(true);
  });

});
