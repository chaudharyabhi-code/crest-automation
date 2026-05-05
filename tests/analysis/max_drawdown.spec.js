import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../endpoints/index.js';

const LOOKBACK_MONTHS = parseInt(process.env.MAX_DRAWDOWN_LOOKBACK_MONTHS || '36', 10);
const COMPARISON_THRESHOLD_PCT = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

test.describe('Analysis Max Drawdown Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Max Drawdown - API vs SQL', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    if (!userId) throw new Error('USER_ID env var is required');

    console.log('\n=== Testing Max Drawdown Comparison ===');

    // 1. API call
    const response = await apiClient.get(analysisEndpoints.keyMetrics(userId));
    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract API max drawdown
    const data = response.body?.data;
    const metrics = Array.isArray(data) ? data : (data?.metrics || data?.key_metrics || data?.keyMetrics || []);
    const mddMetric = metrics.find(m => {
      const label = (m?.key || m?.title || m?.name || '').toLowerCase();
      return label === 'max drawdown' || label === 'max_drawdown';
    });
    
    if (!mddMetric) {
      throw new Error('Max Drawdown metric not found in API response');
    }

    const apiMdd = parseFloat(mddMetric.value || mddMetric.val || mddMetric.amount);
    if (!isFinite(apiMdd)) {
      throw new Error('Invalid max drawdown value from API');
    }

    console.log(`\nAPI Max Drawdown: ${apiMdd.toFixed(2)}%`);

    // 3. SQL query
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'max_drawdown_calculation.sql'),
      'utf-8'
    )
      .replace(/{USER_ID}/g, userId)
      .replace(/{LOOKBACK_MONTHS}/g, LOOKBACK_MONTHS);

    const result = await dbClient.query(sqlQuery);
    const dbMdd = parseFloat(result.rows[0]?.max_drawdown);

    if (!isFinite(dbMdd)) {
      throw new Error('Invalid max drawdown value from SQL');
    }

    console.log(`\nSQL Max Drawdown: ${dbMdd.toFixed(2)}%`);
    console.log(`SQL Peak Date: ${result.rows[0]?.peak_date}`);
    console.log(`SQL Trough Date: ${result.rows[0]?.trough_date}`);
    console.log(`SQL Peak Value: ${result.rows[0]?.peak_value?.toFixed(2)}`);
    console.log(`SQL Trough Value: ${result.rows[0]?.trough_value?.toFixed(2)}`);

    // 4. Compare
    const diff = Math.abs(apiMdd - dbMdd);
    const diffPct = Math.abs(apiMdd) > 0 ? (diff / Math.abs(apiMdd)) * 100 : (diff === 0 ? 0 : Infinity);
    const sameSign = (apiMdd === 0 && dbMdd === 0) || Math.sign(apiMdd) === Math.sign(dbMdd);
    const match = sameSign && diffPct <= COMPARISON_THRESHOLD_PCT;

    const formattedReport = `
=== Max Drawdown - API vs SQL ===
User ID            : ${userId}
Lookback Months    : ${LOOKBACK_MONTHS}
API Max Drawdown   : ${apiMdd.toFixed(2)}%
SQL Max Drawdown   : ${dbMdd.toFixed(2)}%
Peak Date          : ${result.rows[0]?.peak_date}
Trough Date       : ${result.rows[0]?.trough_date}
Peak Value         : ${result.rows[0]?.peak_value?.toFixed(2)}
Trough Value       : ${result.rows[0]?.trough_value?.toFixed(2)}
Data Points        : ${result.rows[0]?.data_points}
Raw Difference     : ${diff.toFixed(4)}%
Diff %             : ${diffPct.toFixed(2)}%
Threshold          : ${COMPARISON_THRESHOLD_PCT}%
Sign Match         : ${sameSign ? '✅' : '❌'}
Result             : ${match ? '✅ Within Threshold' : '❌ Mismatch'}
`;

    console.log(formattedReport);

    test.info().attach('max_drawdown.txt', {
      body: formattedReport,
      contentType: 'text/plain',
    });

    expect(match, `API max drawdown ${apiMdd.toFixed(2)}% vs SQL ${dbMdd.toFixed(2)}% — diff ${diffPct.toFixed(2)}%`).toBe(true);
  });

});
