# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/historical-asset-allocation.spec.js >> Historical Asset Allocation Verification Tests >> Historical Asset Allocation Summary - All Dates
- Location: tests/dashboard/historical-asset-allocation.spec.js:171:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  162 | 
  163 |       // Additional validation
  164 |       expect(result.comparison.diffPct).toBeLessThanOrEqual(
  165 |         parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
  166 |       );
  167 |     });
  168 |   });
  169 | 
  170 |   // Summary test to validate all dates at once
  171 |   test('Historical Asset Allocation Summary - All Dates', async ({ apiClient }) => {
  172 |     const userId = process.env.USER_ID;
  173 |     const dates = getHistoricalDates();
  174 |     const results = [];
  175 |     let allPassed = true;
  176 | 
  177 |     console.log('\n=== Historical Asset Allocation Summary Test ===');
  178 |     console.log(`Testing ${dates.length} historical dates: ${dates.join(', ')}`);
  179 | 
  180 |     for (const testDate of dates) {
  181 |       try {
  182 |         // Call API for this date
  183 |         const response = await apiClient.get(
  184 |           dashboardEndpoints.historicalAssetAllocation(userId, testDate)
  185 |         );
  186 | 
  187 |         // Sum all assets from API response
  188 |         let totalApiWealth = 0;
  189 | 
  190 |         if (Array.isArray(response.body?.data)) {
  191 |           // Direct array in data
  192 |           response.body.data.forEach(asset => {
  193 |             const amount = parseFloat(asset.amount) || 0;
  194 |             const unit = asset.unit || '';
  195 | 
  196 |             let rupeeValue = amount;
  197 |             if (unit) {
  198 |               const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
  199 |               rupeeValue = amount * (multipliers[unit] || 1);
  200 |             }
  201 | 
  202 |             totalApiWealth += rupeeValue;
  203 |           });
  204 |         } else if (response.body?.data?.allocation && Array.isArray(response.body.data.allocation)) {
  205 |           response.body.data.allocation.forEach(asset => {
  206 |             const assetValue = asset.value || asset.amount || asset.current_value || '0';
  207 |             const { value, unit } = extractUnitAndValue(assetValue);
  208 | 
  209 |             let rupeeValue = value;
  210 |             if (unit) {
  211 |               const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
  212 |               rupeeValue = value * (multipliers[unit] || 1);
  213 |             }
  214 | 
  215 |             totalApiWealth += rupeeValue;
  216 |           });
  217 |         }
  218 | 
  219 |         // Compare with SQL
  220 |         const result = await compareApiWithSql({
  221 |           apiValue: totalApiWealth.toString(),
  222 |           sqlFilePath: 'historical_allocation_test.sql',
  223 |           userId: userId,
  224 |           sqlColumn: 'grand_total',
  225 |           testName: `Date: ${testDate}`,
  226 |           endDate: testDate  // Pass the historical date for SQL replacement
  227 |         });
  228 | 
  229 |         results.push({
  230 |           date: testDate,
  231 |           passed: result.comparison.pass,
  232 |           diffPct: result.comparison.diffPct,
  233 |           apiValue: result.apiValue,
  234 |           dbValue: result.dbRoundedFormatted
  235 |         });
  236 | 
  237 |         if (!result.comparison.pass) {
  238 |           allPassed = false;
  239 |         }
  240 | 
  241 |       } catch (error) {
  242 |         results.push({
  243 |           date: testDate,
  244 |           passed: false,
  245 |           error: error.message
  246 |         });
  247 |         allPassed = false;
  248 |       }
  249 |     }
  250 | 
  251 |     // Create summary report using the helper function
  252 |     const summaryReport = createHistoricalSummaryReport('Historical Asset Allocation', results);
  253 |     console.log(summaryReport);
  254 | 
  255 |     // Attach summary to test report
  256 |     test.info().attach('historical-summary.txt', {
  257 |       body: summaryReport,
  258 |       contentType: 'text/plain'
  259 |     });
  260 | 
  261 |     // Assert all dates passed
> 262 |     expect(allPassed).toBe(true);
      |                       ^ Error: expect(received).toBe(expected) // Object.is equality
  263 |   });
  264 | });
```