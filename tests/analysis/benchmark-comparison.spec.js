import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { validateBenchmarkDate, compareBenchmarkValues } from '../../utils/testHelpers.js';
import { analysisEndpoints } from '../../endpoints/index.js';

test.describe('Analysis Benchmark Comparison Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  // Test 1: Validate all as_of_date are today's date
  test('Benchmark as_of_date Validation - All dates should be today', async () => {
    console.log('\n=== Testing Benchmark as_of_date Validation ===');

    const result = await validateBenchmarkDate({
      sqlFilePath: 'benchmark_comparison.sql',
      testName: 'Benchmark Date Validation'
    });

    console.log(result.formattedReport);

    // Attach to test report
    test.info().attach('benchmark-date-validation.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // Assert all dates are today
    expect(result.valid).toBe(true);
  });

  // Test 2: Compare benchmark values (Y1, Y2, Y3, Y4, Y5) between API and SQL
  test('Benchmark Values Comparison - API vs SQL', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    console.log('\n=== Testing Benchmark Values Comparison ===');

    // Call the API
    const response = await apiClient.get(analysisEndpoints.benchmarkComparison(userId));

    console.log('\n=== API Response (Benchmark Comparison) ===');
    console.log(JSON.stringify(response.body, null, 2));

    // Extract data from API response
    const apiData = response.body?.data || [];

    console.log(`\nTotal Benchmarks in API: ${apiData.length}`);

    // Compare with SQL
    const result = await compareBenchmarkValues({
      apiData: apiData,
      sqlFilePath: 'benchmark_comparison.sql',
      threshold: 0.01, // 0.01% threshold
      testName: 'Benchmark Values Comparison'
    });

    console.log(result.formattedReport);

    // Attach to test report
    test.info().attach('benchmark-values-comparison.txt', {
      body: result.formattedReport,
      contentType: 'text/plain'
    });

    // Assert all values match within threshold
    expect(result.match).toBe(true);
  });
});
