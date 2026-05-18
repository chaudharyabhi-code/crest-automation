import fs from 'fs';
import path from 'path';
import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';

test.describe('Manage Assets - Holdings Count (automated + manual)', () => {

  test.beforeAll(async () => { await dbClient.init(); });
  test.afterAll(async () => { await dbClient.close(); });

  test('Holdings Count - Equity, MF, ETF (with manual assets)', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    const response = await apiClient.get(dashboardEndpoints.portfolioSummary(userId));
    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    const summary = response.body?.data?.summary || [];
    const findVal = (title) => {
      const item = summary.find(s => s.title === title);
      return item?.value != null ? parseInt(item.value) : 0;
    };

    const apiEquity = findVal('Equity Holdings');
    const apiMf    = findVal('MF Holdings');
    const apiEtf   = findVal('ETF Holdings');

    console.log(`\nAPI  → Equity: ${apiEquity}  MF: ${apiMf}  ETF: ${apiEtf}`);

    const sql = fs
      .readFileSync(path.join(process.cwd(), 'queries', 'manage-assets', 'holdings_count_test.sql'), 'utf-8')
      .replace(/{USER_ID}/g, userId);

    const dbResult = await dbClient.query(sql);
    const row = dbResult.rows[0];

    const dbEquity = parseInt(row?.equity_count) || 0;
    const dbMf     = parseInt(row?.mf_count)     || 0;
    const dbEtf    = parseInt(row?.etf_count)    || 0;

    console.log(`DB   → Equity: ${dbEquity}  MF: ${dbMf}  ETF: ${dbEtf}`);

    const equityMatch = apiEquity === dbEquity;
    const mfMatch     = apiMf     === dbMf;
    const etfMatch    = apiEtf    === dbEtf;

    const report = `
=== Holdings Count - Equity, MF, ETF (automated + manual) ===

Equity Holdings:
  API: ${apiEquity}   DB: ${dbEquity}   ${equityMatch ? '✅ Match' : '❌ Mismatch'}

MF Holdings:
  API: ${apiMf}   DB: ${dbMf}   ${mfMatch ? '✅ Match' : '❌ Mismatch'}

ETF Holdings:
  API: ${apiEtf}   DB: ${dbEtf}   ${etfMatch ? '✅ Match' : '❌ Mismatch'}

Overall: ${equityMatch && mfMatch && etfMatch ? '✅ All Match' : '❌ Mismatch Found'}
`;
    console.log(report);

    test.info().attach('holdings-count-dashboard.txt', { body: report, contentType: 'text/plain' });
    test.info().attach('holdings-count-dashboard.json', {
      body: JSON.stringify({ userId, api: { equity: apiEquity, mf: apiMf, etf: apiEtf }, db: { equity: dbEquity, mf: dbMf, etf: dbEtf } }, null, 2),
      contentType: 'application/json'
    });

    expect(equityMatch, `Equity: API=${apiEquity} DB=${dbEquity}`).toBe(true);
    expect(mfMatch,     `MF:     API=${apiMf}     DB=${dbMf}`).toBe(true);
    expect(etfMatch,    `ETF:    API=${apiEtf}    DB=${dbEtf}`).toBe(true);
  });

});
