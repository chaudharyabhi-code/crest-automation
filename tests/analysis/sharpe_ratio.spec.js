import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../endpoints/index.js';

const LOOKBACK_DAYS = parseInt(process.env.SHARPE_LOOKBACK_DAYS || '365', 10);
const RISK_FREE_RATE = parseFloat(process.env.RISK_FREE_RATE || '0.06');
const TRADING_DAYS_PER_YEAR = parseInt(process.env.TRADING_DAYS_PER_YEAR || '252', 10);
const COMPARISON_THRESHOLD_PCT = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

test.describe('Analysis Sharpe Ratio Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Sharpe Ratio - API vs SQL', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    if (!userId) throw new Error('USER_ID env var is required');

    console.log('\n=== Testing Sharpe Ratio Comparison ===');

    // 1. API call
    const response = await apiClient.get(analysisEndpoints.keyMetrics(userId));
    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract API sharpe
    const data = response.body?.data;
    const metrics = Array.isArray(data) ? data : (data?.metrics || data?.key_metrics || data?.keyMetrics || []);
    const sharpeMetric = metrics.find(m => {
      const label = (m?.key || m?.title || m?.name || '').toLowerCase();
      return label === 'sharpe ratio' || label === 'sharpe' || label === 'sharpe_ratio';
    });
    
    if (!sharpeMetric) {
      throw new Error('Sharpe Ratio metric not found in API response');
    }

    const apiSharpe = parseFloat(sharpeMetric.value || sharpeMetric.val || sharpeMetric.amount);
    if (!isFinite(apiSharpe)) {
      throw new Error('Invalid sharpe value from API');
    }

    console.log(`\nAPI Sharpe: ${apiSharpe.toFixed(2)}`);

    // 3. SQL query
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'sharpe_ratio_calculation.sql'),
      'utf-8'
    )
      .replace(/{USER_ID}/g, userId)
      .replace(/{LOOKBACK_DAYS}/g, LOOKBACK_DAYS)
      .replace(/{RISK_FREE_RATE}/g, RISK_FREE_RATE)
      .replace(/{TRADING_DAYS_PER_YEAR}/g, TRADING_DAYS_PER_YEAR);

    const result = await dbClient.query(sqlQuery);
    const dbSharpe = parseFloat(result.rows[0]?.sharpe_ratio);

    if (!isFinite(dbSharpe)) {
      throw new Error('Invalid sharpe value from SQL');
    }

    console.log(`\nSQL Sharpe: ${dbSharpe.toFixed(2)}`);
    console.log(`SQL Mean Daily Return: ${result.rows[0]?.mean_daily_return?.toExponential(4)}`);
    console.log(`SQL Annualized Return: ${result.rows[0]?.annualized_return?.toFixed(6)}`);
    console.log(`SQL Daily Std: ${result.rows[0]?.daily_stddev?.toExponential(4)}`);
    console.log(`SQL Annualized Std: ${result.rows[0]?.annualized_stddev?.toFixed(6)}`);

    // 4. Compare
    const diff = Math.abs(apiSharpe - dbSharpe);
    const diffPct = Math.abs(apiSharpe) > 0 ? (diff / Math.abs(apiSharpe)) * 100 : (diff === 0 ? 0 : Infinity);
    const sameSign = (apiSharpe === 0 && dbSharpe === 0) || Math.sign(apiSharpe) === Math.sign(dbSharpe);
    const match = sameSign && diffPct <= COMPARISON_THRESHOLD_PCT;

    const formattedReport = `
=== Sharpe Ratio - API vs SQL ===
User ID            : ${userId}
Risk-Free Rate     : ${RISK_FREE_RATE}
Trading Days/Yr    : ${TRADING_DAYS_PER_YEAR}
Lookback Days      : ${LOOKBACK_DAYS}
API Sharpe         : ${apiSharpe.toFixed(2)}
SQL Sharpe         : ${dbSharpe.toFixed(2)}
Mean Daily Return  : ${result.rows[0]?.mean_daily_return?.toExponential(4)}
Annualized Return  : ${result.rows[0]?.annualized_return?.toFixed(6)}
Daily Std          : ${result.rows[0]?.daily_stddev?.toExponential(4)}
Annualized Std     : ${result.rows[0]?.annualized_stddev?.toFixed(6)}
Data Points        : ${result.rows[0]?.data_points}
Raw Difference     : ${diff.toFixed(4)}
Diff %             : ${diffPct.toFixed(2)}%
Threshold          : ${COMPARISON_THRESHOLD_PCT}%
Sign Match         : ${sameSign ? '✅' : '❌'}
Result             : ${match ? '✅ Within Threshold' : '❌ Mismatch'}
`;

    console.log(formattedReport);

    test.info().attach('sharpe_ratio.txt', {
      body: formattedReport,
      contentType: 'text/plain',
    });

    expect(match, `API sharpe ${apiSharpe.toFixed(2)} vs SQL ${dbSharpe.toFixed(2)} — diff ${diffPct.toFixed(2)}%`).toBe(true);
  });

});
