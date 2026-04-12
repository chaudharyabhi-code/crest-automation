# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/asset-allocation-rd-filter.spec.js >> Asset Allocation Recurring Deposits Filter Tests >> Recurring Deposits Filter Tests Summary - All Dates
- Location: tests/dashboard/asset-allocation-rd-filter.spec.js:265:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  318 |           allAssetsValue: `₹${rdFromAll.toLocaleString()}`,
  319 |           perfChartValue: `₹${rdFromPerf.toLocaleString()}`
  320 |         });
  321 | 
  322 |         if (!comparison.pass) {
  323 |           allAssetsAllPassed = false;
  324 |         }
  325 |       } catch (error) {
  326 |         allAssetsResults.push({
  327 |           date: testDate,
  328 |           passed: false,
  329 |           error: error.message
  330 |         });
  331 |         allAssetsAllPassed = false;
  332 |       }
  333 | 
  334 |       // Test 2: Filtered View
  335 |       try {
  336 |         // Get filtered RD assets
  337 |         const filteredResponse = await apiClient.get(
  338 |           dashboardEndpoints.rdAssetAllocation(userId, testDate)
  339 |         );
  340 | 
  341 |         let rdFromFiltered = 0;
  342 |         if (Array.isArray(filteredResponse.body?.data)) {
  343 |           filteredResponse.body.data.forEach(asset => {
  344 |             const amount = parseFloat(asset.amount) || 0;
  345 |             const unit = asset.unit || '';
  346 |             const rupeeValue = unit ? amount * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : amount;
  347 |             rdFromFiltered += rupeeValue;
  348 |           });
  349 |         }
  350 | 
  351 |         // Get performance chart with RD filter
  352 |         const perfResponse = await apiClient.get(
  353 |           dashboardEndpoints.rdPerformanceChart(userId, testDate)
  354 |         );
  355 | 
  356 |         let rdFromPerf = 0;
  357 |         if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
  358 |           const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
  359 |           if (lastPoint) {
  360 |             const total = parseFloat(lastPoint.total) || 0;
  361 |             const unit = lastPoint.unit || '';
  362 |             rdFromPerf = unit ? total * ({ 'Cr': 10000000, 'L': 100000, 'K': 1000 }[unit] || 1) : total;
  363 |           }
  364 |         }
  365 | 
  366 |         const comparison = compareValues(rdFromFiltered.toString(), rdFromPerf);
  367 | 
  368 |         filteredResults.push({
  369 |           date: testDate,
  370 |           passed: comparison.pass,
  371 |           diffPct: comparison.diffPct,
  372 |           filteredValue: `₹${rdFromFiltered.toLocaleString()}`,
  373 |           perfChartValue: `₹${rdFromPerf.toLocaleString()}`
  374 |         });
  375 | 
  376 |         if (!comparison.pass) {
  377 |           filteredAllPassed = false;
  378 |         }
  379 |       } catch (error) {
  380 |         filteredResults.push({
  381 |           date: testDate,
  382 |           passed: false,
  383 |           error: error.message
  384 |         });
  385 |         filteredAllPassed = false;
  386 |       }
  387 |     }
  388 | 
  389 |     // Create summary report
  390 |     const summaryReport = `
  391 | === Recurring Deposits Filter Tests Summary ===
  392 | Total Dates Tested: ${dates.length}
  393 | 
  394 | === Test 1: Recurring Deposits from All Assets View ===
  395 | Passed: ${allAssetsResults.filter(r => r.passed).length}/${allAssetsResults.length}
  396 | ${allAssetsResults.map(r => `
  397 |   ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  398 |   ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}
  399 | 
  400 | === Test 2: Recurring Deposits from Filtered View ===
  401 | Passed: ${filteredResults.filter(r => r.passed).length}/${filteredResults.length}
  402 | ${filteredResults.map(r => `
  403 |   ${r.date}: ${r.passed ? '✅ PASS' : '❌ FAIL'}
  404 |   ${r.error ? `Error: ${r.error}` : `Diff: ${r.diffPct?.toFixed(2)}%`}`).join('')}
  405 | 
  406 | Overall Result: ${allAssetsAllPassed && filteredAllPassed ? '✅ All tests passed' : '❌ Some tests failed'}
  407 | `;
  408 | 
  409 |     console.log(summaryReport);
  410 | 
  411 |     // Attach summary to test report
  412 |     test.info().attach('rd-filter-summary.txt', {
  413 |       body: summaryReport,
  414 |       contentType: 'text/plain'
  415 |     });
  416 | 
  417 |     // Assert both test types passed
> 418 |     expect(allAssetsAllPassed).toBe(true);
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  419 |     expect(filteredAllPassed).toBe(true);
  420 |   });
  421 | });
```