import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../endpoints/index.js';
import { compareValues } from '../../utils/comparison.js';

const LOOKBACK_DAYS = parseInt(process.env.BETA_LOOKBACK_DAYS || '365', 10);
const BENCHMARK_ID = parseInt(process.env.BENCHMARK_ID || '9', 10);
const COMPARISON_THRESHOLD_PCT = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

test.describe('Analysis Beta Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Beta - API vs SQL', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    if (!userId) throw new Error('USER_ID env var is required');

    console.log('\n=== Testing Beta Comparison ===');

    // 1. API call
    const response = await apiClient.get(analysisEndpoints.keyMetrics(userId));
    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract API beta
    const data = response.body?.data;
    const metrics = Array.isArray(data) ? data : (data?.metrics || data?.key_metrics || data?.keyMetrics || []);
    const betaMetric = metrics.find(m => (m?.key || m?.title || m?.name || '').toLowerCase() === 'beta');
    
    if (!betaMetric) {
      throw new Error('Beta metric not found in API response');
    }

    const apiBeta = parseFloat(betaMetric.value || betaMetric.val || betaMetric.amount);
    if (!isFinite(apiBeta)) {
      throw new Error('Invalid beta value from API');
    }

    console.log(`\nAPI Beta: ${apiBeta.toFixed(2)}`);

    // 3. SQL query
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'beta_calculation.sql'),
      'utf-8'
    )
      .replace(/{USER_ID}/g, userId)
      .replace(/{BENCHMARK_ID}/g, BENCHMARK_ID)
      .replace(/{LOOKBACK_DAYS}/g, LOOKBACK_DAYS);

    const result = await dbClient.query(sqlQuery);
    const dbBeta = parseFloat(result.rows[0]?.beta);

    if (!isFinite(dbBeta)) {
      throw new Error('Invalid beta value from SQL');
    }

    console.log(`\nSQL Beta: ${dbBeta.toFixed(2)}`);
    console.log(`SQL Covariance: ${result.rows[0]?.covariance?.toFixed(6)}`);
    console.log(`SQL Variance: ${result.rows[0]?.benchmark_variance?.toFixed(6)}`);
    console.log(`SQL Correlation: ${result.rows[0]?.correlation?.toFixed(4)}`);
    console.log(`SQL Data Points: ${result.rows[0]?.data_points}`);

    // 4. Compare
    const diff = Math.abs(apiBeta - dbBeta);
    const diffPct = Math.abs(apiBeta) > 0 ? (diff / Math.abs(apiBeta)) * 100 : (diff === 0 ? 0 : Infinity);
    const sameSign = (apiBeta === 0 && dbBeta === 0) || Math.sign(apiBeta) === Math.sign(dbBeta);
    const match = sameSign && diffPct <= COMPARISON_THRESHOLD_PCT;

    const formattedReport = `
=== Beta - API vs SQL ===
User ID         : ${userId}
Benchmark ID    : ${BENCHMARK_ID}
Lookback Days   : ${LOOKBACK_DAYS}
API Beta        : ${apiBeta.toFixed(2)}
SQL Beta        : ${dbBeta.toFixed(2)}
SQL Covariance  : ${result.rows[0]?.covariance?.toFixed(6)}
SQL Variance    : ${result.rows[0]?.benchmark_variance?.toFixed(6)}
SQL Correlation : ${result.rows[0]?.correlation?.toFixed(4)}
SQL Data Points : ${result.rows[0]?.data_points}
Raw Difference  : ${diff.toFixed(4)}
Diff %          : ${diffPct.toFixed(2)}%
Threshold       : ${COMPARISON_THRESHOLD_PCT}%
Sign Match      : ${sameSign ? '✅' : '❌'}
Result          : ${match ? '✅ Within Threshold' : '❌ Mismatch'}
`;

    console.log(formattedReport);

    test.info().attach('beta.txt', {
      body: formattedReport,
      contentType: 'text/plain',
    });

    expect(match, `API beta ${apiBeta.toFixed(2)} vs SQL ${dbBeta.toFixed(2)} — diff ${diffPct.toFixed(2)}%`).toBe(true);
  });

});
