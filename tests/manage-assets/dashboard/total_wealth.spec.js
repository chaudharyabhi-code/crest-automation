import fs from 'fs';
import path from 'path';
import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { extractApiValue } from '../../../utils/testHelpers.js';
import { compareValues } from '../../../utils/comparison.js';
import { dashboardEndpoints } from '../../../endpoints/index.js';

test.describe('Manage Assets - Total Wealth (with Manual Assets)', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Total Wealth Verification including Manual Assets', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const threshold = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

    // 1. API call - same portfolio-summary endpoint
    const response = await apiClient.get(dashboardEndpoints.portfolioSummary(userId));

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    const apiTotalWealth = extractApiValue(
      response.body,
      'data.summary',
      item => item.title === 'Total Wealth'
    );

    if (!apiTotalWealth) {
      throw new Error('Total Wealth not found in API response');
    }

    console.log(`\nAPI Total Wealth: ${apiTotalWealth}`);

    // 2. SQL #1 - grand_total from total_wealth_test.sql
    const totalWealthSql = fs
      .readFileSync(path.join(process.cwd(), 'queries', 'total_wealth_test.sql'), 'utf-8')
      .replace(/{USER_ID}/g, userId);
    const totalWealthResult = await dbClient.query(totalWealthSql);
    const grandTotal = parseFloat(totalWealthResult.rows[0]?.grand_total) || 0;

    // 3. SQL #2 - total_value from manual-assets-total.sql
    const manualAssetsSql = fs
      .readFileSync(path.join(process.cwd(), 'queries', 'manage-assets', 'manual-assets-total.sql'), 'utf-8')
      .replace(/{USER_ID}/g, userId);
    const manualAssetsResult = await dbClient.query(manualAssetsSql);
    const manualAssetsTotal = parseFloat(manualAssetsResult.rows[0]?.total_value) || 0;

    // 4. Combined DB total
    const combinedTotal = grandTotal + manualAssetsTotal;

    // 5. Compare API vs combined DB total
    const comparison = compareValues(apiTotalWealth, combinedTotal, threshold);

    const unitLabel = comparison.apiUnit || '';
    const formattedReport = `
=== Total Wealth Verification (with Manual Assets) ===
API Value (UI):             ${apiTotalWealth}
SQL grand_total (DB raw):   ₹${grandTotal}
SQL manual assets total:    ₹${manualAssetsTotal}
Combined DB Total:          ₹${combinedTotal}
DB Rounded:                 ₹${comparison.dbRounded?.toFixed(2)} ${unitLabel}
Difference:                 ${comparison.diff?.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                  ${threshold}%
Result:                     ${comparison.message}
`;

    console.log(formattedReport);

    test.info().attach('comparison-summary.txt', {
      body: formattedReport,
      contentType: 'text/plain'
    });

    expect(comparison.pass).toBe(true);
  });

});
