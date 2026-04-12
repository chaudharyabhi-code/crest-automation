import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareValues } from '../../utils/comparison.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import fs from 'fs';
import path from 'path';

test.describe('Direct Mutual Fund Savings Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Direct Mutual Fund Savings Value Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Direct Mutual Fund Savings Test ===');
    console.log(`User ID: ${userId}`);

    // 1. Get potential savings API data
    const potentialSavingsResponse = await apiClient.get(
      dashboardEndpoints.potentialSavings(userId)
    );

    const optimizationOpportunities = potentialSavingsResponse.body?.data?.optimization_opportunities || [];
    const directMFOpt = optimizationOpportunities.find(
      opp => opp.title === 'Direct Mutual Funds'
    );

    const apiValue = directMFOpt?.value || null;

    if (apiValue === null) {
      console.log('Warning: Direct Mutual Funds not found in API response');
    }

    console.log(`\nAPI Value: ${apiValue}`);

    // 2. Get potential savings from database
    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'direct_mutual_fund.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const dbResult = await dbClient.query(sqlQuery);
    const dbSavings = parseFloat(dbResult.rows[0]?.total_potential_savings || 0);

    console.log(`\n=== Database Savings ===`);
    console.log(`Potential Savings (DB): ₹${dbSavings}`);

    // 3. Compare API value with DB value
    const comparison = compareValues(
      apiValue || '0',
      dbSavings,
      0.25
    );

    // Create detailed comparison report
    const detailedReport = `
=== Direct Mutual Fund Savings Value Verification ===

Database Value:
  Potential Savings (DB):   ₹${dbSavings}

Comparison:
  API Value:                ${apiValue || 'Not Found'}
  DB Value:                 ₹${dbSavings}
  Difference:               ${comparison.diff?.toFixed(2) || 'N/A'} (${comparison.diffPct?.toFixed(2) || 'N/A'}%)
  Threshold:                0.25%
  Result:                   ${comparison.message}`;

    console.log(detailedReport);

    // 4. Attach reports
    test.info().attach('direct-mf-savings-report.txt', {
      body: detailedReport,
      contentType: 'text/plain'
    });

    test.info().attach('direct-mf-savings-details.json', {
      body: JSON.stringify({
        userId: userId,
        apiResponse: {
          directMFOpt: directMFOpt,
          value: apiValue
        },
        dbValue: dbSavings,
        comparison: comparison
      }, null, 2),
      contentType: 'application/json'
    });

    // 5. Assert
    expect(comparison.pass).toBe(true);
  });

  test('Direct Mutual Fund Savings Percentage Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Direct Mutual Fund Savings Percentage Test ===');
    console.log(`User ID: ${userId}`);

    // 1. Get potential savings API data
    const potentialSavingsResponse = await apiClient.get(
      dashboardEndpoints.potentialSavings(userId)
    );

    const optimizationOpportunities = potentialSavingsResponse.body?.data?.optimization_opportunities || [];
    const directMFOpt = optimizationOpportunities.find(
      opp => opp.title === 'Direct Mutual Funds'
    );

    const apiPercentageStr = directMFOpt?.percentage || null;
    const apiValue = directMFOpt?.value || null;

    if (apiPercentageStr === null) {
      console.log('Warning: Direct Mutual Funds percentage not found in API response');
    }

    console.log(`\nAPI Percentage: ${apiPercentageStr}`);

    // 2. Get potential savings from database
    const savingsQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'direct_mutual_fund.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const savingsResult = await dbClient.query(savingsQuery);
    const dbSavings = parseFloat(savingsResult.rows[0]?.total_potential_savings || 0);

    // 3. Get total wealth from database
    const totalWealthQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'total_wealth_test.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const totalWealthResult = await dbClient.query(totalWealthQuery);
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
    console.log(`Potential Savings (DB): ₹${dbSavings}`);
    console.log(`Total Wealth (DB): ₹${totalWealth}`);

    // 4. Calculate percentage: (savings / total_wealth) * 100
    const calculatedPercentageRaw = totalWealth > 0
      ? (dbSavings / totalWealth) * 100
      : 0;

    // For percentages: round to 1 decimal first
    const calculatedPercentage = Math.round(calculatedPercentageRaw * 10) / 10;

    console.log(`\n=== Percentage Calculation ===`);
    console.log(`Formula: (Savings / Total Wealth) × 100`);
    console.log(`Raw Calculation: (${dbSavings} / ${totalWealth}) × 100 = ${calculatedPercentageRaw.toFixed(4)}%`);
    console.log(`Rounded to 1 decimal: ${calculatedPercentage}%`);

    // 5. Compare API percentage with calculated percentage
    // For percentages: round API value to 1 decimal first
    const apiPercentageRaw = apiPercentageStr
      ? parseFloat(apiPercentageStr.replace(/[+%\s]/g, ''))
      : 0;
    const apiPercentageNumeric = Math.round(apiPercentageRaw * 10) / 10;

    const comparison = compareValues(
      apiPercentageNumeric.toString(),
      calculatedPercentage,
      0.25
    );

    // Create detailed comparison report
    const detailedReport = `
=== Direct Mutual Fund Savings Percentage Verification ===

Input Values:
  Potential Savings (DB):   ₹${dbSavings}
  Total Wealth (DB):      ₹${totalWealth}

Calculation:
  Formula:                  (Savings / Total Wealth) × 100
  Calculation:              (${dbSavings} / ${totalWealth}) × 100
  Result:                   ${calculatedPercentage.toFixed(1)}%

Comparison:
  API Percentage:           ${apiPercentageStr || 'Not Found'} (${apiPercentageNumeric.toFixed(1)}%)
  Calculated Percentage:    ${calculatedPercentage.toFixed(1)}%
  Difference:               ${comparison.diff?.toFixed(2) || 'N/A'} (${comparison.diffPct?.toFixed(2) || 'N/A'}%)
  Threshold:                0.25%
  Result:                   ${comparison.message}`;

    console.log(detailedReport);

    // 6. Attach reports
    test.info().attach('direct-mf-percentage-report.txt', {
      body: detailedReport,
      contentType: 'text/plain'
    });

    test.info().attach('direct-mf-percentage-details.json', {
      body: JSON.stringify({
        userId: userId,
        inputs: {
          savingsFromDB: dbSavings,
          totalWealthFromDB: totalWealth
        },
        calculation: {
          formula: '(savings / total_wealth) * 100',
          calculatedPercentage: calculatedPercentage,
          calculatedPercentageFormatted: `${calculatedPercentage.toFixed(1)}%`
        },
        apiResponse: {
          directMFOpt: directMFOpt,
          percentage: apiPercentageStr,
          percentageNumeric: apiPercentageNumeric,
          value: apiValue
        },
        comparison: comparison
      }, null, 2),
      contentType: 'application/json'
    });

    // 7. Assert
    expect(comparison.pass).toBe(true);
  });

});
