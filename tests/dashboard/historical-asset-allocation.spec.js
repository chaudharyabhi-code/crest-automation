import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql, extractApiValue } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import { getHistoricalDates, createHistoricalSummaryReport, validateHistoricalDates } from '../../utils/historicalDateHelper.js';
import { extractUnitAndValue } from '../../utils/comparison.js';

test.describe('Historical Asset Allocation Verification Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();

    // Validate that historical dates are in the past
    const datesValid = validateHistoricalDates();
    if (!datesValid) {
      console.warn('Some historical dates may be in the future.');
    }
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  // Run test for each historical date
  const historicalDates = getHistoricalDates();

  historicalDates.forEach(testDate => {
    test(`Historical Asset Allocation for ${testDate}`, async ({ apiClient }) => {
      const userId = process.env.USER_ID;

      console.log(`\n=== Testing Historical Asset Allocation for Date: ${testDate} ===`);

      // 1. API call for historical asset allocation
      const response = await apiClient.get(
        dashboardEndpoints.historicalAssetAllocation(userId, testDate)
      );

      console.log('\n=== API Response ===');
      console.log(`Date: ${testDate}`);
      console.log(JSON.stringify(response.body, null, 2));

      // 2. Sum all asset values from the API response
      let totalApiWealth = 0;
      const assetBreakdown = [];

      // Check different possible response structures
      if (Array.isArray(response.body?.data)) {
        // Direct array in data (as seen in the actual response)
        const allocation = response.body.data;

        allocation.forEach(asset => {
          const assetName = asset.name || asset.asset_type || asset.type || 'Unknown';

          // The API returns amount and unit separately
          const amount = parseFloat(asset.amount) || 0;
          const unit = asset.unit || '';

          // Convert to base rupee value for summing
          let rupeeValue = amount;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = amount * (multipliers[unit] || 1);
          }

          totalApiWealth += rupeeValue;

          assetBreakdown.push({
            name: assetName,
            originalValue: `${amount} ${unit}`,
            numericValue: amount,
            unit: unit,
            rupeeValue: rupeeValue
          });
        });
      } else if (response.body?.data?.allocation && Array.isArray(response.body.data.allocation)) {
        // Asset allocation array structure - sum all assets
        const allocation = response.body.data.allocation;

        allocation.forEach(asset => {
          const assetName = asset.name || asset.asset_type || asset.type || 'Unknown';
          const assetValue = asset.value || asset.amount || asset.current_value || '0';

          // Extract numeric value and unit using the comparison utility
          const { value, unit } = extractUnitAndValue(assetValue);

          // Convert to base rupee value for summing
          let rupeeValue = value;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = value * (multipliers[unit] || 1);
          }

          totalApiWealth += rupeeValue;

          assetBreakdown.push({
            name: assetName,
            originalValue: assetValue,
            numericValue: value,
            unit: unit,
            rupeeValue: rupeeValue
          });
        });
      } else if (response.body?.data?.assets) {
        // Alternative structure with assets object
        const assets = response.body.data.assets;

        Object.keys(assets).forEach(assetType => {
          const assetValue = assets[assetType];
          const { value, unit } = extractUnitAndValue(assetValue);

          let rupeeValue = value;
          if (unit) {
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            rupeeValue = value * (multipliers[unit] || 1);
          }

          totalApiWealth += rupeeValue;

          assetBreakdown.push({
            name: assetType,
            originalValue: assetValue,
            numericValue: value,
            unit: unit,
            rupeeValue: rupeeValue
          });
        });
      }

      // Log the breakdown for debugging
      console.log('\n=== Asset Allocation Breakdown ===');
      assetBreakdown.forEach(asset => {
        console.log(`${asset.name}: ${asset.originalValue} = ₹${asset.rupeeValue.toLocaleString()}`);
      });
      console.log(`\nTotal API Wealth (Sum of all assets): ₹${totalApiWealth.toLocaleString()}`);

      // 3. Compare with SQL using historical_allocation_test.sql with date parameter
      const result = await compareApiWithSql({
        apiValue: totalApiWealth.toString(),
        sqlFilePath: 'historical_allocation_test.sql',
        userId: userId,
        sqlColumn: 'grand_total',
        testName: `Historical Asset Allocation - ${testDate}`,
        endDate: testDate  // Pass the historical date for SQL replacement
      });

      console.log(result.formattedReport);

      // 4. Attach comparison details to test report
      test.info().attach(`historical-asset-allocation-${testDate}.txt`, {
        body: `Historical Date: ${testDate}\n${result.formattedReport}`,
        contentType: 'text/plain'
      });

      // 5. Attach API response for debugging
      test.info().attach(`api-response-${testDate}.json`, {
        body: JSON.stringify(response.body, null, 2),
        contentType: 'application/json'
      });

      // 6. Assert test passes if difference is within threshold
      expect(result.comparison.pass).toBe(true);

      // Additional validation
      expect(result.comparison.diffPct).toBeLessThanOrEqual(
        parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
      );
    });
  });

  // Summary test to validate all dates at once
  test('Historical Asset Allocation Summary - All Dates', async ({ apiClient }) => {
    const userId = process.env.USER_ID;
    const dates = getHistoricalDates();
    const results = [];
    let allPassed = true;

    console.log('\n=== Historical Asset Allocation Summary Test ===');
    console.log(`Testing ${dates.length} historical dates: ${dates.join(', ')}`);

    for (const testDate of dates) {
      try {
        // Call API for this date
        const response = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );

        // Sum all assets from API response
        let totalApiWealth = 0;

        if (Array.isArray(response.body?.data)) {
          // Direct array in data
          response.body.data.forEach(asset => {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';

            let rupeeValue = amount;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = amount * (multipliers[unit] || 1);
            }

            totalApiWealth += rupeeValue;
          });
        } else if (response.body?.data?.allocation && Array.isArray(response.body.data.allocation)) {
          response.body.data.allocation.forEach(asset => {
            const assetValue = asset.value || asset.amount || asset.current_value || '0';
            const { value, unit } = extractUnitAndValue(assetValue);

            let rupeeValue = value;
            if (unit) {
              const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
              rupeeValue = value * (multipliers[unit] || 1);
            }

            totalApiWealth += rupeeValue;
          });
        }

        // Compare with SQL
        const result = await compareApiWithSql({
          apiValue: totalApiWealth.toString(),
          sqlFilePath: 'historical_allocation_test.sql',
          userId: userId,
          sqlColumn: 'grand_total',
          testName: `Date: ${testDate}`,
          endDate: testDate  // Pass the historical date for SQL replacement
        });

        results.push({
          date: testDate,
          passed: result.comparison.pass,
          diffPct: result.comparison.diffPct,
          apiValue: result.apiValue,
          dbValue: result.dbRoundedFormatted
        });

        if (!result.comparison.pass) {
          allPassed = false;
        }

      } catch (error) {
        results.push({
          date: testDate,
          passed: false,
          error: error.message
        });
        allPassed = false;
      }
    }

    // Create summary report using the helper function
    const summaryReport = createHistoricalSummaryReport('Historical Asset Allocation', results);
    console.log(summaryReport);

    // Attach summary to test report
    test.info().attach('historical-summary.txt', {
      body: summaryReport,
      contentType: 'text/plain'
    });

    // Assert all dates passed
    expect(allPassed).toBe(true);
  });
});