/**
 * Unit-driven comparison utility for financial values
 * Compares API values (formatted with units like "1.13 Cr") with DB raw numbers
 */

/**
 * Extract unit and numeric value from API formatted string
 * Examples:
 *   "₹8.93 K" → { value: 8.93, unit: "K" }
 *   "₹1.5 L"  → { value: 1.5, unit: "L" }
 *   "₹2.3 Cr" → { value: 2.3, unit: "Cr" }
 *   "150000"  → { value: 150000, unit: null }
 *
 * @param {string|number} str - API value string
 * @returns {Object} { value: number, unit: string|null }
 */
export function extractUnitAndValue(str) {
    if (!str || str === '-') return { value: 0, unit: null };
    if (typeof str === 'number') return { value: str, unit: null };

    const cleaned = str.toString().replace(/[₹,]/g, '').trim();

    let unit = null;
    if (cleaned.includes('Cr') || cleaned.includes('CR'))     unit = 'Cr';
    else if (/ L|L$/.test(cleaned))                           unit = 'L';
    else if (/ K|K$/.test(cleaned))                           unit = 'K';

    const numStr = cleaned.replace(/[^0-9.\-]/g, '');
    const value = parseFloat(numStr) || 0;

    return { value, unit };
}

/**
 * Convert a raw number to a specific unit
 * @param {number} value - Raw number (e.g., 11300000)
 * @param {string|null} unit - Target unit ("Cr", "Lac", "K", or null)
 * @returns {number} Converted value
 */
export function convertToUnit(value, unit) {
    if (!unit) {
        return value;
    }

    switch (unit.toLowerCase()) {
        case 'cr':
            return value / 10000000;

        case 'lac':
        case 'l':
            return value / 100000;

        case 'k':
            return value / 1000;

        default:
            return value;
    }
}

/**
 * Compare two values: one from API (formatted), one from DB (raw number)
 * @param {string|number} apiValue - Value from API (e.g., "1.13 Cr")
 * @param {number} dbValue - Raw number from database
 * @param {number} thresholdPct - Acceptable difference percentage (default: 0.25)
 * @returns {object} Comparison result
 */
export function compareValues(apiValue, dbValue, thresholdPct = 0.25) {
    if (!apiValue || dbValue === null || dbValue === undefined) {
        return {
            pass: false,
            apiValue,
            dbValue,
            apiUnit: null,
            apiNumeric: null,
            dbConverted: null,
            diff: null,
            diffPct: null,
            message: 'Missing value for comparison'
        };
    }

    const { value: apiNumeric, unit: apiUnit } = extractUnitAndValue(apiValue);
    const dbConverted = convertToUnit(dbValue, apiUnit);

    const apiRounded = Math.round(apiNumeric * 100) / 100;
    const dbRounded = Math.round(dbConverted * 100) / 100;

    const diff = apiRounded - dbRounded;
    const diffPct = dbRounded !== 0
        ? Math.abs((diff / dbRounded) * 100)
        : (apiRounded !== 0 ? 100 : 0);

    const pass = diffPct <= thresholdPct;

    return {
        pass,
        apiValue,
        dbValue,
        apiUnit,
        apiNumeric,
        dbConverted,
        apiRounded,
        dbRounded,
        diff,
        diffPct,
        message: pass ? '✅ Match' : `❌ Mismatch: ${diffPct.toFixed(2)}%`
    };
}

/**
 * Log comparison result in formatted way
 * @param {string} label - Label for the comparison
 * @param {object} result - Result from compareValues
 */
export function logComparison(label, result) {
    console.log(`\n${label}:`);
    console.log(`   API Value: ${result.apiValue} → ${result.apiRounded} ${result.apiUnit || ''}`);
    console.log(`   DB Value:  ${result.dbValue} → ${result.dbRounded} ${result.apiUnit || ''}`);
    console.log(`   Diff: ${result.diff} (${result.diffPct?.toFixed(2) || 'N/A'}%)`);
    console.log(`   ${result.message}`);
}

/**
 * Unit multipliers for converting to base rupee value
 */
export const DIVISORS = {
    'Cr': 10000000,
    'L': 100000,
    'K': 1000,
    'cr': 10000000,
    'l': 100000,
    'k': 1000
};

/**
 * Sum values with different units (used for asset allocation)
 * Converts all values to base rupee amount and then sums
 *
 * @param {Array} items - Array of objects with amount and unit properties
 * @returns {number} Total sum in base rupee value
 *
 * Example input: [
 *   { amount: 1.5, unit: 'Cr' },  // 1.5 Cr = 15,000,000
 *   { amount: 25, unit: 'L' },     // 25 L = 2,500,000
 *   { amount: 500, unit: 'K' }     // 500 K = 500,000
 * ]
 * Returns: 18,000,000
 */
export function sumValuesWithDifferentUnits(items) {
    if (!Array.isArray(items)) return 0;

    return items.reduce((sum, item) => {
        const amount = parseFloat(item.amount) || 0;
        const unit = item.unit;

        // If no unit or unrecognized unit, assume it's already in base value
        if (!unit || !DIVISORS[unit]) {
            return sum + amount;
        }

        // Convert to base rupee value
        const rupeeValue = amount * DIVISORS[unit];
        return sum + rupeeValue;
    }, 0);
}
