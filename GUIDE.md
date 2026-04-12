# Production-Ready Playwright Automation Guide

Complete guide for API vs SQL validation testing with Playwright.

---

## 📁 Folder Structure

```
auth/                          # 🔐 Authentication Layer
├── auth.js                    # Signup + verify-otp logic, gets access_token
├── apiClient.js               # HTTP client with Authorization: Bearer header
└── auth.setup.js              # Global setup - runs once before ALL tests

endpoints/                     # �� API Endpoints Registry
├── dashboard.js               # Dashboard-related API URLs
└── index.js                   # Exports all endpoint categories

fixtures/                      # 🧪 Test Fixtures
└── fixtures.js                # Provides authenticated apiClient to every test

utils/                         # 🛠️ Utilities
├── db/
│   ├── dbClient.js            # PostgreSQL connection pool
├── comparison.js              # Unit conversion (Cr/Lac/K → raw numbers)
└── testHelpers.js              # Generic compareApiWithSql() function

tests/                         # ✅ ONLY Test Files (.spec.js)
└── Dashboard/
    └── portfolio-summary.spec.js    # Your working test example

playwright.config.js           # ⚙️ Playwright configuration
.env                           # 🔒 Environment variables (DB, API, user)
GUIDE.md                       # 📖 Documentation
```

## 📖 File-by-File Explanation

### auth/auth.js
- Signs up user with phone_number, full_name
- Verifies OTP, gets access_token
- Used by auth.setup.js

### auth/apiClient.js
- Creates HTTP client with Authorization: Bearer <token> header
- Provides get(), post(), put(), delete() methods

### auth/auth.setup.js
- Runs once before all tests
- Authenticates user, saves token to .auth/token.json
- Sets process.env.ACCESS_TOKEN

### fixtures/fixtures.js
- Extends Playwright's test with apiClient
- Every test gets authenticated client automatically

### endpoints/dashboard.js
- Centralized API URLs
- Example: portfolioSummary: (userId) => /api/v1/dashboard/portfolio-summary?member_user_id=${userId}

### utils/db/dbClient.js
- PostgreSQL pool connection
- Uses env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

### utils/comparison.js
- extractUnitAndValue("₹1.21 L") → { value: 1.21, unit: "L" }
- convertToUnit(121495.14, "L") → 1.2149514
- compareValues(api, db, threshold) → comparison result

### utils/testHelpers.js
- compareApiWithSql({ apiValue, sqlFilePath, userId, sqlColumn }) → full comparison
- extractApiValue(response, path, finder) → extracts value from nested response
- Returns formatted report with ₹ symbols

### tests/Dashboard/portfolio-summary.spec.js
- Imports fixture, calls API, extracts value, compares with SQL, asserts

## Is This Production-Ready? YES

✅ Separation of Concerns: Auth, endpoints, fixtures, utils, tests - each has single responsibility
✅ DRY Principle: No duplicate code, everything reusable
✅ Scalable: Easy to add 40-50 more tests
✅ Maintainable: Change endpoint URL in one place
✅ Configurable: All secrets in .env
✅ Testable: Run by folder: npx playwright test tests/Dashboard/
✅ Reporting: HTML report with attachments
✅ Authentication: Centralized, runs once, token reused

## Minor Suggestions for Future

| Addition | When Needed |
|----------|-------------|
| tests/Holdings/, tests/Analysis/ folders | When you have 20+ tests |
| endpoints/holdings.js, endpoints/analysis.js | More endpoint categories |
| utils/validators.js | Custom validation beyond comparison |
| config/environments.js | Test against dev/staging/prod |

Current structure handles your 40-50 test cases perfectly.

## ⚠️ Files/Folders NOT to Touch

| File/Folder | Why Not to Touch |
|-------------|------------------|
| `auth/` folder | Core authentication logic - already working |
| `auth/auth.js` | Signup & OTP verification - don't modify |
| `auth/apiClient.js` | HTTP client with auth headers - don't modify |
| `auth/auth.setup.js` | Global setup runs before all tests - don't modify |
| `fixtures/fixtures.js` | Provides authenticated client - don't modify |
| `utils/comparison.js` | Unit conversion logic (Cr/Lac/K) - don't modify |
| `utils/testHelpers.js` | Generic comparison functions - don't modify |
| `utils/db/dbClient.js` | Database connection - don't modify |
| `playwright.config.js` | Playwright configuration - don't modify |

### ✅ Only Create/Modify These:

| Location | What to Do |
|----------|------------|
| `endpoints/*.js` | Add new endpoint URLs for your APIs |
| `tests/**/*.spec.js` | Create new test files (copy pattern from existing) |
| `utils/db/queries/*.sql` | Add new SQL files for validation |
| `.env` | Update environment variables if needed |
