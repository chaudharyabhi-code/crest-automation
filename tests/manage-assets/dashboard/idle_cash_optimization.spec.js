import fs from 'fs';
import path from 'path';
import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { convertToUnit, compareValues } from '../../../utils/comparison.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';

test.describe('Manage Assets - Idle Cash Optimization (with Manual Assets)', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Idle Cash Optimization Value Verification including Manual Assets', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const benchmarkCode = process.env.IDLE_CASH_BENCHMARK || 'AUB3';
    const fromDate = process.env.IDLE_CASH_FROM_DATE || new Date().toISOString().split('T')[0];
    const range = process.env.IDLE_CASH_RANGE || '1Y';

    console.log('\n=== Test Parameters ===');
    console.log(`User ID: ${userId}`);
    console.log(`Benchmark Code: ${benchmarkCode}`);
    console.log(`From Date: ${fromDate}`);
    console.log(`Range: ${range}`);

    // 1. API call - potential savings (same as previous idle cash optimization test)
    const potentialSavingsResponse = await apiClient.get(
      dashboardEndpoints.potentialSavings(userId)
    );

    console.log('\n=== Potential Savings API Response ===');
    console.log(JSON.stringify(potentialSavingsResponse.body, null, 2));

    const optimizationOpportunities = potentialSavingsResponse.body?.data?.optimization_opportunities || [];
    const idleCashOpt = optimizationOpportunities.find(
      opp => opp.title === 'Idle cash optimization'
    );
    const apiIdleCashValue = idleCashOpt?.value || null;

    if (apiIdleCashValue === null) {
      console.log('Warning: Idle cash optimization not found in API response');
    }
    console.log(`\nAPI Idle Cash Optimization Value: ${apiIdleCashValue}`);

    // 2. Benchmark 1Y return
    let benchmark1Y = 0;
    try {
      const benchmarkResponse = await apiClient.post(
        dashboardEndpoints.benchmarkComparison(),
        {
          benchmarks: benchmarkCode,
          from_date: fromDate,
          ranges: range
        }
      );

      console.log('\n=== Benchmark API Response ===');
      console.log(JSON.stringify(benchmarkResponse.body, null, 2));

      benchmark1Y = benchmarkResponse.body?.data?.[benchmarkCode]?.performance?.[0]?.[range] || 0;
      console.log(`Benchmark ${range} Return for ${benchmarkCode}: ${benchmark1Y}%`);
    } catch (error) {
      console.log(`Benchmark API failed: ${error.message}`);
    }

    // 3. SQL #1 - idle_cash from idle_cash_optimization.sql
    const idleCashSql = fs
      .readFileSync(path.join(process.cwd(), 'queries', 'idle_cash_optimization.sql'), 'utf-8')
      .replace(/{USER_ID}/g, userId);
    const idleCashResult = await dbClient.query(idleCashSql);
    const dbIdleCash = parseFloat(idleCashResult.rows[0]?.idle_cash) || 0;

    // 4. SQL #2 - total_current_value from manage-assets/idle-cash-optimization.sql
    const manualIdleCashSql = fs
      .readFileSync(path.join(process.cwd(), 'queries', 'manage-assets', 'idle-cash-optimization.sql'), 'utf-8')
      .replace(/{USER_ID}/g, userId);
    const manualIdleCashResult = await dbClient.query(manualIdleCashSql);
    const manualIdleCash = parseFloat(manualIdleCashResult.rows[0]?.total_current_value) || 0;

    // 5. Combined idle cash, then multiply by benchmark return
    const combinedIdleCash = dbIdleCash + manualIdleCash;
    const expectedValue = combinedIdleCash * (benchmark1Y / 100);

    console.log(`\n=== Database Idle Cash ===`);
    console.log(`Idle Cash (DB):            ₹${dbIdleCash}`);
    console.log(`Manual Idle Cash (DB):     ₹${manualIdleCash}`);
    console.log(`Combined Idle Cash:        ₹${combinedIdleCash}`);

    console.log(`\n=== Calculation ===`);
    console.log(`Formula: (Idle Cash + Manual Idle Cash) × (Benchmark Return / 100)`);
    console.log(`Calculation: ${combinedIdleCash} × (${benchmark1Y} / 100) = ${expectedValue}`);

    let formattedExpectedValue = expectedValue.toString();
    if (apiIdleCashValue && typeof apiIdleCashValue === 'string') {
      if (apiIdleCashValue.includes('L')) {
        formattedExpectedValue = `${convertToUnit(expectedValue, 'L').toFixed(2)} L`;
      } else if (apiIdleCashValue.includes('K')) {
        formattedExpectedValue = `${convertToUnit(expectedValue, 'K').toFixed(2)} K`;
      } else if (apiIdleCashValue.includes('Cr')) {
        formattedExpectedValue = `${convertToUnit(expectedValue, 'Cr').toFixed(2)} Cr`;
      }
    }

    // 6. Compare API value with calculated value
    const comparison = compareValues(
      apiIdleCashValue || '0',
      expectedValue,
      0.25
    );

    const detailedReport = `
=== Idle Cash Optimization Value Verification (with Manual Assets) ===

Input Values:
  Idle Cash (DB):                    ₹${dbIdleCash}
  Manual Idle Cash (DB):             ₹${manualIdleCash}
  Combined Idle Cash:                ₹${combinedIdleCash}
  Benchmark ${range} Return (${benchmarkCode}): ${benchmark1Y}%

Calculation:
  Formula:                  (Idle Cash + Manual Idle Cash) × (Benchmark Return / 100)
  Calculation:              ${combinedIdleCash} × (${benchmark1Y} / 100) = ₹${expectedValue.toFixed(2)}

Comparison:
  API Value (Potential Savings):     ${apiIdleCashValue || 'Not Found'}
  Calculated Value (DB×Benchmark):   ${formattedExpectedValue}
  Difference:                ${comparison.diff?.toFixed(2) || 'N/A'} (${comparison.diffPct?.toFixed(2) || 'N/A'}%)
  Threshold:                 0.25%
  Result:                    ${comparison.message}`;

    console.log(detailedReport);

    test.info().attach('idle-cash-optimization-manual-assets-report.txt', {
      body: detailedReport,
      contentType: 'text/plain'
    });

    test.info().attach('idle-cash-optimization-manual-assets-details.json', {
      body: JSON.stringify({
        parameters: { userId, benchmarkCode, fromDate, range },
        inputs: {
          idleCashFromDB: dbIdleCash,
          manualIdleCashFromDB: manualIdleCash,
          combinedIdleCash: combinedIdleCash,
          benchmarkReturn: benchmark1Y
        },
        calculation: {
          formula: '(idle_cash + manual_idle_cash) * (benchmark_return / 100)',
          calculatedValue: expectedValue,
          formattedCalculatedValue: formattedExpectedValue
        },
        apiResponse: {
          idleCashOptimization: idleCashOpt,
          value: apiIdleCashValue
        },
        comparison: comparison
      }, null, 2),
      contentType: 'application/json'
    });

    expect(comparison.pass).toBe(true);
  });

});
