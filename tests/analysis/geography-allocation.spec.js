import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../endpoints/index.js';
import fs from 'fs';
import path from 'path';

test.describe('Geography Allocation Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Geography Allocation Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    // 1. API call using centralized endpoint
    const response = await apiClient.get(analysisEndpoints.geographyAllocation(userId));

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // Extract allocation data from API
    const apiAllocationData = response.body?.data?.allocationData || [];

    if (apiAllocationData.length === 0) {
      throw new Error('No allocation data found in API response');
    }

    // 2. Get SQL results
    const sqlFilePath = path.join(process.cwd(), 'queries', 'geography-allocation-analysis.sql');
    let sqlQuery = fs.readFileSync(sqlFilePath, 'utf-8');
    sqlQuery = sqlQuery.replace(/{USER_ID}/g, userId);

    const dbResult = await dbClient.query(sqlQuery);
    const sqlResults = dbResult.rows;

    console.log('\n=== SQL Results ===');
    console.log(JSON.stringify(sqlResults, null, 2));

    // 3. Create a map of SQL results by geography for easier comparison
    const sqlMap = new Map();
    sqlResults.forEach(row => {
      sqlMap.set(row.geography, {
        percentage: parseFloat(row.percentage),
        value: parseFloat(row.value)
      });
    });

    // 4. Compare each API allocation with SQL
    const comparisonResults = [];
    let allMatched = true;

    for (const apiItem of apiAllocationData) {
      const apiName = apiItem.name;
      const apiCurrentPercentage = parseFloat(apiItem.current.replace('%', ''));

      // Find matching SQL record
      const sqlData = sqlMap.get(apiName);

      if (!sqlData) {
        comparisonResults.push({
          name: apiName,
          status: 'MISSING IN SQL',
          apiPercentage: apiCurrentPercentage,
          sqlPercentage: 'N/A',
          difference: 'N/A'
        });
        allMatched = false;
        continue;
      }

      const sqlPercentage = sqlData.percentage;
      const difference = Math.abs(apiCurrentPercentage - sqlPercentage);
      const tolerance = 0.01; // 0.01% tolerance for rounding differences

      const matched = difference <= tolerance;

      comparisonResults.push({
        name: apiName,
        status: matched ? 'PASS' : 'FAIL',
        apiPercentage: apiCurrentPercentage.toFixed(2),
        sqlPercentage: sqlPercentage.toFixed(2),
        difference: difference.toFixed(2),
        matched: matched
      });

      if (!matched) {
        allMatched = false;
      }
    }

    // 5. Check for SQL entries missing in API
    for (const [geography, sqlData] of sqlMap.entries()) {
      const foundInApi = apiAllocationData.some(item => item.name === geography);
      if (!foundInApi) {
        comparisonResults.push({
          name: geography,
          status: 'MISSING IN API',
          apiPercentage: 'N/A',
          sqlPercentage: sqlData.percentage.toFixed(2),
          difference: 'N/A',
          matched: false
        });
        allMatched = false;
      }
    }

    // 6. Generate formatted report
    const reportLines = [
      '='.repeat(80),
      'GEOGRAPHY ALLOCATION COMPARISON REPORT',
      '='.repeat(80),
      '',
      'Geography'.padEnd(30) + 'API %'.padEnd(15) + 'SQL %'.padEnd(15) + 'Diff'.padEnd(10) + 'Status',
      '-'.repeat(80)
    ];

    comparisonResults.forEach(result => {
      const line = result.name.padEnd(30) +
                   String(result.apiPercentage).padEnd(15) +
                   String(result.sqlPercentage).padEnd(15) +
                   String(result.difference).padEnd(10) +
                   result.status;
      reportLines.push(line);
    });

    reportLines.push('-'.repeat(80));
    reportLines.push(`Overall Status: ${allMatched ? 'PASS ✓' : 'FAIL ✗'}`);
    reportLines.push('='.repeat(80));

    const formattedReport = reportLines.join('\n');
    console.log('\n' + formattedReport);

    // 7. Attach to HTML report
    test.info().attach('geography-allocation-comparison.txt', {
      body: formattedReport,
      contentType: 'text/plain'
    });

    // 8. Assert
    expect(allMatched).toBe(true);
  });

});
