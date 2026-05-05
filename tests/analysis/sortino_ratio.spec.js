import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../endpoints/index.js';

const LOOKBACK_DAYS = parseInt(process.env.SORTINO_LOOKBACK_DAYS || '365', 10);
const RISK_FREE_RATE = parseFloat(process.env.RISK_FREE_RATE || '0.06');
const TRADING_DAYS_PER_YEAR = parseInt(process.env.TRADING_DAYS_PER_YEAR || '252', 10);
const COMPARISON_THRESHOLD_PCT = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

test.describe('Analysis Sortino Ratio Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Sortino Ratio - API vs SQL', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    if (!userId) throw new Error('USER_ID env var is required');

    console.log('\n=== Testing Sortino Ratio Comparison ===');

    // 1. API call
    const response = await apiClient.get(analysisEndpoints.keyMetrics(userId));
    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract API sortino
    const data = response.body?.data;
    const metrics = Array.isArray(data) ? data : (data?.metrics || data?.key_metrics || data?.keyMetrics || []);
    const sortinoMetric = metrics.find(m => {
      const label = (m?.key || m?.title || m?.name || '').toLowerCase();
      return label === 'sortino ratio' || label === 'sortino' || label === 'sortino_ratio';
    });
    
    if (!sortinoMetric) {
      throw new Error('Sortino Ratio metric not found in API response');
    }

    const apiSortino = parseFloat(sortinoMetric.value || sortinoMetric.val || sortinoMetric.amount);
    if (!isFinite(apiSortino)) {
      throw new Error('Invalid sortino value from API');
    }

    console.log(`\nAPI Sortino: ${apiSortino.toFixed(2)}`);

    // 3. SQL query
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'sortino_ratio_calculation.sql'),
      'utf-8'
    )
      .replace(/{USER_ID}/g, userId)
      .replace(/{LOOKBACK_DAYS}/g, LOOKBACK_DAYS)
      .replace(/{RISK_FREE_RATE}/g, RISK_FREE_RATE)
      .replace(/{TRADING_DAYS_PER_YEAR}/g, TRADING_DAYS_PER_YEAR);

    const result = await dbClient.query(sqlQuery);
    const dbSortino = parseFloat(result.rows[0]?.sortino_ratio);

    if (!isFinite(dbSortino)) {
      throw new Error('Invalid sortino value from SQL');
    }

    console.log(`\nSQL Sortino: ${dbSortino.toFixed(2)}`);
    console.log(`SQL Mean Daily Return: ${result.rows[0]?.mean_daily_return?.toExponential(4)}`);
    console.log(`SQL Annualized Return: ${result.rows[0]?.annualized_return?.toFixed(6)}`);
    console.log(`SQL Downside Std: ${result.rows[0]?.downside_stddev?.toExponential(4)}`);
    console.log(`SQL Annualized Downside Std: ${result.rows[0]?.annualized_downside_stddev?.toFixed(6)}`);

    // 4. Compare
    const diff = Math.abs(apiSortino - dbSortino);
    const diffPct = Math.abs(apiSortino) > 0 ? (diff / Math.abs(apiSortino)) * 100 : (diff === 0 ? 0 : Infinity);
    const sameSign = (apiSortino === 0 && dbSortino === 0) || Math.sign(apiSortino) === Math.sign(dbSortino);
    const match = sameSign && diffPct <= COMPARISON_THRESHOLD_PCT;

    const formattedReport = `
=== Sortino Ratio - API vs SQL ===
User ID                  : ${userId}
Risk-Free Rate           : ${RISK_FREE_RATE}
Trading Days/Yr          : ${TRADING_DAYS_PER_YEAR}
Lookback Days            : ${LOOKBACK_DAYS}
API Sortino              : ${apiSortino.toFixed(2)}
SQL Sortino              : ${dbSortino.toFixed(2)}
Mean Daily Return        : ${result.rows[0]?.mean_daily_return?.toExponential(4)}
Annualized Return        : ${result.rows[0]?.annualized_return?.toFixed(6)}
Downside Std             : ${result.rows[0]?.downside_stddev?.toExponential(4)}
Annualized Downside Std  : ${result.rows[0]?.annualized_downside_stddev?.toFixed(6)}
Downside Data Points     : ${result.rows[0]?.downside_count} / ${result.rows[0]?.data_points}
Raw Difference           : ${diff.toFixed(4)}
Diff %                   : ${diffPct.toFixed(2)}%
Threshold                : ${COMPARISON_THRESHOLD_PCT}%
Sign Match               : ${sameSign ? '✅' : '❌'}
Result                   : ${match ? '✅ Within Threshold' : '❌ Mismatch'}
`;

    console.log(formattedReport);

    test.info().attach('sortino_ratio.txt', {
      body: formattedReport,
      contentType: 'text/plain',
    });

    expect(match, `API sortino ${apiSortino.toFixed(2)} vs SQL ${dbSortino.toFixed(2)} — diff ${diffPct.toFixed(2)}%`).toBe(true);
  });

});
