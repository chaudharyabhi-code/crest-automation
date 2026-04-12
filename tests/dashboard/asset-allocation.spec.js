import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql } from '../../utils/testHelpers.js';
import { sumValuesWithDifferentUnits, convertToUnit } from '../../utils/comparison.js';
import { dashboardEndpoints } from '../../endpoints/index.js';

test.describe('Asset Allocation Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Asset Allocation Total Verification', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const entityType = process.env.ENTITY_TYPE || 'asset';

    // Optional parameters from environment or defaults
    const fromDate = process.env.FROM_DATE || '';
    const toDate = process.env.TO_DATE || fromDate;
    const assetClassId = process.env.ASSET_CLASS_ID || '';

    // 1. API call using centralized endpoint with options
    const response = await apiClient.get(
      dashboardEndpoints.assetAllocation(userId, {
        fromDate,
        toDate,
        assetClassId,
        entityType
      })
    );

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract and sum all asset allocation values
    let assetAllocApiValue;
    let totalBase = 0; // Define outside the if block

    if (response.body?.data && Array.isArray(response.body.data)) {
      // Sum all values with different units to get base rupee value
      totalBase = sumValuesWithDifferentUnits(response.body.data);

      // Convert to Lakhs for comparison (as per your requirement)
      assetAllocApiValue = parseFloat(convertToUnit(totalBase, 'L').toFixed(2));

      console.log('\n=== Asset Allocation Breakdown ===');
      response.body.data.forEach(item => {
        console.log(`${item.name || 'Unknown'}: ${item.amount} ${item.unit}`);
      });
      console.log(`\nTotal (in base): ₹${totalBase}`);
      console.log(`Total (in Lakhs): ₹${assetAllocApiValue} L`);
    } else {
      throw new Error('Asset allocation data not found in API response');
    }

    // 3. Format for comparison (adding 'L' unit since we converted to Lakhs)
    const formattedApiValue = `${assetAllocApiValue} L`;

    // 4. Compare with SQL using generic helper
    const result = await compareApiWithSql({
      apiValue: formattedApiValue,
      sqlFilePath: 'total_wealth_test.sql', // Using the same SQL for total wealth
      userId: userId,
      sqlColumn: 'grand_total',
      testName: 'Asset Allocation Total Verification'
    });

    console.log(result.formattedReport);

    // 5. Attach detailed breakdown to HTML report
    test.info().attach('asset-allocation-comparison.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 6. Also attach the breakdown details
    test.info().attach('asset-allocation-details.json', {
      body: JSON.stringify({
        parameters: { userId, fromDate, toDate, assetClassId, entityType },
        apiResponse: response.body,
        totalBase: totalBase,
        totalInLakhs: assetAllocApiValue,
        sqlValue: result.sqlValue,
        comparison: result.comparison
      }, null, 2),
      contentType: 'application/json'
    });

    // 7. Assert - test passes if difference < 0.25%
    expect(result.comparison.pass).toBe(true);
  });

});