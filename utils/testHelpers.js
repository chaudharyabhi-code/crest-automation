import { compareValues } from './comparison.js';
import { dbClient } from './db/dbClient.js';
import fs from 'fs';
import path from 'path';

/**
 * Generic helper for API vs SQL comparison tests
 *
 * @param {object} params - Test parameters
 * @param {string} params.apiValue - Value from API (e.g., "₹1.21 L" or "10.53%")
 * @param {string} params.sqlFilePath - Path to SQL file (relative to utils/db/queries/)
 * @param {string} params.userId - User ID for SQL query replacement
 * @param {string} params.sqlColumn - Column name to extract from SQL result
 * @param {number} params.threshold - Comparison threshold % (default: from env or 0.25)
 * @param {string} params.testName - Name for logging
 * @param {boolean} params.isPercentage - Whether the API value is a percentage (default: false)
 * @param {string} params.endDate - End date for historical queries (optional)
 * @returns {object} Comparison result with all details
 */
export async function compareApiWithSql({
  apiValue,
  sqlFilePath,
  userId,
  sqlColumn,
  threshold = null,
  testName = 'API vs SQL Comparison',
  isPercentage = false,
  endDate = null
}) {
  // Use env threshold if not provided
  const comparisonThreshold = threshold ?? parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');

  // Load and execute SQL query
  const fullSqlPath = sqlFilePath.startsWith('/')
    ? sqlFilePath
    : path.join(process.cwd(), 'queries', sqlFilePath);

  let sqlQuery = fs.readFileSync(fullSqlPath, 'utf-8');
  sqlQuery = sqlQuery.replace(/{USER_ID}/g, userId);

  // Replace date placeholders if endDate is provided (for historical queries)
  if (endDate) {
    sqlQuery = sqlQuery.replace(/{END_DATE}/g, endDate);
    sqlQuery = sqlQuery.replace(/{HISTORICAL_DATES}/g, `'${endDate}'`);  // Add quotes for SQL timestamp
  }

  const dbResult = await dbClient.query(sqlQuery);
  const sqlValue = dbResult.rows[0]?.[sqlColumn];

  if (sqlValue === undefined || sqlValue === null) {
    throw new Error(`SQL column '${sqlColumn}' not found in result. Available: ${Object.keys(dbResult.rows[0] || {}).join(', ')}`);
  }

  // Perform comparison
  const comparison = compareValues(apiValue, sqlValue, comparisonThreshold);

  // Format unit label
  const unitLabel = comparison.apiUnit === 'L' ? 'L' :
                    comparison.apiUnit === 'K' ? 'K' :
                    comparison.apiUnit === 'Cr' ? 'Cr' :
                    '';

  // Build report
  const dbRoundedFormatted = comparison.dbRounded.toFixed(2);

  // Different report format for percentage vs monetary values
  const formattedReport = isPercentage
    ? `
=== ${testName} ===
API Value (UI):             ${apiValue}%
DB Value:                   ${dbRoundedFormatted}%
Difference:                 ${comparison.diff.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                  ${comparisonThreshold}%
Result:                     ${comparison.message}
`
    : `
=== ${testName} ===
API Value (UI):             ${apiValue}
SQL Value (DB raw):         ₹${sqlValue}
DB Rounded:                 ₹${dbRoundedFormatted} ${unitLabel}
Difference:                 ${comparison.diff.toFixed(2)} (${comparison.diffPct?.toFixed(2)}%)
Threshold:                  ${comparisonThreshold}%
Result:                     ${comparison.message}
`;

  const report = {
    testName,
    apiValue,
    sqlValue,
    sqlColumn,
    comparison,
    unitLabel,
    dbRoundedFormatted,
    formattedReport
  };

  return report;
}

/**
 * Extract value from nested API response
 * 
 * @param {object} responseBody - API response body
 * @param {string} path - Dot-notation path to value (e.g., "data.summary" or "data.portfolio.value")
 * @param {function} finder - Function to find specific item in array (item => item.title === 'X')
 * @returns {any} Extracted value
 */
export function extractApiValue(responseBody, path, finder = null) {
  const parts = path.split('.');
  let current = responseBody;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  if (finder && Array.isArray(current)) {
    const item = current.find(finder);
    return item?.value !== undefined ? item.value : item;
  }

  return current;
}

/**
 * Run multiple comparisons in a single test
 *
 * @param {Array} comparisons - Array of comparison configs
 * @returns {object} Summary of all comparisons
 */
export async function runMultipleComparisons(comparisons) {
  const results = [];
  let allPassed = true;

  for (const config of comparisons) {
    const result = await compareApiWithSql(config);
    console.log(result.formattedReport);
    results.push(result);

    if (!result.comparison.pass) {
      allPassed = false;
    }
  }

  return {
    allPassed,
    results,
    summary: `
=== Test Summary ===
Total Comparisons: ${results.length}
Passed: ${results.filter(r => r.comparison.pass).length}
Failed: ${results.filter(r => !r.comparison.pass).length}
`
  };
}

/**
 * Compare holdings count - expects exact match
 *
 * @param {object} params - Test parameters
 * @param {number} params.apiCount - Count from API
 * @param {string} params.sqlFilePath - Path to SQL file
 * @param {string} params.userId - User ID
 * @param {string} params.filterClass - Filter class for SQL (ALL, Equity, etc.)
 * @param {string} params.testName - Name for logging
 * @returns {object} Comparison result
 */
export async function compareHoldingsCount({
  apiCount,
  sqlFilePath,
  userId,
  filterClass,
  testName = 'Holdings Count Comparison'
}) {
  // Load and execute SQL query
  const fullSqlPath = sqlFilePath.startsWith('/')
    ? sqlFilePath
    : path.join(process.cwd(), 'queries', sqlFilePath);

  let sqlQuery = fs.readFileSync(fullSqlPath, 'utf-8');
  sqlQuery = sqlQuery.replace(/{USER_ID}/g, userId);
  sqlQuery = sqlQuery.replace(/{FILTER_CLASS}/g, filterClass);
  // Also replace the hardcoded 'ALL' in the params CTE with the actual filter class
  sqlQuery = sqlQuery.replace(/'ALL' AS filter_class/g, `'${filterClass}' AS filter_class`);

  const dbResult = await dbClient.query(sqlQuery);
  const sqlCount = parseInt(dbResult.rows[0]?.holdings_count || dbResult.rows[0]?.count) || 0;

  // Compare counts - must be exact match
  const match = apiCount === sqlCount;
  const diff = apiCount - sqlCount;

  const formattedReport = `
=== ${testName} ===
Filter:                 ${filterClass}
API Holdings Count:     ${apiCount}
DB Holdings Count:      ${sqlCount}
Difference:             ${diff}
Result:                 ${match ? '✅ Exact Match' : '❌ Mismatch'}
`;

  return {
    match,
    apiCount,
    sqlCount,
    diff,
    filterClass,
    formattedReport
  };
}

/**
 * Compare dividends count - expects exact match
 *
 * @param {object} params - Test parameters
 * @param {number} params.apiCount - Count from API (length of data array)
 * @param {string} params.sqlFilePath - Path to SQL file
 * @param {string} params.userId - User ID
 * @param {string} params.testName - Name for logging
 * @returns {object} Comparison result
 */
export async function compareDividendsCount({
  apiCount,
  sqlFilePath,
  userId,
  testName = 'Dividends Count Comparison'
}) {
  // Load and execute SQL query
  const fullSqlPath = sqlFilePath.startsWith('/')
    ? sqlFilePath
    : path.join(process.cwd(), 'queries', sqlFilePath);

  let sqlQuery = fs.readFileSync(fullSqlPath, 'utf-8');
  sqlQuery = sqlQuery.replace(/{USER_ID}/g, userId);

  const dbResult = await dbClient.query(sqlQuery);
  const sqlCount = parseInt(dbResult.rows[0]?.total_count) || 0;

  // Compare counts - must be exact match
  const match = apiCount === sqlCount;
  const diff = apiCount - sqlCount;

  const formattedReport = `
=== ${testName} ===
API Dividends Count:    ${apiCount}
DB Dividends Count:     ${sqlCount}
Difference:             ${diff}
Result:                 ${match ? '✅ Exact Match' : '❌ Mismatch'}
`;

  return {
    match,
    apiCount,
    sqlCount,
    diff,
    formattedReport
  };
}

/**
 * Validate benchmark as_of_date is today's date
 *
 * @param {object} params - Test parameters
 * @param {string} params.sqlFilePath - Path to SQL file
 * @param {string} params.testName - Name for logging
 * @returns {object} Validation result
 */
export async function validateBenchmarkDate({
  sqlFilePath,
  testName = 'Benchmark Date Validation'
}) {
  // Load and execute SQL query
  const fullSqlPath = sqlFilePath.startsWith('/')
    ? sqlFilePath
    : path.join(process.cwd(), 'queries', sqlFilePath);

  const sqlQuery = fs.readFileSync(fullSqlPath, 'utf-8');
  const dbResult = await dbClient.query(sqlQuery);

  // Get today's date in YYYY-MM-DD format using local timezone
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Debug logging
  console.log(`\n[DEBUG] Today's date (Local): ${today}`);
  console.log(`[DEBUG] Total rows from SQL: ${dbResult.rows.length}`);

  // Check if all rows have today's date
  const dateComparisons = [];
  let allDatesValid = true;

  const dateDetails = dbResult.rows.map((row, index) => {
    // Handle different date formats from PostgreSQL
    // Use local date conversion to avoid timezone issues
    let rowDate;

    if (row.as_of_date instanceof Date) {
      // If it's already a Date object, use local date parts
      const d = row.as_of_date;
      rowDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (typeof row.as_of_date === 'string') {
      // If it's a string, just take the date part (YYYY-MM-DD)
      rowDate = row.as_of_date.split('T')[0];
    } else {
      // Fallback: convert to date using local timezone
      const d = new Date(row.as_of_date);
      rowDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const isMatch = rowDate === today;
    if (!isMatch) allDatesValid = false;

    // Debug logging for each row
    console.log(`[DEBUG] Row ${index + 1} - ${row.name}: raw=${row.as_of_date}, parsed=${rowDate}, match=${isMatch}`);

    dateComparisons.push({
      name: row.name,
      rawDate: row.as_of_date,
      parsedDate: rowDate,
      isMatch
    });

    return `  ${index + 1}. ${row.name}: ${rowDate} ${isMatch ? '✅' : '❌ (expected: ' + today + ')'}`;
  }).join('\n');

  const formattedReport = `
=== ${testName} ===
Expected Date (Today):  ${today}
Total Records:          ${dbResult.rows.length}
All Dates Match:        ${allDatesValid ? '✅ Yes' : '❌ No'}

Date Details:
${dateDetails}
`;

  return {
    valid: allDatesValid,
    expectedDate: today,
    totalRecords: dbResult.rows.length,
    rows: dbResult.rows,
    dateComparisons,
    formattedReport
  };
}

/**
 * Compare benchmark performance values between API and SQL
 * Requires EXACT match - no threshold allowed
 *
 * @param {object} params - Test parameters
 * @param {Array} params.apiData - API response data array
 * @param {string} params.sqlFilePath - Path to SQL file
 * @param {string} params.testName - Name for logging
 * @returns {object} Comparison result
 */
export async function compareBenchmarkValues({
  apiData,
  sqlFilePath,
  testName = 'Benchmark Values Comparison'
}) {
  // Load and execute SQL query
  const fullSqlPath = sqlFilePath.startsWith('/')
    ? sqlFilePath
    : path.join(process.cwd(), 'queries', sqlFilePath);

  const sqlQuery = fs.readFileSync(fullSqlPath, 'utf-8');
  const dbResult = await dbClient.query(sqlQuery);

  // Create a map of SQL data by name for easy lookup
  const sqlMap = {};
  dbResult.rows.forEach(row => {
    sqlMap[row.name] = {
      y1: parseFloat(row.y1),
      y2: parseFloat(row.y2),
      y3: parseFloat(row.y3),
      y4: parseFloat(row.y4),
      y5: parseFloat(row.y5)
    };
  });

  const comparisons = [];
  let allMatch = true;

  // Compare each benchmark
  apiData.forEach(apiBenchmark => {
    const name = apiBenchmark.name;
    const sqlBenchmark = sqlMap[name];

    if (!sqlBenchmark) {
      comparisons.push({
        name,
        status: '❌ Not found in SQL',
        match: false
      });
      allMatch = false;
      return;
    }

    // Parse API values (remove "+" and "%" signs)
    const apiValues = {
      y1: parseFloat(apiBenchmark.values['1Y'].replace(/[+%]/g, '')),
      y2: parseFloat(apiBenchmark.values['2Y'].replace(/[+%]/g, '')),
      y3: parseFloat(apiBenchmark.values['3Y'].replace(/[+%]/g, '')),
      y4: parseFloat(apiBenchmark.values['4Y'].replace(/[+%]/g, '')),
      y5: parseFloat(apiBenchmark.values['5Y'].replace(/[+%]/g, ''))
    };

    // Compare each year - EXACT match required
    const yearComparisons = [];
    ['y1', 'y2', 'y3', 'y4', 'y5'].forEach(year => {
      const apiVal = apiValues[year];
      const sqlVal = sqlBenchmark[year];
      const diff = Math.abs(apiVal - sqlVal);
      const match = apiVal === sqlVal; // Exact match required

      yearComparisons.push({
        year,
        apiValue: apiVal,
        sqlValue: sqlVal,
        diff: diff.toFixed(2),
        match
      });

      if (!match) {
        allMatch = false;
      }
    });

    comparisons.push({
      name,
      yearComparisons,
      allYearsMatch: yearComparisons.every(yc => yc.match)
    });
  });

  // Build formatted report
  let reportDetails = '';
  comparisons.forEach(comp => {
    reportDetails += `\n${comp.name}:\n`;
    if (comp.status) {
      reportDetails += `  ${comp.status}\n`;
    } else {
      comp.yearComparisons.forEach(yc => {
        const yearLabel = yc.year.toUpperCase();
        const status = yc.match ? '✅' : '❌';
        reportDetails += `  ${yearLabel}: API=${yc.apiValue.toFixed(2)}%, SQL=${yc.sqlValue.toFixed(2)}%, Diff=${yc.diff}% ${status}\n`;
      });
      reportDetails += `  Overall: ${comp.allYearsMatch ? '✅ All Match' : '❌ Some Mismatch'}\n`;
    }
  });

  const formattedReport = `
=== ${testName} ===
Match Type:             Exact Match Required (No Threshold)
Total Benchmarks:       ${comparisons.length}
All Values Match:       ${allMatch ? '✅ Yes' : '❌ No'}
${reportDetails}
`;

  return {
    match: allMatch,
    comparisons,
    formattedReport
  };
}
