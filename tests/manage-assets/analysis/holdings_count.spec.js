import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../../endpoints/index.js';
import fs from 'fs';
import path from 'path';

test.describe('Manage Assets - Holdings Count (automated + manual)', () => {

  test.beforeAll(async () => { await dbClient.init(); });
  test.afterAll(async () => { await dbClient.close(); });

  function loadSql(filename, userId) {
    return fs.readFileSync(
      path.join(process.cwd(), 'queries', 'manage-assets', filename), 'utf-8'
    ).replace(/{USER_ID}/g, userId);
  }

  async function runTest({ apiClient, label, apiUrl, sqlFile, userId }) {
    console.log(`\n=== Holdings Count - ${label} ===`);

    const response = await apiClient.get(apiUrl);
    const apiCount =
      response.body?.data?.total_holdings ??
      response.body?.data?.count ??
      (Array.isArray(response.body?.data) ? response.body.data.length : null) ??
      0;

    console.log(`API Count: ${apiCount}`);

    const sql = loadSql(sqlFile, userId);
    const dbResult = await dbClient.query(sql);
    const dbCount = parseInt(dbResult.rows[0]?.count) || 0;

    console.log(`DB Count:  ${dbCount}`);

    const diff = Math.abs(apiCount - dbCount);
    const pass = diff === 0;

    const report = `
=== Holdings Count - ${label} ===
API Holdings Count: ${apiCount}
DB Holdings Count:  ${dbCount}
Difference:         ${diff}
Result:             ${pass ? '✅ Exact Match' : '❌ Mismatch'}
`;
    console.log(report);

    return { apiCount, dbCount, diff, pass, report };
  }

  test('All Assets Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'All Assets',
      apiUrl: analysisEndpoints.holdingsCount(userId),
      sqlFile: 'holdings_count_all.sql',
    });
    test.info().attach('holdings-count-all.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

  test('Equity Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'Equity',
      apiUrl: analysisEndpoints.equityHoldingsCount(userId),
      sqlFile: 'holdings_count_equity.sql',
    });
    test.info().attach('holdings-count-equity.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

  test('Mutual Fund Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'Mutual Fund',
      apiUrl: analysisEndpoints.mfHoldingsCount(userId),
      sqlFile: 'holdings_count_mf.sql',
    });
    test.info().attach('holdings-count-mf.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

  test('ETF Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'ETF',
      apiUrl: analysisEndpoints.etfHoldingsCount(userId),
      sqlFile: 'holdings_count_etf.sql',
    });
    test.info().attach('holdings-count-etf.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

  test('NPS Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'NPS',
      apiUrl: analysisEndpoints.npsHoldingsCount(userId),
      sqlFile: 'holdings_count_nps.sql',
    });
    test.info().attach('holdings-count-nps.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

  test('Bank Deposits Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'Bank Deposits',
      apiUrl: analysisEndpoints.bankBalanceHoldingsCount(userId),
      sqlFile: 'holdings_count_deposits.sql',
    });
    test.info().attach('holdings-count-deposits.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

  test('Fixed Deposits Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'Fixed Deposits',
      apiUrl: analysisEndpoints.fdHoldingsCount(userId),
      sqlFile: 'holdings_count_fd.sql',
    });
    test.info().attach('holdings-count-fd.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

  test('Recurring Deposits Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'Recurring Deposits',
      apiUrl: analysisEndpoints.rdHoldingsCount(userId),
      sqlFile: 'holdings_count_rd.sql',
    });
    test.info().attach('holdings-count-rd.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

  test('Gold Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'Gold',
      apiUrl: analysisEndpoints.goldHoldingsCount(userId),
      sqlFile: 'holdings_count_gold.sql',
    });
    test.info().attach('holdings-count-gold.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

  test('Real Estate Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'Real Estate',
      apiUrl: analysisEndpoints.realEstateHoldingsCount(userId),
      sqlFile: 'holdings_count_real_estate.sql',
    });
    test.info().attach('holdings-count-real-estate.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

  test('Crypto Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const result = await runTest({
      apiClient, userId,
      label: 'Crypto',
      apiUrl: analysisEndpoints.cryptoHoldingsCount(userId),
      sqlFile: 'holdings_count_crypto.sql',
    });
    test.info().attach('holdings-count-crypto.txt', { body: result.report, contentType: 'text/plain' });
    expect(result.pass).toBe(true);
  });

});
