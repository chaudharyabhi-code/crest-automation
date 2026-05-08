import fs from 'fs';
import path from 'path';
import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { extractApiValue } from '../../../utils/testHelpers.js';
import { compareValues } from '../../../utils/comparison.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';

test.describe('Manage Assets - Cash & Equivalent (with Manual Assets)', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Cash & Equivalent Verification including Manual Assets', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const threshold = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

    // 1. API call - same portfolio-summary endpoint
    const response = await apiClient.get(dashboardEndpoints.portfolioSummary(userId));

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    const apiCashAndEquivalent = extractApiValue(
      response.body,
      'data.summary',
      item => item.title === 'Cash & Equivalent'
    );

    if (!apiCashAndEquivalent) {
      throw new Error('Cash & Equivalent not found in API response');
    }

    console.log(`\nAPI Cash & Equivalent: ${apiCashAndEquivalent}`);

    // 2. SQL #1 - total_cash_and_equivalent from cash-and-equivalent.sql
    const cashSql = fs
      .readFileSync(path.join(process.cwd(), 'queries', 'cash-and-equivalent.sql'), 'utf-8')
      .replace(/{USER_ID}/g, userId);
    const cashResult = await dbClient.query(cashSql);
    const totalCashAndEquivalent = parseFloat(cashResult.rows[0]?.total_cash_and_equivalent) || 0;

    // 3. SQL #2 - total_current_value from manage-assets/cash-and-equivalent.sql
    const manualCashSql = fs
      .readFileSync(path.join(process.cwd(), 'queries', 'manage-assets', 'cash-and-equivalent.sql'), 'utf-8')
      .replace(/{USER_ID}/g, userId);
    const manualCashResult = await dbClient.query(manualCashSql);
    const manualCashTotal = parseFloat(manualCashResult.rows[0]?.total_current_value) || 0;

    // 4. Combined DB total
    const combinedTotal = totalCashAndEquivalent + manualCashTotal;

    // 5. Compare API vs combined DB total
    const comparison = compareValues(apiCashAndEquivalent, combinedTotal, threshold);

    const unitLabel = comparison.apiUnit || '';
    const formattedReport = `
=== Cash & Equivalent Verification (with Manual Assets) ===
API Value (UI):                   ${apiCashAndEquivalent}
SQL total_cash_and_equivalent:    ₹${totalCashAndEquivalent}
SQL manual cash assets total:     ₹${manualCashTotal}
Combined DB Total:                ₹${combinedTotal}
DB Rounded:                       ₹${comparison.dbRounded?.toFixed(2)} ${unitLabel}
Difference:                       ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                        ${threshold}%
Result:                           ${comparison.message}
`;

    console.log(formattedReport);

    test.info().attach('comparison-summary.txt', {
      body: formattedReport,
      contentType: 'text/plain'
    });

    expect(comparison.pass).toBe(true);
  });

});
