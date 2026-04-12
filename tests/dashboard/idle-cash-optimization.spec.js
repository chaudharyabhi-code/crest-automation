import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql } from '../../utils/testHelpers.js';
import { convertToUnit, compareValues } from '../../utils/comparison.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import fs from 'fs';
import path from 'path';

test.describe('Idle Cash Optimization Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Idle Cash Optimization Value Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    // Benchmark configuration for Idle Cash Optimization calculation
    // These values are used to fetch benchmark trailing returns which are multiplied with idle cash
    const benchmarkCode = process.env.IDLE_CASH_BENCHMARK || 'AUB3'; // Benchmark code for idle cash optimization (AUB3 default)
    const fromDate = process.env.IDLE_CASH_FROM_DATE || new Date().toISOString().split('T')[0]; // Today's date by default
    const range = process.env.IDLE_CASH_RANGE || '1Y'; // 1 Year range for benchmark returns

    console.log('\n=== Test Parameters ===');
    console.log(`User ID: ${userId}`);
    console.log(`Benchmark Code (for Idle Cash): ${benchmarkCode}`);
    console.log(`From Date: ${fromDate}`);
    console.log(`Range: ${range}`);

    // 1. Get potential savings API data
    const potentialSavingsResponse = await apiClient.get(
      dashboardEndpoints.potentialSavings(userId)
    );

    console.log('\n=== Potential Savings API Response ===');
    console.log(JSON.stringify(potentialSavingsResponse.body, null, 2));

    // Extract idle cash optimization value
    const optimizationOpportunities = potentialSavingsResponse.body?.data?.optimization_opportunities || [];
    const idleCashOpt = optimizationOpportunities.find(
      opp => opp.title === 'Idle cash optimization'
    );

    const apiIdleCashValue = idleCashOpt?.value || null;

    if (apiIdleCashValue === null) {
      console.log('Warning: Idle cash optimization not found in API response');
    }

    console.log(`\nIdle Cash Optimization Value from API: ${apiIdleCashValue}`);

    // 2. Get benchmark 1Y return using POST request
    let benchmark1Y = 0;
    try {
      // POST request with body containing benchmarks, from_date, and ranges
      const benchmarkResponse = await apiClient.post(
        dashboardEndpoints.benchmarkComparison(),
        {
           
            benchmarks: benchmarkCode,  // e.g., "AUB3"
            from_date: fromDate,         // e.g., "2026-04-11"
            ranges: range                // e.g., "1Y"
          
        }
      );

      console.log('\n=== Benchmark API Response ===');
      console.log(JSON.stringify(benchmarkResponse.body, null, 2));

      // Extract 1Y benchmark return from response structure
      // Response: data.AUB3.performance[0]['1Y']
      benchmark1Y = benchmarkResponse.body?.data?.[benchmarkCode]?.performance?.[0]?.[range] || 0;
      console.log(`Benchmark ${range} Return for ${benchmarkCode}: ${benchmark1Y}%`);
    } catch (error) {
      console.log(`Benchmark API failed: ${error.message}`);
      console.log('Using default benchmark return: 0%');
    }

    // 3. Get idle cash from database
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'idle_cash_optimization.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const dbResult = await dbClient.query(sqlQuery);
    const dbIdleCash = parseFloat(dbResult.rows[0]?.idle_cash || 0);

    console.log(`\n=== Database Idle Cash ===`);
    console.log(`Idle Cash (DB): ₹${dbIdleCash}`);

    // 4. Calculate expected value: DB idle cash * (benchmark 1Y return / 100)
    const expectedValue = dbIdleCash * (benchmark1Y / 100);

    console.log(`\n=== Calculation ===`);
    console.log(`Formula: Idle Cash × (Benchmark Return / 100)`);
    console.log(`Calculation: ${dbIdleCash} × (${benchmark1Y} / 100) = ${expectedValue}`);

    // Convert expected value to the same unit as API if needed
    // Assuming API returns value in a specific format (e.g., with units)
    let formattedExpectedValue = expectedValue.toString();
    if (apiIdleCashValue && typeof apiIdleCashValue === 'string') {
      // Check if API value has units like 'L', 'K', 'Cr'
      if (apiIdleCashValue.includes('L')) {
        formattedExpectedValue = `${convertToUnit(expectedValue, 'L').toFixed(2)} L`;
      } else if (apiIdleCashValue.includes('K')) {
        formattedExpectedValue = `${convertToUnit(expectedValue, 'K').toFixed(2)} K`;
      } else if (apiIdleCashValue.includes('Cr')) {
        formattedExpectedValue = `${convertToUnit(expectedValue, 'Cr').toFixed(2)} Cr`;
      }
    }

    // 5. Compare API value with calculated value (DB × Benchmark)
    // Using compareValues directly since we're comparing calculated value, not raw SQL
    const comparison = compareValues(
      apiIdleCashValue || '0',  // API value from potential savings
      expectedValue,             // Calculated: DB idle cash × benchmark return
      0.25                       // Threshold: 0.25%
    );

    // Create detailed comparison report
    const detailedReport = `
=== Idle Cash Optimization Value Verification ===

Input Values:
  Idle Cash (DB):           ₹${dbIdleCash}
  Benchmark ${range} Return (${benchmarkCode}): ${benchmark1Y}%

Calculation:
  Formula:                  Idle Cash × (Benchmark Return / 100)
  Calculation:              ${dbIdleCash} × (${benchmark1Y} / 100) = ₹${expectedValue.toFixed(2)}

Comparison:
  API Value (Potential Savings): ${apiIdleCashValue || 'Not Found'}
  Calculated Value (DB×Benchmark): ${formattedExpectedValue}
  Difference:                ${comparison.diff?.toFixed(2) || 'N/A'} (${comparison.diffPct?.toFixed(2) || 'N/A'}%)
  Threshold:                 0.25%
  Result:                    ${comparison.message}`;

    console.log(detailedReport);

    // 6. Attach reports
    test.info().attach('idle-cash-optimization-report.txt', {
      body: detailedReport,
      contentType: 'text/plain'
    });

    test.info().attach('idle-cash-optimization-details.json', {
      body: JSON.stringify({
        parameters: { userId, benchmarkCode, fromDate, range },
        inputs: {
          idleCashFromDB: dbIdleCash,
          benchmarkReturn: benchmark1Y
        },
        calculation: {
          formula: 'idle_cash * (benchmark_return / 100)',
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

    // 7. Assert - test passes if difference < 0.25%
    expect(comparison.pass).toBe(true);
  });

  test('Idle Cash Percentage of Total Wealth Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    // Same benchmark configuration as value test
    const benchmarkCode = process.env.IDLE_CASH_BENCHMARK || 'AUB3';
    const fromDate = process.env.IDLE_CASH_FROM_DATE || new Date().toISOString().split('T')[0];
    const range = process.env.IDLE_CASH_RANGE || '1Y';

    console.log('\n=== Idle Cash Percentage Test Parameters ===');
    console.log(`User ID: ${userId}`);
    console.log(`Benchmark Code: ${benchmarkCode}`);
    console.log(`Range: ${range}`);

    // 1. Get potential savings API data (same as before)
    const potentialSavingsResponse = await apiClient.get(
      dashboardEndpoints.potentialSavings(userId)
    );

    const optimizationOpportunities = potentialSavingsResponse.body?.data?.optimization_opportunities || [];
    const idleCashOpt = optimizationOpportunities.find(
      opp => opp.title === 'Idle cash optimization'
    );

    const apiPercentageStr = idleCashOpt?.percentage || null;

    if (apiPercentageStr === null) {
      console.log('Warning: Idle cash optimization percentage not found in API response');
    }

    console.log(`\nAPI Percentage: ${apiPercentageStr}`);

    // 2. Get benchmark 1Y return
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

      benchmark1Y = benchmarkResponse.body?.data?.[benchmarkCode]?.performance?.[0]?.[range] || 0;
      console.log(`Benchmark ${range} Return: ${benchmark1Y}%`);
    } catch (error) {
      console.log(`Benchmark API failed: ${error.message}`);
    }

    // 3. Get idle cash from database
    const idleCashQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'idle_cash_optimization.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const idleCashResult = await dbClient.query(idleCashQuery);
    const dbIdleCash = parseFloat(idleCashResult.rows[0]?.idle_cash || 0);

    // 4. Get total wealth from database
    const totalWealthQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'total_wealth_test.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const totalWealthResult = await dbClient.query(totalWealthQuery);
    // Calculate total wealth from all components
    const row = totalWealthResult.rows[0];
    const totalWealth = (
      parseFloat(row?.deposits_total || 0) +
      parseFloat(row?.equity_total || 0) +
      parseFloat(row?.etf_total || 0) +
      parseFloat(row?.mf_total || 0) +
      parseFloat(row?.nps_total || 0) +
      parseFloat(row?.recurring_deposits_total || 0) +
      parseFloat(row?.term_deposits_total || 0)
    );

    console.log(`\n=== Database Values ===`);
    console.log(`Idle Cash (DB): ₹${dbIdleCash}`);
    console.log(`Total Wealth (DB): ₹${totalWealth}`);

    // 5. Calculate percentage: (idle_cash * benchmark_return / total_wealth) * 100
    const calculatedPercentageRaw = totalWealth > 0
      ? (dbIdleCash * (benchmark1Y / 100) / totalWealth) * 100
      : 0;

    // For percentages: round to 1 decimal first, then compare
    const calculatedPercentage = Math.round(calculatedPercentageRaw * 10) / 10;

    console.log(`\n=== Percentage Calculation ===`);
    console.log(`Formula: (Idle Cash × Benchmark Return / Total Wealth) × 100`);
    console.log(`Raw Calculation: (${dbIdleCash} × ${benchmark1Y / 100} / ${totalWealth}) × 100 = ${calculatedPercentageRaw.toFixed(4)}%`);
    console.log(`Rounded to 1 decimal: ${calculatedPercentage}%`);

    // 6. Compare API percentage with calculated percentage
    // For percentages: round API value to 1 decimal first (e.g., "+1.3%" → 1.3, round to 1.3)
    const apiPercentageRaw = apiPercentageStr
      ? parseFloat(apiPercentageStr.replace(/[+%\s]/g, ''))
      : 0;
    const apiPercentageNumeric = Math.round(apiPercentageRaw * 10) / 10; // Round to 1 decimal

    const comparison = compareValues(
      apiPercentageNumeric.toString(),   // API percentage (rounded to 1 decimal)
      calculatedPercentage,               // Calculated percentage (rounded to 1 decimal)
      0.25                                // Threshold: 0.25%
    );

    // Create detailed comparison report
    const detailedReport = `
=== Idle Cash Percentage of Total Wealth Verification ===

Input Values:
  Idle Cash (DB):           ₹${dbIdleCash}
  Total Wealth (DB):        ₹${totalWealth}
  Benchmark ${range} Return: ${benchmark1Y}%

Calculation:
  Formula:                  (Idle Cash × Benchmark Return / Total Wealth) × 100
  Calculation:              (${dbIdleCash} × ${benchmark1Y / 100} / ${totalWealth}) × 100
  Result:                   ${calculatedPercentage.toFixed(1)}%

Comparison:
  API Percentage:           ${apiPercentageStr || 'Not Found'} (${apiPercentageNumeric.toFixed(1)}%)
  Calculated Percentage:    ${calculatedPercentage.toFixed(1)}%
  Difference:               ${comparison.diff?.toFixed(2) || 'N/A'} (${comparison.diffPct?.toFixed(2) || 'N/A'}%)
  Threshold:                0.25%
  Result:                   ${comparison.message}`;

    console.log(detailedReport);

    // 7. Attach reports
    test.info().attach('idle-cash-percentage-report.txt', {
      body: detailedReport,
      contentType: 'text/plain'
    });

    test.info().attach('idle-cash-percentage-details.json', {
      body: JSON.stringify({
        parameters: { userId, benchmarkCode, fromDate, range },
        inputs: {
          idleCashFromDB: dbIdleCash,
          totalWealthFromDB: totalWealth,
          benchmarkReturn: benchmark1Y
        },
        calculation: {
          formula: '(idle_cash * (benchmark_return / 100) / total_wealth) * 100',
          calculatedPercentage: calculatedPercentage,
          calculatedPercentageFormatted: `${calculatedPercentage.toFixed(2)}%`
        },
        apiResponse: {
          idleCashOptimization: idleCashOpt,
          percentage: apiPercentageStr,
          percentageNumeric: apiPercentageNumeric
        },
        comparison: comparison
      }, null, 2),
      contentType: 'application/json'
    });

    // 8. Assert
    expect(comparison.pass).toBe(true);
  });

});