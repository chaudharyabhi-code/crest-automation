# Crest Automation Playwright - Complete Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Flow](#architecture--flow)
3. [Key Functions & Their Purpose](#key-functions--their-purpose)
4. [How to Add New Test Cases](#how-to-add-new-test-cases)
5. [Environment Configuration](#environment-configuration)
6. [Test Execution Flow](#test-execution-flow)
7. [Troubleshooting Guide](#troubleshooting-guide)

---

## Project Overview

### What This Project Does
This is a **Playwright-based test automation framework** for the Crest fintech application that validates API responses against database calculations. It ensures data consistency between what users see (API) and what's stored in the database.

### Test Categories
1. **Historical Data Tests** - Verify historical data accuracy for trend analysis
2. **Filter Tests** - Validate filtered views across different asset classes
3. **Holdings Count Tests** - Ensure correct count of holdings per asset type

### Key Metrics
- **143 Total Tests** across 10 test files
- **7 Asset Classes** covered (Equity, MF, ETF, Bank Deposits, RD, FD, NPS)
- **8 Test Dates** (current day + 7 historical dates)
- **0.25% Threshold** for value comparisons, **Exact Match** for counts

---

## Architecture & Flow

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Execution Flow                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  1. AUTHENTICATION (Global Setup - Runs Once)               │
│     • Signup user with phone number                         │
│     • Verify OTP                                            │
│     • Get access token                                       │
│     • Save token to .auth/token.json                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. TEST EXECUTION (For Each Test)                          │
│     ┌─────────────────────────────────────────────┐        │
│     │  A. API Call (with authenticated client)    │        │
│     │     • Read token from .auth/token.json      │        │
│     │     • Add Authorization: Bearer header      │        │
│     │     • Make API request                       │        │
│     └─────────────────────────────────────────────┘        │
│                       ↓                                      │
│     ┌─────────────────────────────────────────────┐        │
│     │  B. Extract Value from Response             │        │
│     │     • Parse JSON response                    │        │
│     │     • Navigate nested structure              │        │
│     │     • Extract numeric value                  │        │
│     │     • Handle units (Cr, L, K)               │        │
│     └─────────────────────────────────────────────┘        │
│                       ↓                                      │
│     ┌─────────────────────────────────────────────┐        │
│     │  C. Execute SQL Query                        │        │
│     │     • Load SQL file from queries/           │        │
│     │     • Replace {USER_ID} placeholder         │        │
│     │     • Replace {END_DATE} placeholder        │        │
│     │     • Execute query                          │        │
│     │     • Extract result column                  │        │
│     └─────────────────────────────────────────────┘        │
│                       ↓                                      │
│     ┌─────────────────────────────────────────────┐        │
│     │  D. Compare Values                           │        │
│     │     • Convert units to same format          │        │
│     │     • Calculate difference                   │        │
│     │     • Check threshold (0.25%)               │        │
│     │     • Generate pass/fail result             │        │
│     └─────────────────────────────────────────────┘        │
│                       ↓                                      │
│     ┌─────────────────────────────────────────────┐        │
│     │  E. Assert & Report                          │        │
│     │     • Assert test passes                     │        │
│     │     • Attach comparison details              │        │
│     │     • Log to console                         │        │
│     └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Folder Structure

```
Crest Automation Playwright/
│
├── auth/                          # 🔐 Authentication Layer
│   ├── auth.js                    # Signup + OTP verification logic
│   ├── apiClient.js               # HTTP client with Bearer token
│   └── auth.setup.js              # Global setup (runs once before all tests)
│
├── endpoints/                     # 🌐 API Endpoints Registry
│   ├── dashboard.js               # Dashboard API endpoints
│   ├── analysis.js                # Analysis API endpoints
│   └── index.js                   # Exports all endpoints
│
├── fixtures/                      # 🧪 Test Fixtures
│   └── fixtures.js                # Provides authenticated apiClient to tests
│
├── utils/                         # 🛠️ Utility Functions
│   ├── db/
│   │   └── dbClient.js           # PostgreSQL connection pool
│   ├── comparison.js              # Unit conversion & value comparison
│   ├── testHelpers.js             # Generic test helper functions
│   └── historicalDateHelper.js    # Historical date utilities
│
├── queries/                       # 📊 SQL Query Files
│   ├── historical_allocation_test.sql
│   ├── holdings_count-Analysis_tab.sql
│   └── [other SQL files...]
│
├── tests/                         # ✅ Test Files
│   ├── dashboard/                 # Dashboard feature tests
│   │   ├── historical-asset-allocation.spec.js
│   │   ├── historical-performance-chart.spec.js
│   │   ├── asset-allocation-equity-filter.spec.js
│   │   ├── asset-allocation-mf-filter.spec.js
│   │   ├── asset-allocation-etf-filter.spec.js
│   │   ├── asset-allocation-bank-deposits-filter.spec.js
│   │   ├── asset-allocation-rd-filter.spec.js
│   │   ├── asset-allocation-fd-filter.spec.js
│   │   └── asset-allocation-nps-filter.spec.js
│   └── analysis/                  # Analysis feature tests
│       └── holdings-count.spec.js
│
├── .env                           # 🔒 Environment variables (secrets)
├── .env.example                   # 📋 Template for environment variables
├── playwright.config.js           # ⚙️ Playwright configuration
└── package.json                   # 📦 Project dependencies
```

---

## Key Functions & Their Purpose

### 1. Authentication Functions

#### `auth/auth.js`

**Function: `signup(phoneNumber, fullName, otp)`**
- **Purpose**: Authenticates user and retrieves access token
- **Flow**:
  1. Sends POST request to `/auth/v1/signup` with phone number and name
  2. Sends POST request to `/auth/v1/verify-otp` with OTP
  3. Returns access token
- **Used by**: `auth.setup.js` (global setup)

**Function: `createAuthenticatedClient(token)`**
- **Purpose**: Creates HTTP client with authentication header
- **Returns**: API client with `get()`, `post()`, `put()`, `delete()` methods
- **Used by**: All tests (via fixtures)

---

### 2. Comparison Functions

#### `utils/comparison.js`

**Function: `extractUnitAndValue(str)`**
- **Purpose**: Extracts numeric value and unit from formatted string
- **Input**: `"₹1.21 L"`, `"₹2.3 Cr"`, `"150000"`
- **Output**: `{ value: 1.21, unit: "L" }`
- **Use Case**: Parsing API responses with formatted currency

**Function: `convertToUnit(value, unit)`**
- **Purpose**: Converts raw number to specific unit
- **Input**: `(121495.14, "L")`
- **Output**: `1.2149514`
- **Units Supported**:
  - `Cr` (Crores) = ÷ 10,000,000
  - `L` (Lakhs) = ÷ 100,000
  - `K` (Thousands) = ÷ 1,000

**Function: `compareValues(apiValue, dbValue, thresholdPct)`**
- **Purpose**: Compares two values with threshold tolerance
- **Flow**:
  1. Extract numeric value and unit from API value
  2. Convert DB value to same unit
  3. Calculate percentage difference
  4. Check if difference ≤ threshold
- **Returns**: Object with `pass`, `diff`, `diffPct`, `message`
- **Used by**: All value comparison tests

---

### 3. Test Helper Functions

#### `utils/testHelpers.js`

**Function: `compareApiWithSql(params)`**
- **Purpose**: Generic helper for API vs SQL comparison
- **Parameters**:
  ```javascript
  {
    apiValue: "₹1.21 L",           // Value from API
    sqlFilePath: "query.sql",      // SQL file name
    userId: "1057",                 // User ID
    sqlColumn: "grand_total",      // Column to extract
    threshold: 0.25,               // Comparison threshold
    endDate: "2024-01-01"          // For historical queries
  }
  ```
- **Flow**:
  1. Load SQL file from `queries/` folder
  2. Replace `{USER_ID}` with actual user ID
  3. Replace `{END_DATE}` or `{HISTORICAL_DATES}` with date
  4. Execute SQL query
  5. Extract value from specified column
  6. Compare with API value using `compareValues()`
  7. Generate formatted report
- **Returns**: Object with comparison results and formatted report

**Function: `extractApiValue(responseBody, path, finder)`**
- **Purpose**: Extract value from nested API response
- **Parameters**:
  - `responseBody`: Full API response
  - `path`: Dot-notation path (e.g., "data.summary")
  - `finder`: Function to find item in array
- **Example**:
  ```javascript
  extractApiValue(
    response.body,
    'data.summary',
    item => item.title === 'Total Wealth'
  )
  ```

**Function: `compareHoldingsCount(params)`**
- **Purpose**: Compare holdings count with exact match requirement
- **Parameters**:
  ```javascript
  {
    apiCount: 22,                      // Count from API
    sqlFilePath: "holdings.sql",       // SQL file
    userId: "1057",                    // User ID
    filterClass: "Equity",             // Filter type
  }
  ```
- **Returns**: Object with `match`, `apiCount`, `sqlCount`, `diff`
- **Used by**: Analysis holdings count tests

---

### 4. Historical Date Functions

#### `utils/historicalDateHelper.js`

**Function: `getHistoricalDates()`**
- **Purpose**: Parse historical dates from environment
- **Flow**:
  1. Read `HISTORICAL_DATES` from `.env`
  2. Split by comma
  3. Validate each date format (YYYY-MM-DD)
  4. Return array of valid dates
- **Fallback**: Returns default dates if not configured
- **Used by**: All historical and filter tests

**Function: `validateHistoricalDates()`**
- **Purpose**: Ensure all dates are in the past
- **Returns**: `true` if all dates are valid, `false` if any future dates found
- **Used by**: Test setup to warn about invalid dates

**Function: `createHistoricalSummaryReport(testName, results)`**
- **Purpose**: Generate formatted summary for multiple date tests
- **Input**: Array of test results with `{date, passed, diffPct, error}`
- **Output**: Formatted report string with statistics
- **Used by**: Summary tests

---

### 5. Database Functions

#### `utils/db/dbClient.js`

**Function: `init()`**
- **Purpose**: Initialize PostgreSQL connection pool
- **Configuration**: Uses env vars (DB_HOST, DB_PORT, DB_NAME, etc.)
- **Called by**: `test.beforeAll()` in each test file

**Function: `query(sql, params)`**
- **Purpose**: Execute SQL query and return results
- **Returns**: `{ rows: [...], rowCount: N }`
- **Used by**: `compareApiWithSql()` and `compareHoldingsCount()`

**Function: `close()`**
- **Purpose**: Close database connection
- **Called by**: `test.afterAll()` in each test file

---

## How to Add New Test Cases

### Step-by-Step Guide

#### **Step 1: Identify Test Type**

Choose the appropriate test pattern:

| Test Type | When to Use | Example |
|-----------|-------------|---------|
| **Historical Comparison** | Verify total wealth at specific dates | Historical Asset Allocation |
| **Filter Test** | Compare asset values across filtered/unfiltered views | Equity Filter Tests |
| **Count Test** | Verify exact count of holdings | Analysis Holdings Count |
| **Value Comparison** | Compare specific metric between API and DB | Portfolio Summary |

---

#### **Step 2: Create API Endpoint**

**Location**: `endpoints/dashboard.js` or `endpoints/analysis.js`

**Pattern**:
```javascript
// For filtered endpoints with asset class
assetNameEndpoint: (userId, date) => {
  const assetClassId = process.env.ASSET_CLASS_ID_ASSET_NAME || 'default_id';
  const entityType = process.env.ENTITY_TYPE || 'asset';
  return `/api/v1/path/to/endpoint?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
},

// For simple endpoints
simpleEndpoint: (userId) => `/api/v1/path/to/endpoint?member_user_id=${userId}`,
```

**Example**: Adding a new "Gold" filter endpoint
```javascript
// In endpoints/dashboard.js
goldAssetAllocation: (userId, date) => {
  const assetClassId = process.env.ASSET_CLASS_ID_GOLD || '23';
  const entityType = process.env.ENTITY_TYPE || 'asset';
  return `/api/v1/dashboard/asset-allocation?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
},

goldPerformanceChart: (userId, date) => {
  const assetClassId = process.env.ASSET_CLASS_ID_GOLD || '23';
  const entityType = process.env.ENTITY_TYPE || 'asset';
  return `/api/v1/dashboard/performance-chart?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
},
```

**Don't Forget**: Export the endpoint in `endpoints/index.js` if creating a new category

---

#### **Step 3: Create SQL Query**

**Location**: `queries/`

**Naming Convention**: `descriptive_name.sql` (use underscores, lowercase)

**Pattern**:
```sql
-- Description of what this query does
-- Parameters: {USER_ID}, {END_DATE}, {FILTER_CLASS}

WITH user_ids AS (
    SELECT unnest(ARRAY[{USER_ID}]) AS user_id
),
historical_date AS (
    SELECT '{END_DATE}'::date AS end_date
)

SELECT
    -- Your calculations here
    SUM(column_name) as result_column,
    (SELECT end_date FROM historical_date) as calculation_date
FROM your_table t
JOIN user_ids u ON u.user_id = t.user_id
WHERE t.created_at <= (SELECT end_date FROM historical_date);
```

**Key Points**:
- Use `{USER_ID}` placeholder for user ID
- Use `{END_DATE}` or `{HISTORICAL_DATES}` for date parameters
- Use `{FILTER_CLASS}` for filter parameters
- Always include `WHERE` clause with date filtering for historical queries
- Return clear column names that will be used in tests

**Example**: SQL for Gold allocation
```sql
-- Gold Allocation for Historical Date
WITH user_ids AS (
    SELECT unnest(ARRAY[{USER_ID}]) AS user_id
),
historical_date AS (
    SELECT '{END_DATE}'::date AS end_date
)

SELECT
    COALESCE((
        SELECT SUM(g.current_value)
        FROM gold_holdings g
        JOIN user_ids u ON u.user_id = g.user_id
        CROSS JOIN historical_date hd
        WHERE g.created_at <= hd.end_date
          AND g.current_value > 0
    ), 0) AS gold_total,
    (SELECT end_date FROM historical_date) AS calculation_date;
```

---

#### **Step 4: Create Test File**

**Location**:
- Dashboard tests: `tests/dashboard/`
- Analysis tests: `tests/analysis/`

**Naming Convention**: `feature-name.spec.js` (use hyphens, lowercase)

**Choose Your Test Pattern**:

##### **Pattern A: Historical Value Comparison Test**

```javascript
import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareApiWithSql } from '../../utils/testHelpers.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import { getHistoricalDates } from '../../utils/historicalDateHelper.js';
import { extractUnitAndValue } from '../../utils/comparison.js';

test.describe('Your Test Suite Name', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  const historicalDates = getHistoricalDates();

  historicalDates.forEach(testDate => {
    test(`Test Name for ${testDate}`, async ({ apiClient }) => {
      const userId = process.env.USER_ID;

      // 1. Call API
      const response = await apiClient.get(
        dashboardEndpoints.yourEndpoint(userId, testDate)
      );

      // 2. Extract value from API
      let apiValue = extractValueFromResponse(response.body);

      // 3. Compare with SQL
      const result = await compareApiWithSql({
        apiValue: apiValue.toString(),
        sqlFilePath: 'your_query.sql',
        userId: userId,
        sqlColumn: 'result_column',
        testName: `Your Test - ${testDate}`,
        endDate: testDate
      });

      console.log(result.formattedReport);

      // 4. Attach to report
      test.info().attach(`test-${testDate}.txt`, {
        body: result.formattedReport,
        contentType: 'text/plain'
      });

      // 5. Assert
      expect(result.comparison.pass).toBe(true);
    });
  });
});
```

##### **Pattern B: Filter Test (Two API Comparison)**

```javascript
import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { dashboardEndpoints } from '../../endpoints/index.js';
import { getHistoricalDates } from '../../utils/historicalDateHelper.js';
import { extractUnitAndValue, compareValues } from '../../utils/comparison.js';

test.describe('Asset Filter Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  const getTestDates = () => {
    const historicalDates = getHistoricalDates();
    const today = new Date().toISOString().split('T')[0];
    if (!historicalDates.includes(today)) {
      return [today, ...historicalDates];
    }
    return historicalDates;
  };

  const testDates = getTestDates();

  test.describe('Asset from All Assets View', () => {
    testDates.forEach(testDate => {
      test(`Compare for ${testDate}`, async ({ apiClient }) => {
        const userId = process.env.USER_ID;

        // 1. Get all assets (unfiltered)
        const allAssetsResponse = await apiClient.get(
          dashboardEndpoints.historicalAssetAllocation(userId, testDate)
        );

        // 2. Extract specific asset value
        let assetValue = 0;
        if (Array.isArray(allAssetsResponse.body?.data)) {
          const asset = allAssetsResponse.body.data.find(a =>
            a.name?.toLowerCase() === 'asset_name'
          );
          if (asset) {
            const amount = parseFloat(asset.amount) || 0;
            const unit = asset.unit || '';
            const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
            assetValue = unit ? amount * multipliers[unit] : amount;
          }
        }

        // 3. Get filtered performance chart
        const perfResponse = await apiClient.get(
          dashboardEndpoints.assetPerformanceChart(userId, testDate)
        );

        // 4. Extract performance chart value
        let perfValue = 0;
        if (Array.isArray(perfResponse.body?.data) && perfResponse.body.data.length > 0) {
          const lastPoint = perfResponse.body.data[perfResponse.body.data.length - 1];
          const total = parseFloat(lastPoint.total) || 0;
          const unit = lastPoint.unit || '';
          const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
          perfValue = unit ? total * multipliers[unit] : total;
        }

        // 5. Compare
        const comparison = compareValues(
          assetValue.toString(),
          perfValue,
          parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25')
        );

        // 6. Assert
        expect(comparison.pass).toBe(true);
      });
    });
  });
});
```

##### **Pattern C: Holdings Count Test**

```javascript
import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { compareHoldingsCount } from '../../utils/testHelpers.js';
import { analysisEndpoints } from '../../endpoints/index.js';

test.describe('Holdings Count Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Asset Holdings Count', async ({ apiClient }) => {
    const userId = process.env.USER_ID;

    // 1. Call API
    const response = await apiClient.get(
      analysisEndpoints.assetHoldingsCount(userId)
    );

    // 2. Extract count
    const apiCount = response.body?.data?.length ||
                    response.body?.data?.count || 0;

    // 3. Compare with SQL
    const result = await compareHoldingsCount({
      apiCount: apiCount,
      sqlFilePath: 'holdings_count.sql',
      userId: userId,
      filterClass: 'Asset Name',
      testName: 'Asset Holdings Count'
    });

    // 4. Assert exact match
    expect(result.match).toBe(true);
    expect(result.diff).toBe(0);
  });
});
```

---

#### **Step 5: Update Environment Variables**

**Location**: `.env.example` (template) and your `.env` (actual config)

Add any new configuration needed:

```env
# If adding new asset class
ASSET_CLASS_ID_GOLD=23

# If adding new filter
FILTER_TYPE_CUSTOM=value
```

---

#### **Step 6: Run and Verify Tests**

```bash
# Run your new test file
npx playwright test tests/dashboard/your-new-test.spec.js

# Run with UI for debugging
npx playwright test tests/dashboard/your-new-test.spec.js --ui

# Run specific test
npx playwright test tests/dashboard/your-new-test.spec.js -g "test name"

# View HTML report
npm run report
```

---

## Environment Configuration

### Required Variables

```env
# Authentication - REQUIRED
USER_ID=1057                    # Your test user ID
PHONE_NUMBER=9876543210         # Phone for authentication
FULL_NAME=Test User             # User display name
OTP=1111                        # OTP for verification

# Database - REQUIRED
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crest_db
DB_USER=postgres
DB_PASSWORD=yourpassword

# Testing - REQUIRED
HISTORICAL_DATES=2026-01-01,2025-01-01,2024-01-01,2023-01-01,2022-01-01,2021-01-01,2020-01-01
```

### Optional Variables (with defaults)

```env
# Comparison threshold (default: 0.25)
COMPARISON_THRESHOLD_PCT=0.25

# Asset Class IDs (defaults provided)
ASSET_CLASS_ID_RECURRING_DEPOSITS=14
ASSET_CLASS_ID_FIXED_DEPOSITS=15
ASSET_CLASS_ID_NPS=16
ASSET_CLASS_ID_EQUITY=17
ASSET_CLASS_ID_ETF=18
ASSET_CLASS_ID_MUTUAL_FUNDS=21
ASSET_CLASS_ID_BANK_DEPOSITS=22

# Entity type (default: asset)
ENTITY_TYPE=asset
```

---

## Test Execution Flow

### Sequential Execution

#### Phase 1: Global Setup (Runs Once)
```
1. Load .env file
2. Read PHONE_NUMBER, FULL_NAME, OTP from env
3. Call /auth/v1/signup API
4. Call /auth/v1/verify-otp API
5. Receive access_token
6. Save token to .auth/token.json
7. Set process.env.ACCESS_TOKEN
```

#### Phase 2: Test Initialization (Per Test File)
```
1. Import fixtures (provides authenticated apiClient)
2. test.beforeAll():
   - Initialize database connection
   - Validate historical dates (if applicable)
3. Load test dates from HISTORICAL_DATES env var
```

#### Phase 3: Individual Test Execution (Per Test)
```
1. Get userId from process.env.USER_ID
2. Make API call using apiClient (with Bearer token)
3. Parse and extract value from API response
4. Load SQL query from queries/ folder
5. Replace placeholders:
   - {USER_ID} → actual user ID
   - {END_DATE} → test date
   - {FILTER_CLASS} → filter type
6. Execute SQL query
7. Extract value from SQL result
8. Compare values:
   - For value tests: Check if diff ≤ 0.25%
   - For count tests: Check exact match
9. Generate formatted report
10. Attach report to test
11. Assert result
```

#### Phase 4: Test Cleanup (Per Test File)
```
1. test.afterAll():
   - Close database connection
   - Clean up resources
```

---

## Detailed Test Flow Examples

### Example 1: Historical Asset Allocation Test

**Goal**: Verify total wealth for a historical date

**Flow**:
```
1. Loop through each date in HISTORICAL_DATES
   For date "2024-01-01":

2. Call Asset Allocation API
   GET /api/v1/dashboard/asset-allocation?member_user_id=1057&from_date=2024-01-01&to_date=2024-01-01

3. Parse API Response
   {
     "data": [
       { "name": "Cash", "amount": 39.62, "unit": "K" },
       { "name": "Equity", "amount": 97.01, "unit": "K" },
       { "name": "Mutual Funds", "amount": 47.55, "unit": "K" }
     ]
   }

4. Sum All Assets
   Cash:    39.62 K = 39,620
   Equity:  97.01 K = 97,010
   MF:      47.55 K = 47,550
   Total:   184,180

5. Execute SQL
   Load: queries/historical_allocation_test.sql
   Replace: {USER_ID} → 1057
   Replace: {HISTORICAL_DATES} → '2024-01-01'
   Execute query
   Result: { grand_total: 184187.58 }

6. Compare
   API:  184,180
   DB:   184,187.58
   Diff: -7.58
   %:    0.00% (≤ 0.25% ✅)

7. Assert
   expect(result.comparison.pass).toBe(true) ✅
```

---

### Example 2: Equity Filter Test

**Goal**: Verify equity value consistency across APIs

**Flow**:
```
1. Test Date: 2026-04-12

2. Call Asset Allocation API (ALL assets)
   GET /api/v1/dashboard/asset-allocation?member_user_id=1057&from_date=2026-04-12&to_date=2026-04-12

3. Extract ONLY Equity from Response
   Find asset where name === 'Equity'
   Amount: 95.19 K
   Convert: 95.19 × 1000 = 95,190

4. Call Performance Chart API (Equity filter)
   GET /api/v1/dashboard/performance-chart?member_user_id=1057&asset_class_id=17&entity_type=asset&from_date=2026-04-12&to_date=2026-04-12

5. Extract Latest Chart Value
   Get last item from data array
   Total: 95190.44
   Unit: "" (empty, already in rupees)
   Value: 95,190.44

6. Compare
   From All Assets: 95,190
   From Perf Chart: 95,190.44
   Diff: -0.44
   %:    0.00% (≤ 0.25% ✅)

7. Assert
   expect(comparison.pass).toBe(true) ✅
```

---

### Example 3: Holdings Count Test

**Goal**: Verify exact count of equity holdings

**Flow**:
```
1. Call Analysis Holdings API (Equity filter)
   GET /api/v1/analysis/holdings?member_user_id=1057&asset_class_id=17&entity_type=asset

2. Count Holdings in Response
   Response has 20 items in data array
   apiCount = 20

3. Execute SQL
   Load: queries/holdings_count-Analysis_tab.sql
   Replace: {USER_ID} → 1057
   Replace: 'ALL' AS filter_class → 'Equity' AS filter_class
   Execute query
   Result: { count: 20 }

4. Compare
   API Count: 20
   DB Count:  20
   Match: ✅ Exact

5. Assert
   expect(result.match).toBe(true) ✅
   expect(result.diff).toBe(0) ✅
```

---

## Working with the Project

### Daily Workflow

#### 1. **Setting Up**
```bash
# Clone/pull latest code
git pull

# Install dependencies
npm install

# Configure .env file (one time)
cp .env.example .env
# Edit .env with your actual values

# Verify database connection
# Make sure your PostgreSQL is running and accessible
```

#### 2. **Running Tests**
```bash
# Run all tests
npm test

# Run specific suite
npm run test:dashboard
npm run test:analysis

# Run specific test file
npx playwright test tests/dashboard/historical-asset-allocation.spec.js

# Run with UI mode (best for debugging)
npx playwright test --ui

# Run specific date
npx playwright test tests/dashboard/historical-asset-allocation.spec.js -g "2024-01-01"
```

#### 3. **Debugging Failed Tests**
```bash
# Run in debug mode
npm run test:debug tests/dashboard/your-test.spec.js

# Run in headed mode (see browser)
npm run test:headed tests/dashboard/your-test.spec.js

# Check HTML report
npm run report
```

#### 4. **Adding New Tests**
```
1. Create endpoint in endpoints/
2. Create SQL in queries/
3. Create test file in tests/
4. Run test to verify
5. Commit changes
```

---

## Quick Reference: API Response Structures

### Asset Allocation API Response
```json
{
  "data": [
    {
      "name": "Equity",
      "amount": 97.01,
      "unit": "K",
      "value": 52.67
    }
  ],
  "status": 200,
  "message": "Asset allocation retrieved successfully"
}
```
**How to extract**:
- Sum all: Loop through `data` array, sum `amount` values
- Single asset: Find asset by `name`, get `amount`

### Performance Chart API Response
```json
{
  "data": [
    {
      "timelabel": "Thu",
      "date": "2026-01-01",
      "day": "Thursday",
      "total": 1.84,
      "unit": "L"
    }
  ],
  "status": 200
}
```
**How to extract**:
- Latest value: Get last item in `data` array, use `total` field

### Analysis Holdings API Response
```json
{
  "data": [
    {
      "id": "equity_2900",
      "metric_name": "Stock Name",
      "metric_type": "Equity",
      "metric_value": 17824,
      "quantity": 64
    }
  ]
}
```
**How to extract**:
- Count: `data.length`
- Individual values: Loop through `data` array

---

## Common Patterns & Best Practices

### 1. **Unit Conversion Pattern**
```javascript
// Always use this pattern for converting units
const amount = parseFloat(asset.amount) || 0;
const unit = asset.unit || '';

let rupeeValue = amount;
if (unit) {
  const multipliers = { 'Cr': 10000000, 'L': 100000, 'K': 1000 };
  rupeeValue = amount * (multipliers[unit] || 1);
}
```

### 2. **Finding Specific Asset Pattern**
```javascript
// Always use case-insensitive search
const asset = data.find(a =>
  a.name?.toLowerCase() === 'equity' ||
  a.name?.toLowerCase().includes('equity')
);
```

### 3. **Getting Latest Chart Value Pattern**
```javascript
// Always get the LAST item from chart data
if (Array.isArray(data) && data.length > 0) {
  const lastPoint = data[data.length - 1];
  const value = parseFloat(lastPoint.total) || 0;
}
```

### 4. **Test Dates Pattern**
```javascript
// Always include current day + historical dates for filter tests
const getTestDates = () => {
  const historicalDates = getHistoricalDates();
  const today = new Date().toISOString().split('T')[0];
  if (!historicalDates.includes(today)) {
    return [today, ...historicalDates];
  }
  return historicalDates;
};
```

---


## File Naming Conventions

### Test Files
- Use hyphens: `historical-asset-allocation.spec.js`
- Describe what's tested: `asset-allocation-equity-filter.spec.js`
- Always end with `.spec.js`

### SQL Files
- Use underscores: `historical_allocation_test.sql`
- Descriptive name: `holdings_count-Analysis_tab.sql`
- Always end with `.sql`

### Utility Files
- Camel case: `historicalDateHelper.js`
- Describe purpose: `testHelpers.js`
- Always end with `.js`

---

