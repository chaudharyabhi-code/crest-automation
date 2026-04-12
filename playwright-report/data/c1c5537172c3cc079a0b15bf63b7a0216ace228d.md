# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/historical-performance-chart.spec.js >> Historical Performance Chart Verification Tests >> Historical Performance Chart Summary - All Dates
- Location: tests/dashboard/historical-performance-chart.spec.js:194:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  184 |         );
  185 |         console.log(`Returns % Difference: ${returnsDiff.toFixed(2)}%`);
  186 | 
  187 |         // Returns percentage can have higher variance, using 1% threshold
  188 |         expect(returnsDiff).toBeLessThanOrEqual(1.0);
  189 |       }
  190 |     });
  191 |   });
  192 | 
  193 |   // Summary test to validate all dates at once
  194 |   test('Historical Performance Chart Summary - All Dates', async ({ apiClient }) => {
  195 |     const userId = process.env.USER_ID;
  196 |     const dates = getHistoricalDates();
  197 |     const results = [];
  198 |     let allPassed = true;
  199 | 
  200 |     console.log('\n=== Historical Performance Chart Summary Test ===');
  201 |     console.log(`Testing ${dates.length} historical dates: ${dates.join(', ')}`);
  202 | 
  203 |     for (const testDate of dates) {
  204 |       try {
  205 |         // Call API for this date
  206 |         const response = await apiClient.get(
  207 |           dashboardEndpoints.historicalPerformanceChart(userId, testDate)
  208 |         );
  209 | 
  210 |         // Extract value using the same logic as individual tests
  211 |         let apiValue = 0;
  212 | 
  213 |         // Check if data is directly an array
  214 |         if (Array.isArray(response.body?.data) && response.body.data.length > 0) {
  215 |           const lastPoint = response.body.data[response.body.data.length - 1];
  216 |           if (lastPoint) {
  217 |             const totalValue = parseFloat(lastPoint.total) || 0;
  218 |             const unit = lastPoint.unit || '';
  219 | 
  220 |             // Convert to base rupee value
  221 |             let rupeeValue = totalValue;
  222 |             if (unit) {
  223 |               const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
  224 |               rupeeValue = totalValue * (multipliers[unit] || 1);
  225 |             }
  226 |             apiValue = rupeeValue;
  227 |           }
  228 |         } else if (response.body?.data?.chart_data && Array.isArray(response.body.data.chart_data)) {
  229 |           const lastPoint = response.body.data.chart_data[response.body.data.chart_data.length - 1];
  230 |           apiValue = lastPoint?.total_wealth || lastPoint?.value || lastPoint?.y || 0;
  231 |         }
  232 | 
  233 |         // Fallback to other structures
  234 |         if (!apiValue) {
  235 |           apiValue = response.body?.data?.total ||
  236 |                     response.body?.data?.total_wealth ||
  237 |                     response.body?.data?.performance?.total_wealth ||
  238 |                     0;
  239 |         }
  240 | 
  241 |         // Compare with SQL using historical_allocation_test.sql
  242 |         const result = await compareApiWithSql({
  243 |           apiValue: apiValue.toString(),
  244 |           sqlFilePath: 'historical_allocation_test.sql',
  245 |           userId: userId,
  246 |           sqlColumn: 'grand_total',
  247 |           testName: `Date: ${testDate}`,
  248 |           endDate: testDate  // Pass the historical date for SQL replacement
  249 |         });
  250 | 
  251 |         results.push({
  252 |           date: testDate,
  253 |           passed: result.comparison.pass,
  254 |           diffPct: result.comparison.diffPct,
  255 |           apiValue: result.apiValue,
  256 |           dbValue: result.dbRoundedFormatted
  257 |         });
  258 | 
  259 |         if (!result.comparison.pass) {
  260 |           allPassed = false;
  261 |         }
  262 | 
  263 |       } catch (error) {
  264 |         results.push({
  265 |           date: testDate,
  266 |           passed: false,
  267 |           error: error.message
  268 |         });
  269 |         allPassed = false;
  270 |       }
  271 |     }
  272 | 
  273 |     // Create summary report using the helper function
  274 |     const summaryReport = createHistoricalSummaryReport('Historical Performance Chart', results);
  275 |     console.log(summaryReport);
  276 | 
  277 |     // Attach summary to test report
  278 |     test.info().attach('historical-performance-summary.txt', {
  279 |       body: summaryReport,
  280 |       contentType: 'text/plain'
  281 |     });
  282 | 
  283 |     // Assert all dates passed
> 284 |     expect(allPassed).toBe(true);
      |                       ^ Error: expect(received).toBe(expected) // Object.is equality
  285 |   });
  286 | 
  287 | });
```