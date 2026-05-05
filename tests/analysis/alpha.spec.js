import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../endpoints/index.js';

const LOOKBACK_DAYS = parseInt(process.env.ALPHA_LOOKBACK_DAYS || '365', 10);
const BENCHMARK_ID = parseInt(process.env.BENCHMARK_ID || '9', 10);
const RISK_FREE_RATE = parseFloat(process.env.RISK_FREE_RATE || '0.06');
const COMPARISON_THRESHOLD_PCT = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

test.describe('Analysis Alpha Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Alpha - API vs SQL', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    if (!userId) throw new Error('USER_ID env var is required');

    console.log('\n=== Testing Alpha Comparison ===');

    // 1. API call
    const response = await apiClient.get(analysisEndpoints.keyMetrics(userId));
    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract API alpha
    const data = response.body?.data;
    const metrics = Array.isArray(data) ? data : (data?.metrics || data?.key_metrics || data?.keyMetrics || []);
    const alphaMetric = metrics.find(m => (m?.key || m?.title || m?.name || '').toLowerCase() === 'alpha');
    
    if (!alphaMetric) {
      throw new Error('Alpha metric not found in API response');
    }

    const apiAlpha = parseFloat(alphaMetric.value || alphaMetric.val || alphaMetric.amount);
    if (!isFinite(apiAlpha)) {
      throw new Error('Invalid alpha value from API');
    }

    console.log(`\nAPI Alpha: ${apiAlpha.toFixed(2)}%`);

    // 3. SQL query
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'alpha_calculation.sql'),
      'utf-8'
    )
      .replace(/{USER_ID}/g, userId)
      .replace(/{BENCHMARK_ID}/g, BENCHMARK_ID)
      .replace(/{LOOKBACK_DAYS}/g, LOOKBACK_DAYS)
      .replace(/{RISK_FREE_RATE}/g, RISK_FREE_RATE);

    const result = await dbClient.query(sqlQuery);
    const dbAlpha = parseFloat(result.rows[0]?.alpha);

    if (!isFinite(dbAlpha)) {
      throw new Error('Invalid alpha value from SQL');
    }

    console.log(`\nSQL Alpha: ${dbAlpha.toFixed(2)}%`);
    console.log(`SQL Beta: ${result.rows[0]?.beta?.toFixed(4)}`);
    console.log(`SQL Portfolio Return: ${(result.rows[0]?.portfolio_total_return * 100).toFixed(2)}%`);
    console.log(`SQL Benchmark Return: ${(result.rows[0]?.benchmark_total_return * 100).toFixed(2)}%`);

    // 4. Compare
    const diff = Math.abs(apiAlpha - dbAlpha);
    const diffPct = Math.abs(apiAlpha) > 0 ? (diff / Math.abs(apiAlpha)) * 100 : (diff === 0 ? 0 : Infinity);
    const sameSign = (apiAlpha === 0 && dbAlpha === 0) || Math.sign(apiAlpha) === Math.sign(dbAlpha);
    const match = sameSign && diffPct <= COMPARISON_THRESHOLD_PCT;

    const formattedReport = `
=== Alpha - API vs SQL ===
User ID            : ${userId}
Benchmark ID       : ${BENCHMARK_ID}
Risk-Free Rate     : ${RISK_FREE_RATE}
Lookback Days      : ${LOOKBACK_DAYS}
API Alpha          : ${apiAlpha.toFixed(2)}%
SQL Alpha          : ${dbAlpha.toFixed(2)}%
SQL Beta           : ${result.rows[0]?.beta?.toFixed(4)}
Portfolio Return   : ${(result.rows[0]?.portfolio_total_return * 100).toFixed(2)}%
Benchmark Return   : ${(result.rows[0]?.benchmark_total_return * 100).toFixed(2)}%
Raw Difference     : ${diff.toFixed(4)}%
Diff %             : ${diffPct.toFixed(2)}%
Threshold          : ${COMPARISON_THRESHOLD_PCT}%
Sign Match         : ${sameSign ? '✅' : '❌'}
Result             : ${match ? '✅ Within Threshold' : '❌ Mismatch'}
`;

    console.log(formattedReport);

    test.info().attach('alpha.txt', {
      body: formattedReport,
      contentType: 'text/plain',
    });

    expect(match, `API alpha ${apiAlpha.toFixed(2)}% vs SQL ${dbAlpha.toFixed(2)}% — diff ${diffPct.toFixed(2)}%`).toBe(true);
  });

});
