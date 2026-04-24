import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../utils/testHelpers.js';
import { compareValues } from '../../utils/comparison.js';
import { dashboardEndpoints } from '../../endpoints/index.js';

test.describe('Cash & Equivalent Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Cash & Equivalent Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    // 1. API call using centralized endpoint
    const response = await apiClient.get(dashboardEndpoints.portfolioSummary(userId));

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract API value using generic helper
    const apiCashAndEquivalent = extractApiValue(
      response.body,
      'data.summary',
      item => item.title === 'Cash & Equivalent'
    );

    if (!apiCashAndEquivalent) {
      throw new Error('Cash & Equivalent not found in API response');
    }

    console.log(`\nAPI Cash & Equivalent: ${apiCashAndEquivalent}`);

    // 3. Compare with SQL using generic helper
    const result = await compareApiWithSql({
      apiValue: apiCashAndEquivalent,
      sqlFilePath: 'cash-and-equivalent.sql',
      userId: userId,
      sqlColumn: 'total_cash_and_equivalent',
      testName: 'Cash & Equivalent Verification'
    });

    console.log(result.formattedReport);

    // 4. Attach to HTML report
    test.info().attach('comparison-summary.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 5. Assert
    expect(result.comparison.pass).toBe(true);
  });

  test('Cash & Equivalent Percentage of Total Wealth Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    // 1. API call
    const response = await apiClient.get(dashboardEndpoints.portfolioSummary(userId));

    // 2. Find the Cash & Equivalent summary item (we need the full item for `percentage`)
    const summary = response.body?.data?.summary || [];
    const cashItem = summary.find(item => item.title === 'Cash & Equivalent');

    if (!cashItem) {
      throw new Error('Cash & Equivalent not found in API response');
    }

    const apiPercentageStr = cashItem.change ?? null;

    if (apiPercentageStr === null) {
      throw new Error('Cash & Equivalent change (percentage) not found in API response');
    }

    console.log(`\nAPI Cash & Equivalent Percentage: ${apiPercentageStr}`);

    // 3. Cash & Equivalent from DB
    const cashQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'cash-and-equivalent.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const cashResult = await dbClient.query(cashQuery);
    const dbCashAndEquivalent = parseFloat(cashResult.rows[0]?.total_cash_and_equivalent || 0);

    // 4. Total Wealth from DB
    const totalWealthQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'total_wealth_test.sql'),
      'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const totalWealthResult = await dbClient.query(totalWealthQuery);
    const totalWealth = parseFloat(totalWealthResult.rows[0]?.grand_total || 0);

    console.log(`\n=== Database Values ===`);
    console.log(`Cash & Equivalent (DB): ₹${dbCashAndEquivalent}`);
    console.log(`Total Wealth (DB):      ₹${totalWealth}`);

    // 5. Calculate percentage: (cash_and_equivalent / total_wealth) * 100
    const calculatedPercentageRaw = totalWealth > 0
      ? (dbCashAndEquivalent / totalWealth) * 100
      : 0;
    const calculatedPercentage = Math.round(calculatedPercentageRaw * 10) / 10;

    console.log(`\n=== Percentage Calculation ===`);
    console.log(`Formula: (Cash & Equivalent / Total Wealth) × 100`);
    console.log(`Calculation: (${dbCashAndEquivalent} / ${totalWealth}) × 100 = ${calculatedPercentageRaw.toFixed(4)}%`);
    console.log(`Rounded to 1 decimal: ${calculatedPercentage}%`);

    // 6. Parse API percentage (strip +, %, spaces) and round to 1 decimal
    const apiPercentageRaw = typeof apiPercentageStr === 'string'
      ? parseFloat(apiPercentageStr.replace(/[+%\s]/g, ''))
      : parseFloat(apiPercentageStr);
    const apiPercentageNumeric = Math.round(apiPercentageRaw * 10) / 10;

    const comparison = compareValues(
      apiPercentageNumeric.toString(),
      calculatedPercentage,
      0.25
    );

    const detailedReport = `
=== Cash & Equivalent Percentage of Total Wealth Verification ===

Input Values:
  Cash & Equivalent (DB):   ₹${dbCashAndEquivalent}
  Total Wealth (DB):        ₹${totalWealth}

Calculation:
  Formula:                  (Cash & Equivalent / Total Wealth) × 100
  Calculation:              (${dbCashAndEquivalent} / ${totalWealth}) × 100
  Result:                   ${calculatedPercentage.toFixed(1)}%

Comparison:
  API Percentage:           ${apiPercentageStr} (${apiPercentageNumeric.toFixed(1)}%)
  Calculated Percentage:    ${calculatedPercentage.toFixed(1)}%
  Difference:               ${comparison.diff?.toFixed(2) || 'N/A'} (${comparison.diffPct?.toFixed(2) || 'N/A'}%)
  Threshold:                0.25%
  Result:                   ${comparison.message}`;

    console.log(detailedReport);

    // 7. Attach reports
    test.info().attach('cash-equivalent-percentage-report.txt', {
      body: detailedReport,
      contentType: 'text/plain'
    });

    test.info().attach('cash-equivalent-percentage-details.json', {
      body: JSON.stringify({
        parameters: { userId },
        inputs: {
          cashAndEquivalentFromDB: dbCashAndEquivalent,
          totalWealthFromDB: totalWealth
        },
        calculation: {
          formula: '(cash_and_equivalent / total_wealth) * 100',
          calculatedPercentage: calculatedPercentage,
          calculatedPercentageFormatted: `${calculatedPercentage.toFixed(2)}%`
        },
        apiResponse: {
          cashAndEquivalent: cashItem,
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
