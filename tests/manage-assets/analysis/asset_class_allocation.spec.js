import { test, expect } from '../../../fixtures/fixtures.js';
import { dbClient } from '../../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../../endpoints/index.js';
import fs from 'fs';
import path from 'path';

// Maps whatever name the API returns → the asset_class label used in the SQL
function normalizeApiName(apiName) {
  const n = (apiName || '').toLowerCase().trim();
  if (n === 'equity' || n.includes('stock'))                                          return 'Equity';
  if (n.includes('mutual') || n === 'mf')                                             return 'Mutual Funds';
  if (n === 'etf' || n.includes('etf'))                                               return 'ETF';
  if (n === 'nps' || n.includes('nps') || n.includes('pension'))                      return 'NPS';
  if (n === 'gold' || n.includes('gold'))                                              return 'Gold';
  if (n.includes('real estate') || n.includes('realestate') || n.includes('property')) return 'Real Estate';
  if (n === 'crypto' || n.includes('crypto') || n.includes('bitcoin'))                return 'Crypto';
  if (n === 'rd' || n.includes('recurring'))                                           return 'Recurring Deposits';
  if (n === 'fd' || n.includes('fixed') || (n.includes('term') && n.includes('dep'))) return 'Term Deposits';
  if (n === 'cash' || n.includes('bank') || n.includes('deposit'))                    return 'Cash';
  return apiName; // fallback — use as-is and rely on direct match
}

test.describe('Manage Assets - Asset Class Allocation (automated + manual)', () => {

  test.beforeAll(async () => { await dbClient.init(); });
  test.afterAll(async () => { await dbClient.close(); });

  test('Asset Class Allocation - with Manual Assets', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const threshold = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

    console.log('\n=== Asset Class Allocation (automated + manual) ===');

    const response = await apiClient.get(analysisEndpoints.assetClassAllocation(userId));
    const apiData = response.body?.data?.allocationData || [];
    console.log(`API returned ${apiData.length} asset classes`);
    console.log('API names:', apiData.map(a => a.name));

    const sqlQuery = fs.readFileSync(
      path.join(process.cwd(), 'queries', 'manage-assets', 'asset_class_allocation.sql'), 'utf-8'
    ).replace(/{USER_ID}/g, userId);

    const dbResult = await dbClient.query(sqlQuery);
    const dbRows = dbResult.rows.map(r => ({
      asset_class: r.asset_class,
      percentage: parseFloat(r.percentage) || 0,
    }));
    console.log(`DB returned ${dbRows.length} asset classes`);
    console.log('DB names:', dbRows.map(r => r.asset_class));

    const dbMap = {};
    dbRows.forEach(r => { dbMap[r.asset_class] = r; });

    const comparisons = [];
    let allPassed = true;

    for (const apiItem of apiData) {
      const apiPct = parseFloat((apiItem.current || '0').replace('%', '')) || 0;
      // Try exact match first, then normalized name
      const dbItem = dbMap[apiItem.name] || dbMap[normalizeApiName(apiItem.name)];
      const resolvedName = dbMap[apiItem.name] ? apiItem.name : normalizeApiName(apiItem.name);

      if (!dbItem) {
        comparisons.push({ name: apiItem.name, apiPct, dbPct: 'NOT FOUND', diff: '-', pass: false });
        allPassed = false;
        continue;
      }

      const diff = Math.abs(apiPct - dbItem.percentage);
      const pass = diff <= threshold;
      comparisons.push({
        name: apiItem.name,
        resolvedAs: resolvedName !== apiItem.name ? resolvedName : null,
        apiPct: apiPct.toFixed(2),
        dbPct: dbItem.percentage.toFixed(2),
        diff: diff.toFixed(2),
        pass,
      });
      if (!pass) allPassed = false;
    }

    const dbOnlyItems = dbRows.filter(d =>
      !apiData.find(a => a.name === d.asset_class || normalizeApiName(a.name) === d.asset_class)
    );

    let report = `
=== Asset Class Allocation (automated + manual) ===
User: ${userId}
Threshold: ${threshold}%
API Classes: ${apiData.length}
DB Classes:  ${dbRows.length}

=== Comparison ===\n`;

    for (const c of comparisons) {
      const alias = c.resolvedAs ? ` (resolved as "${c.resolvedAs}")` : '';
      report += `\n  ${c.name}${alias}\n    API: ${c.apiPct}%   DB: ${c.dbPct}%   Diff: ${c.diff}%   ${c.pass ? '✅' : '❌'}\n`;
    }

    if (dbOnlyItems.length > 0) {
      report += `\n=== DB Only (informational) ===\n`;
      dbOnlyItems.forEach(d => {
        report += `  ${d.asset_class}: ${d.percentage.toFixed(2)}% (not in API)\n`;
      });
    }

    report += `\n=== Summary ===\nAll Passed: ${allPassed ? '✅ YES' : '❌ NO'}`;
    console.log(report);

    test.info().attach('asset-class-allocation-manual.txt', { body: report, contentType: 'text/plain' });
    test.info().attach('asset-class-allocation-manual.json', {
      body: JSON.stringify({ userId, apiData, dbRows, comparisons }, null, 2),
      contentType: 'application/json',
    });

    expect(allPassed).toBe(true);
  });

});
