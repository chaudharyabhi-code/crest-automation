# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/asset-allocation-etf-filter.spec.js >> Asset Allocation ETF Filter Tests >> ETF Filter Tests Summary - All Dates
- Location: tests/dashboard/asset-allocation-etf-filter.spec.js:264:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  317 |           perfChartValue: `₹${etfFromPerf.toLocaleString()}`
  318 |         });
  319 | 
  320 |         if (!comparison.pass) {
  321 |           allAssetsAllPassed = false;
  322 |         }
  323 |       } catch (error) {
  324 |         allAssetsResults.push({
  325 |           date: testDate,
  326 |           passed: false,
  327 |           error: error.message
  328 |         });
  329 |         allAssetsAllPassed = false;
  330 |       }
  331 | 
  332 |       // Test 2: Filtered View
  333 |       try {
  334 |         // Get filtered ETF assets
  335 |         const filteredResponse = await apiClient.get(
  336 |           dashboardEndpoints.etfAssetAllocation(userId, testDate)
  337 |         );
  338 | 
  339 |         let etfFromFiltered = 0;
  340 |         if (Array.isArray(filteredResponse.body?.data)) {
  341 |           filteredResponse.body.data.forEach(asset => {
  342 |             const amount = parseFloat(asset.amount) || 0;
  343 |             const unit = asset.unit || '';
  344 |             const rupeeValue = unit ? amount * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : amount;
  345 |             etfFromFiltered += rupeeValue;
  346 |           });
  347 |         }
  348 | 
  349 |         // Get performance chart with ETF filter
  350 |         const perfResponse = await apiClient.get(
  351 |           dashboardEndpoints.etfPerformanceChart(userId, testDate)
  352 |         );
  353 | 
  354 |         let etfFromPerf = 0;
  355 |         if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
  356 |           const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
  357 |           if (lastPoint) {
  358 |             const total = parseFloat(lastPoint.total) || 0;
  359 |             const unit = lastPoint.unit || '';
  360 |             etfFromPerf = unit ? total * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : total;
  361 |           }
  362 |         }
  363 | 
  364 |         const comparison = compareValues(etfFromFiltered.toString(), etfFromPerf);
  365 | 
  366 |         filteredResults.push({
  367 |           date: testDate,
  368 |           passed: comparison.pass,
  369 |           diffPct: comparison.diffPct,
  370 |           filteredValue: `₹${etfFromFiltered.toLocaleString()}`,
  371 |           perfChartValue: `₹${etfFromPerf.toLocaleString()}`
  372 |         });
  373 | 
  374 |         if (!comparison.pass) {
  375 |           filteredAllPassed = false;
  376 |         }
  377 |       } catch (error) {
  378 |         filteredResults.push({
  379 |           date: testDate,
  380 |           passed: false,
  381 |           error: error.message
  382 |         });
  383 |         filteredAllPassed = false;
  384 |       }
  385 |     }
  386 | 
  387 |     // Create summary report
  388 |     const summaryReport = `
  389 | === ETF Filter Tests Summary ===
  390 | Total Dates Tested: ${dates.length}
  391 | 
  392 | === Test 1: ETF from All Assets View ===
  393 | Passed: ${allAssetsResults.filter(r => r.passed).length}/${allAssetsResults.length}
  394 | ${allAssetsResults.map(r => `
  395 |   ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  396 |   ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}
  397 | 
  398 | === Test 2: ETF from Filtered View ===
  399 | Passed: ${filteredResults.filter(r => r.passed).length}/${filteredResults.length}
  400 | ${filteredResults.map(r => `
  401 |   ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  402 |   ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}
  403 | 
  404 | Overall Result: ${allAssetsAllPassed && filteredAllPassed ? '✅ All tests passed' : '❌ Some tests failed'}
  405 | `;
  406 | 
  407 |     console.log(summaryReport);
  408 | 
  409 |     // Attach summary to test report
  410 |     test.info().attach('etf-filter-summary.txt', {
  411 |       body: summaryReport,
  412 |       contentType: 'text/plain'
  413 |     });
  414 | 
  415 |     // Assert both test types passed
  416 |     expect(allAssetsAllPassed).toBe(true);
> 417 |     expect(filteredAllPassed).toBe(true);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  418 |   });
  419 | });
```