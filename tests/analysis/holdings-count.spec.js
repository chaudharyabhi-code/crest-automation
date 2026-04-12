import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareHoldingsCount } from '../../utils/testHelpers.js';
import { analysisEndpoints } from '../../endpoints/index.js';

test.describe('Analysis Holdings Count Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  // Test 1: All Assets Holdings Count
  test('All Assets Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing All Assets Holdings Count ===');

    // 1. Call Analysis Holdings API without filter
    const response = await apiClient.get(analysisEndpoints.holdingsCount(userId));

    console.log('\n=== API Response (All Assets) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract total holdings count from API
    const apiCount = response.body?.data?.total_holdings ||
                    response.body?.data?.count ||
                    response.body?.data?.length ||
                    (Array.isArray(response.body?.data) ? response.body.data.length : 0);

    console.log(`\nAPI Holdings Count (All): ${apiCount}`);

    // 3. Compare with SQL
    const result = await compareHoldingsCount({
      apiCount: apiCount,
      sqlFilePath: 'holdings_count-Analysis_tab.sql',
      userId: userId,
      filterClass: 'ALL',
      testName: 'All Assets Holdings Count'
    });

    console.log(result.formattedReport);

    // 4. Attach to test report
    test.info().attach('all-assets-holdings-count.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 5. Assert exact match
    expect(result.match).toBe(true);
    expect(result.diff).toBe(0);
  });

  // Test 2: Equity Holdings Count with Filter
  test('Equity Holdings Count with Filter', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing Equity Holdings Count ===');

    // 1. Call Analysis Holdings API with Equity filter
    const response = await apiClient.get(analysisEndpoints.equityHoldingsCount(userId));

    console.log('\n=== API Response (Equity Filter) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract holdings count from API
    const apiCount = response.body?.data?.total_holdings ||
                    response.body?.data?.count ||
                    response.body?.data?.length ||
                    (Array.isArray(response.body?.data) ? response.body.data.length : 0);

    console.log(`\nAPI Holdings Count (Equity): ${apiCount}`);

    // 3. Compare with SQL
    const result = await compareHoldingsCount({
      apiCount: apiCount,
      sqlFilePath: 'holdings_count-Analysis_tab.sql',
      userId: userId,
      filterClass: 'Equity',
      testName: 'Equity Holdings Count'
    });

    console.log(result.formattedReport);

    // 4. Attach to test report
    test.info().attach('equity-holdings-count.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 5. Assert exact match
    expect(result.match).toBe(true);
    expect(result.diff).toBe(0);
  });

  // Test 3: Mutual Fund Holdings Count with Filter
  test('Mutual Fund Holdings Count with Filter', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing Mutual Fund Holdings Count ===');

    // 1. Call Analysis Holdings API with MF filter
    const response = await apiClient.get(analysisEndpoints.mfHoldingsCount(userId));

    console.log('\n=== API Response (MF Filter) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract holdings count from API
    const apiCount = response.body?.data?.total_holdings ||
                    response.body?.data?.count ||
                    response.body?.data?.length ||
                    (Array.isArray(response.body?.data) ? response.body.data.length : 0);

    console.log(`\nAPI Holdings Count (Mutual Fund): ${apiCount}`);

    // 3. Compare with SQL
    const result = await compareHoldingsCount({
      apiCount: apiCount,
      sqlFilePath: 'holdings_count-Analysis_tab.sql',
      userId: userId,
      filterClass: 'Mutual Fund',
      testName: 'Mutual Fund Holdings Count'
    });

    console.log(result.formattedReport);

    // 4. Attach to test report
    test.info().attach('mf-holdings-count.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 5. Assert exact match
    expect(result.match).toBe(true);
    expect(result.diff).toBe(0);
  });

  // Test 4: ETF Holdings Count with Filter
  test('ETF Holdings Count with Filter', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing ETF Holdings Count ===');

    // 1. Call Analysis Holdings API with ETF filter
    const response = await apiClient.get(analysisEndpoints.etfHoldingsCount(userId));

    console.log('\n=== API Response (ETF Filter) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract holdings count from API
    const apiCount = response.body?.data?.total_holdings ||
                    response.body?.data?.count ||
                    response.body?.data?.length ||
                    (Array.isArray(response.body?.data) ? response.body.data.length : 0);

    console.log(`\nAPI Holdings Count (ETF): ${apiCount}`);

    // 3. Compare with SQL
    const result = await compareHoldingsCount({
      apiCount: apiCount,
      sqlFilePath: 'holdings_count-Analysis_tab.sql',
      userId: userId,
      filterClass: 'ETF',
      testName: 'ETF Holdings Count'
    });

    console.log(result.formattedReport);

    // 4. Attach to test report
    test.info().attach('etf-holdings-count.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 5. Assert exact match
    expect(result.match).toBe(true);
    expect(result.diff).toBe(0);
  });

  // Test 5: Cash and Bank Balance Holdings Count with Filter
  test('Cash and Bank Balance Holdings Count with Filter', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing Cash and Bank Balance Holdings Count ===');

    // 1. Call Analysis Holdings API with Bank Balance filter
    const response = await apiClient.get(analysisEndpoints.bankBalanceHoldingsCount(userId));

    console.log('\n=== API Response (Bank Balance Filter) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract holdings count from API
    const apiCount = response.body?.data?.total_holdings ||
                    response.body?.data?.count ||
                    response.body?.data?.length ||
                    (Array.isArray(response.body?.data) ? response.body.data.length : 0);

    console.log(`\nAPI Holdings Count (Bank Balance): ${apiCount}`);

    // 3. Compare with SQL
    const result = await compareHoldingsCount({
      apiCount: apiCount,
      sqlFilePath: 'holdings_count-Analysis_tab.sql',
      userId: userId,
      filterClass: 'Bank Balance',
      testName: 'Bank Balance Holdings Count'
    });

    console.log(result.formattedReport);

    // 4. Attach to test report
    test.info().attach('bank-balance-holdings-count.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 5. Assert exact match
    expect(result.match).toBe(true);
    expect(result.diff).toBe(0);
  });

  // Test 6: Recurring Deposits Holdings Count with Filter
  test('Recurring Deposits Holdings Count with Filter', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing Recurring Deposits Holdings Count ===');

    // 1. Call Analysis Holdings API with RD filter
    const response = await apiClient.get(analysisEndpoints.rdHoldingsCount(userId));

    console.log('\n=== API Response (RD Filter) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract holdings count from API
    const apiCount = response.body?.data?.total_holdings ||
                    response.body?.data?.count ||
                    response.body?.data?.length ||
                    (Array.isArray(response.body?.data) ? response.body.data.length : 0);

    console.log(`\nAPI Holdings Count (Recurring Deposit): ${apiCount}`);

    // 3. Compare with SQL
    const result = await compareHoldingsCount({
      apiCount: apiCount,
      sqlFilePath: 'holdings_count-Analysis_tab.sql',
      userId: userId,
      filterClass: 'Recurring Deposit',
      testName: 'Recurring Deposit Holdings Count'
    });

    console.log(result.formattedReport);

    // 4. Attach to test report
    test.info().attach('rd-holdings-count.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 5. Assert exact match
    expect(result.match).toBe(true);
    expect(result.diff).toBe(0);
  });

  // Test 7: NPS Holdings Count with Filter
  test('NPS Holdings Count with Filter', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing NPS Holdings Count ===');

    // 1. Call Analysis Holdings API with NPS filter
    const response = await apiClient.get(analysisEndpoints.npsHoldingsCount(userId));

    console.log('\n=== API Response (NPS Filter) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // 2. Extract holdings count from API
    const apiCount = response.body?.data?.total_holdings ||
                    response.body?.data?.count ||
                    response.body?.data?.length ||
                    (Array.isArray(response.body?.data) ? response.body.data.length : 0);

    console.log(`\nAPI Holdings Count (NPS): ${apiCount}`);

    // 3. Compare with SQL
    const result = await compareHoldingsCount({
      apiCount: apiCount,
      sqlFilePath: 'holdings_count-Analysis_tab.sql',
      userId: userId,
      filterClass: 'NPS',
      testName: 'NPS Holdings Count'
    });

    console.log(result.formattedReport);

    // 4. Attach to test report
    test.info().attach('nps-holdings-count.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // 5. Assert exact match
    expect(result.match).toBe(true);
    expect(result.diff).toBe(0);
  });
});