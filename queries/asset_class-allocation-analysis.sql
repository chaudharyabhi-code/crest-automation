-- ============================================================================
-- ASSET CLASS ALLOCATION QUERY (FIXED - Includes Manual Assets)
-- ============================================================================
-- This query calculates the percentage distribution across different asset classes
-- Now properly includes manual assets added to their respective categories
-- ============================================================================

WITH parameters AS (
    SELECT
        -- ================================================================
        -- USER IDS - Replace with your user IDs array
        -- ================================================================
        ARRAY[{USER_ID}]::int[] AS user_ids,  -- Example: ARRAY[123, 456, 789]::int[]

        -- ================================================================
        -- FILTER PARAMETERS (Optional - set to NULL to include all)
        -- ================================================================
        NULL::text AS asset_class_filter,      -- Filter by specific asset class (e.g., 'equity', 'mf')

        -- ================================================================
        -- OUTPUT FORMAT PARAMETERS
        -- ================================================================
        2::integer AS decimal_places          -- Number of decimal places for rounding
),

-- ============================================================================
-- MANUAL ASSETS AGGREGATED BY TYPE
-- ============================================================================
-- This CTE properly aggregates manual assets by their asset class type
manual_assets_by_type AS (
    SELECT
        ac.type AS asset_class_type,
        COALESCE(SUM(
            COALESCE((ua.data_json->>'current_value')::numeric,
                    (ua.data_json->>'value')::numeric, 0)
        ), 0) AS manual_balance
    FROM user_assets ua
    JOIN asset_classes ac ON ua.asset_class_id = ac.id
    CROSS JOIN parameters p
    WHERE ua.user_id = ANY(p.user_ids)
      AND ua.is_manual_entry = true
      AND ua.deleted_at IS NULL
      AND (p.asset_class_filter IS NULL OR ac.type = p.asset_class_filter)
      AND (
        CASE
            WHEN ac.type = 'deposits' THEN CAST('-infinity' AS DATE) -- Always include deposits if manual
            WHEN ac.type IN ('nps', 'recurring', 'term') THEN
                COALESCE((ua.data_json->>'start_date')::date, to_timestamp(ua.created_at)::date)
            WHEN ac.type IN ('equity', 'mf', 'etf', 'real_estate', 'crypto', 'gold') THEN
                COALESCE((ua.data_json->>'purchase_date')::date, to_timestamp(ua.created_at)::date)
            ELSE to_timestamp(ua.created_at)::date -- Fallback for other types
        END <= CURRENT_DATE
      )
    GROUP BY ac.type
),

-- ============================================================================
-- 1. DEPOSITS (Cash/Savings) - Includes Manual Deposits
-- ============================================================================
deposits_balances AS (
    SELECT
        'Cash' AS asset_class,
        'Cash' AS display_name,
        COALESCE(SUM(d.account_current_balance), 0) +
        COALESCE((SELECT manual_balance FROM manual_assets_by_type WHERE asset_class_type = 'deposits'), 0) AS balance
    FROM deposits d
    CROSS JOIN parameters p
    WHERE d.user_id = ANY(p.user_ids)
      AND d.account_current_balance IS NOT NULL
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'deposits')
),

-- ============================================================================
-- 2. RECURRING DEPOSITS - Includes Manual Recurring Deposits
-- ============================================================================
recurring_balances AS (
    SELECT
        'Tecurring' AS asset_class,
        'Recurring Deposits' AS display_name,
        COALESCE(SUM(rd.account_current_value), 0) +
        COALESCE((SELECT manual_balance FROM manual_assets_by_type WHERE asset_class_type = 'recurring'), 0) AS balance
    FROM recurring_deposits rd
    CROSS JOIN parameters p
    WHERE rd.user_id = ANY(p.user_ids)
      AND rd.account_current_value IS NOT NULL
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'recurring')
),

-- ============================================================================
-- 3. TERM DEPOSITS - Includes Manual Term Deposits
-- ============================================================================
term_balances AS (
    SELECT
        'Term' AS asset_class,
        'Term Deposits' AS display_name,
        COALESCE(SUM(td.account_current_balance), 0) +
        COALESCE((SELECT manual_balance FROM manual_assets_by_type WHERE asset_class_type = 'term'), 0) AS balance
    FROM term_deposits td
    CROSS JOIN parameters p
    WHERE td.user_id = ANY(p.user_ids)
      AND td.account_current_balance IS NOT NULL
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'term')
),

-- ============================================================================
-- 4. NPS - Includes Manual NPS
-- ============================================================================
nps_balances AS (
    SELECT
        'NPS' AS asset_class,
        'NPS' AS display_name,
        COALESCE(SUM(n.current_value), 0) +
        COALESCE((SELECT manual_balance FROM manual_assets_by_type WHERE asset_class_type = 'nps'), 0) AS balance
    FROM nps n
    CROSS JOIN parameters p
    WHERE n.user_id = ANY(p.user_ids)
      AND n.current_value IS NOT NULL
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'nps')
),

-- ============================================================================
-- 5. EQUITY - Includes Manual Equity
-- ============================================================================
equity_balances AS (
    SELECT
        'Equity' AS asset_class,
        'Equity / Stocks' AS display_name,
        COALESCE(SUM(da.current_value), 0) +
        COALESCE((SELECT manual_balance FROM manual_assets_by_type WHERE asset_class_type = 'equity'), 0) AS balance
    FROM demat_accounts da
    CROSS JOIN parameters p
    WHERE da.user_id = ANY(p.user_ids)
      AND da.current_value IS NOT NULL
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'equity')
),

-- ============================================================================
-- 6. ETF - Includes Manual ETF
-- ============================================================================
etf_balances AS (
    SELECT
        'ETF' AS asset_class,
        'ETF' AS display_name,
        COALESCE(SUM(ea.current_value), 0) +
        COALESCE((SELECT manual_balance FROM manual_assets_by_type WHERE asset_class_type = 'etf'), 0) AS balance
    FROM etf_accounts ea
    CROSS JOIN parameters p
    WHERE ea.user_id = ANY(p.user_ids)
      AND ea.current_value IS NOT NULL
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'etf')
),

-- ============================================================================
-- 7. MUTUAL FUNDS - Includes Manual MF
-- ============================================================================
mf_balances AS (
    SELECT
        'Mutual Funds' AS asset_class,
        'Mutual Funds' AS display_name,
        COALESCE(SUM(mf.current_value), 0) +
        COALESCE((SELECT manual_balance FROM manual_assets_by_type WHERE asset_class_type = 'mf'), 0) AS balance
    FROM mf mf
    CROSS JOIN parameters p
    WHERE mf.user_id = ANY(p.user_ids)
      AND mf.current_value IS NOT NULL
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'mf')
),

-- ============================================================================
-- 8. MANUAL ASSETS (Gold, Real Estate, Crypto)
-- ============================================================================
-- These are standalone categories since they don't have automated counterparts
manual_assets_balances AS (
    SELECT
        ac.type AS asset_class,
        CASE
            WHEN ac.type = 'gold' THEN 'Gold'
            WHEN ac.type = 'real_estate' THEN 'Real Estate'
            WHEN ac.type = 'crypto' THEN 'Crypto'
            ELSE ac.name
        END AS display_name,
        COALESCE((SELECT manual_balance FROM manual_assets_by_type WHERE asset_class_type = ac.type), 0) AS balance
    FROM asset_classes ac
    WHERE ac.type IN ('gold', 'real_estate', 'crypto')
),

-- ============================================================================
-- 9. COMBINE ALL ASSET CLASSES
-- ============================================================================
all_asset_classes AS (
    SELECT asset_class, display_name, balance FROM deposits_balances
    UNION ALL
    SELECT asset_class, display_name, balance FROM recurring_balances
    UNION ALL
    SELECT asset_class, display_name, balance FROM term_balances
    UNION ALL
    SELECT asset_class, display_name, balance FROM nps_balances
    UNION ALL
    SELECT asset_class, display_name, balance FROM equity_balances
    UNION ALL
    SELECT asset_class, display_name, balance FROM etf_balances
    UNION ALL
    SELECT asset_class, display_name, balance FROM mf_balances
    UNION ALL
    SELECT asset_class, display_name, balance FROM manual_assets_balances
),

-- ============================================================================
-- 10. CALCULATE TOTAL PORTFOLIO VALUE
-- ============================================================================
portfolio_total AS (
    SELECT COALESCE(SUM(balance), 0) AS total_value
    FROM all_asset_classes
)

-- ============================================================================
-- 11. FINAL RESULT WITH PERCENTAGES
-- ============================================================================
SELECT
    aac.asset_class,
    aac.display_name,
    ROUND(aac.balance::numeric, p.decimal_places) AS balance,
    CASE
        WHEN pt.total_value > 0 THEN
            ROUND((aac.balance::numeric / pt.total_value::numeric) * 100, p.decimal_places)
        ELSE 0
    END AS percentage,
    ROUND(pt.total_value::numeric, p.decimal_places) AS total_portfolio_value
FROM all_asset_classes aac
CROSS JOIN portfolio_total pt
CROSS JOIN parameters p
WHERE aac.balance > 0  -- Only show asset classes with balance > 0
ORDER BY aac.balance DESC;

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- This query now properly includes manual assets in their respective categories:
--
-- 1. Manual Equity is added to the Equity total
-- 2. Manual MF is added to the Mutual Funds total
-- 3. Manual Term Deposits are added to Term Deposits total
-- 4. Manual NPS is added to NPS total
-- 5. Manual Deposits are added to Deposits total
-- 6. Manual ETF is added to ETF total
-- 7. Gold, Real Estate, Crypto remain as separate categories
--
-- Simply update the user_ids in the parameters CTE and run the query!
-- ============================================================================
