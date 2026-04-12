-- Combined Portfolio Volatility Calculation - Annualized
-- This script calculates annualized volatility for ETF + Equity + MF holdings together
-- Using same logic as application but for complete portfolio

-- Parameters
WITH parameters AS (
    SELECT 
        {USER_ID}::integer AS user_id,        -- User ID
        252::integer AS trading_days,   -- Standard trading days per year
        20::integer AS min_data_points  -- Minimum data points required
),

-- Date range for calculation (last 365 days)
date_range AS (
    SELECT 
        (CURRENT_DATE - INTERVAL '365 days')::date AS start_date,
        CURRENT_DATE::date AS end_date
),

-- ===== EQUITY SECTION =====
-- Get distinct equity securities from ledger entries
user_equities AS (
    SELECT DISTINCT el.user_id, el.security_id, el.demat_id
    FROM equity_ledger el
    WHERE el.user_id = (SELECT user_id FROM parameters)
      AND el.ledger_date >= DATE_TRUNC('month', (SELECT start_date FROM date_range))::date
      AND el.ledger_date <= (SELECT end_date FROM date_range)
),

-- Get initial equity holdings before start date
initial_equity AS (
    SELECT DISTINCT ON (el.user_id, el.security_id, el.demat_id)
        el.user_id, el.security_id, el.demat_id, el.cumulative_units AS units
    FROM equity_ledger el
    WHERE el.user_id = (SELECT user_id FROM parameters) 
      AND el.ledger_date < (SELECT start_date FROM date_range)
    ORDER BY el.user_id, el.security_id, el.demat_id, el.ledger_date DESC
),

-- Expand equity holdings to daily timeline
equity_ledger_expanded AS (
    SELECT
        dr.d AS ledger_date,
        ue.user_id,
        ue.security_id,
        ue.demat_id,
        COALESCE(el.units, CASE WHEN dr.d = (SELECT start_date FROM date_range) THEN ie.units END) as units
    FROM generate_series((SELECT start_date FROM date_range), (SELECT end_date FROM date_range), '1 day') dr(d)
    JOIN user_equities ue ON TRUE
    LEFT JOIN LATERAL (
        SELECT DISTINCT ON (el.user_id, el.security_id, el.demat_id, el.ledger_date)
            el.cumulative_units AS units
        FROM equity_ledger el
        WHERE el.user_id = ue.user_id
          AND el.security_id = ue.security_id
          AND el.demat_id = ue.demat_id
          AND el.ledger_date = dr.d
        ORDER BY el.user_id, el.security_id, el.demat_id, el.ledger_date DESC
        LIMIT 1
    ) el ON TRUE
    LEFT JOIN initial_equity ie
        ON ie.user_id = ue.user_id
       AND ie.security_id = ue.security_id
       AND ie.demat_id = ue.demat_id
),

-- Handle missing data with forward fill for equity
daily_equity_partitions AS (
    SELECT
        ledger_date,
        user_id,
        security_id,
        demat_id,
        units,
        SUM(CASE WHEN units IS NOT NULL THEN 1 ELSE 0 END) OVER (PARTITION BY user_id, security_id, demat_id ORDER BY ledger_date, security_id) as grp
    FROM equity_ledger_expanded
),

daily_equity_units AS (
    SELECT
        ledger_date,
        user_id,
        security_id,
        demat_id,
        FIRST_VALUE(units) OVER (PARTITION BY user_id, security_id, demat_id, grp ORDER BY ledger_date, security_id) as units
    FROM daily_equity_partitions
),

-- Calculate daily equity returns and portfolio values
daily_equity_state AS (
    SELECT
        deu.ledger_date,
        'equity' AS asset_type,
        COALESCE(eph.daily_change_percentage, 0) AS daily_return,
        (deu.units * COALESCE(eph.close_price, prev_eph.close_price, 0)) AS current_value
    FROM daily_equity_units deu
    LEFT JOIN LATERAL (
        SELECT 
            eph.close_price,
            eph.daily_change_percentage
        FROM equity_price_history eph
        WHERE eph.security_id = deu.security_id
          AND eph.trade_date = deu.ledger_date
          AND eph.close_price IS NOT NULL
        ORDER BY eph.trade_date DESC, eph.close_price DESC
        LIMIT 1
    ) eph ON TRUE
    LEFT JOIN LATERAL (
        -- Get previous trading day's price for non-trading days
        SELECT eph.close_price
        FROM equity_price_history eph
        WHERE eph.security_id = deu.security_id
          AND eph.trade_date < deu.ledger_date
          AND eph.trade_date >= deu.ledger_date - INTERVAL '10 days'
          AND eph.close_price IS NOT NULL
        ORDER BY eph.trade_date DESC
        LIMIT 1
    ) prev_eph ON eph.close_price IS NULL
    WHERE deu.units > 0
      AND (eph.close_price IS NOT NULL OR prev_eph.close_price IS NOT NULL)
),

-- ===== MF SECTION =====
-- Get distinct MF ISINs from ledger entries
user_mfs AS (
    SELECT DISTINCT mfl.user_id, mfl.isin
    FROM mf_ledger mfl
    WHERE mfl.user_id = (SELECT user_id FROM parameters)
      AND mfl.ledger_date >= DATE_TRUNC('month', (SELECT start_date FROM date_range))::date
      AND mfl.ledger_date <= (SELECT end_date FROM date_range)
      AND mfl.isin IS NOT NULL
),

-- Get initial MF holdings before start date
initial_mfs AS (
    SELECT DISTINCT ON (mfl.user_id, mfl.isin)
        mfl.user_id, mfl.isin, mfl.cumulative_units as units, mfl.current_value
    FROM mf_ledger mfl
    WHERE mfl.user_id = (SELECT user_id FROM parameters) 
      AND mfl.isin IS NOT NULL 
      AND mfl.ledger_date < (SELECT start_date FROM date_range)
    ORDER BY mfl.user_id, mfl.isin, mfl.ledger_date DESC
),

-- Expand MF holdings to daily timeline
mf_ledger_expanded AS (
    SELECT
        dr.d AS ledger_date,
        um.user_id,
        um.isin,
        COALESCE(mfl.cumulative_units, CASE WHEN dr.d = (SELECT start_date FROM date_range) THEN im.units END) as units,
        COALESCE(mfl.current_value, CASE WHEN dr.d = (SELECT start_date FROM date_range) THEN im.current_value END) as current_value
    FROM generate_series((SELECT start_date FROM date_range), (SELECT end_date FROM date_range), '1 day') dr(d)
    JOIN user_mfs um ON TRUE
    LEFT JOIN LATERAL (
        SELECT DISTINCT ON (mfl.user_id, mfl.isin, mfl.ledger_date)
            mfl.cumulative_units, mfl.current_value
        FROM mf_ledger mfl
        WHERE mfl.user_id = um.user_id
          AND mfl.isin = um.isin
          AND mfl.ledger_date = dr.d
        ORDER BY mfl.user_id, mfl.isin, mfl.ledger_date DESC, mfl.id DESC
        LIMIT 1
    ) mfl ON TRUE
    LEFT JOIN initial_mfs im
        ON im.user_id = um.user_id
       AND im.isin = um.isin
),

-- Handle missing data with forward fill for MF
daily_mf_partitions AS (
    SELECT
        ledger_date,
        user_id,
        isin,
        units,
        current_value,
        SUM(CASE WHEN units IS NOT NULL THEN 1 ELSE 0 END) OVER (PARTITION BY user_id, isin ORDER BY ledger_date, isin) as grp
    FROM mf_ledger_expanded
),

daily_mf_units AS (
    SELECT
        ledger_date,
        user_id,
        isin,
        FIRST_VALUE(units) OVER (PARTITION BY user_id, isin, grp ORDER BY ledger_date, isin) as units,
        FIRST_VALUE(current_value) OVER (PARTITION BY user_id, isin, grp ORDER BY ledger_date, isin) as current_value
    FROM daily_mf_partitions
),

-- Calculate daily MF returns and portfolio values (matching application exactly)
daily_mf_state AS (
    SELECT
        dmu.ledger_date,
        'mf' AS asset_type,
        -- Calculate return from NAV change: (current_nav - prev_nav) / prev_nav * 100
        CASE 
            WHEN hn.nav IS NOT NULL AND prev_nav_for_return.nav IS NOT NULL AND prev_nav_for_return.nav > 0 
            THEN (hn.nav - prev_nav_for_return.nav) / prev_nav_for_return.nav * 100
            ELSE 0 
        END AS daily_return,
        -- Use NAV * units if NAV exists, otherwise fall back to previous NAV * units (for valuation only, like equity)
        (dmu.units * COALESCE(hn.nav, prev_hn.nav, 0)) AS current_value
    FROM daily_mf_units dmu
    LEFT JOIN LATERAL (
        -- Get NAV for current date (matches equity pattern)
        SELECT hn.nav
        FROM historic_nav hn
        WHERE hn.isin = dmu.isin
          AND hn.nav IS NOT NULL
          AND hn.nav_date = dmu.ledger_date
        ORDER BY hn.nav_date DESC, hn.nav DESC
        LIMIT 1
    ) hn ON TRUE
    LEFT JOIN LATERAL (
        -- Get previous trading day's NAV for return calculation (needed to calculate daily return)
        -- Use most recent previous NAV regardless of how far back (no interval limit for accuracy)
        SELECT hn.nav
        FROM historic_nav hn
        WHERE hn.isin = dmu.isin
          AND hn.nav IS NOT NULL
          AND hn.nav_date < dmu.ledger_date
        ORDER BY hn.nav_date DESC
        LIMIT 1
    ) prev_nav_for_return ON hn.nav IS NOT NULL
    LEFT JOIN LATERAL (
        -- Get previous trading day's NAV for non-trading days (for valuation only, like equity)
        SELECT hn.nav
        FROM historic_nav hn
        WHERE hn.isin = dmu.isin
          AND hn.nav IS NOT NULL
          AND hn.nav_date < dmu.ledger_date
          AND hn.nav_date >= dmu.ledger_date - INTERVAL '10 days'
        ORDER BY hn.nav_date DESC
        LIMIT 1
    ) prev_hn ON hn.nav IS NULL
    WHERE dmu.units > 0
      AND (hn.nav IS NOT NULL OR prev_hn.nav IS NOT NULL)
),

-- ===== ETF SECTION =====
-- Get distinct ETF ISINs from ledger entries
user_etfs AS (
    SELECT DISTINCT el.user_id, el.isin, el.etf_account_id
    FROM etf_ledger el
    WHERE el.user_id = (SELECT user_id FROM parameters)
      AND el.ledger_date >= DATE_TRUNC('month', (SELECT start_date FROM date_range))::date
      AND el.ledger_date <= (SELECT end_date FROM date_range)
      AND el.isin IS NOT NULL
),

-- Get initial ETF holdings before start date
initial_etfs AS (
    SELECT DISTINCT ON (el.user_id, el.isin, el.etf_account_id)
        el.user_id, el.isin, el.etf_account_id, el.cumulative_units AS units
    FROM etf_ledger el
    WHERE el.user_id = (SELECT user_id FROM parameters) 
      AND el.isin IS NOT NULL 
      AND el.ledger_date < (SELECT start_date FROM date_range)
    ORDER BY el.user_id, el.isin, el.etf_account_id, el.ledger_date DESC
),

-- Expand ETF holdings to daily timeline
etf_ledger_expanded AS (
    SELECT
        dr.d AS ledger_date,
        ue.user_id,
        ue.isin,
        ue.etf_account_id,
        COALESCE(el.units, CASE WHEN dr.d = (SELECT start_date FROM date_range) THEN ie.units END) as units
    FROM generate_series((SELECT start_date FROM date_range), (SELECT end_date FROM date_range), '1 day') dr(d)
    JOIN user_etfs ue ON TRUE
    LEFT JOIN LATERAL (
        SELECT DISTINCT ON (el.user_id, el.isin, el.etf_account_id, el.ledger_date)
            el.cumulative_units AS units
        FROM etf_ledger el
        WHERE el.user_id = ue.user_id
          AND el.isin = ue.isin
          AND el.etf_account_id = ue.etf_account_id
          AND el.ledger_date = dr.d
        ORDER BY el.user_id, el.isin, el.etf_account_id, el.ledger_date DESC
        LIMIT 1
    ) el ON TRUE
    LEFT JOIN initial_etfs ie
        ON ie.user_id = ue.user_id
       AND ie.isin = ue.isin
       AND ie.etf_account_id = ue.etf_account_id
),

-- Handle missing data with forward fill for ETF
daily_etf_partitions AS (
    SELECT
        ledger_date,
        user_id,
        isin,
        etf_account_id,
        units,
        SUM(CASE WHEN units IS NOT NULL THEN 1 ELSE 0 END) OVER (PARTITION BY user_id, isin, etf_account_id ORDER BY ledger_date, isin) as grp
    FROM etf_ledger_expanded
),

daily_etf_units AS (
    SELECT
        ledger_date,
        user_id,
        isin,
        etf_account_id,
        FIRST_VALUE(units) OVER (PARTITION BY user_id, isin, etf_account_id, grp ORDER BY ledger_date, isin) as units
    FROM daily_etf_partitions
),

-- Calculate daily ETF returns and portfolio values (matching application exactly)
daily_etf_state AS (
    SELECT
        deu.ledger_date,
        'etf' AS asset_type,
        -- Calculate return from NAV change: (current_nav - prev_nav) / prev_nav * 100
        CASE 
            WHEN hn.nav IS NOT NULL AND prev_nav_for_return.nav IS NOT NULL AND prev_nav_for_return.nav > 0 
            THEN (hn.nav - prev_nav_for_return.nav) / prev_nav_for_return.nav * 100
            ELSE 0 
        END AS daily_return,
        -- Use NAV * units if NAV exists, otherwise fall back to previous NAV * units (for valuation only, like equity)
        (deu.units * COALESCE(hn.nav, prev_hn.nav, 0)) AS current_value
    FROM daily_etf_units deu
    LEFT JOIN LATERAL (
        -- Get NAV for current date (matches equity pattern)
        SELECT hn.nav
        FROM historic_nav hn
        WHERE hn.isin = deu.isin
          AND hn.nav IS NOT NULL
          AND hn.nav_date = deu.ledger_date
        ORDER BY hn.nav_date DESC, hn.nav DESC
        LIMIT 1
    ) hn ON TRUE
    LEFT JOIN LATERAL (
        -- Get previous trading day's NAV for return calculation (needed to calculate daily return)
        -- Use most recent previous NAV regardless of how far back (no interval limit for accuracy)
        SELECT hn.nav
        FROM historic_nav hn
        WHERE hn.isin = deu.isin
          AND hn.nav IS NOT NULL
          AND hn.nav_date < deu.ledger_date
        ORDER BY hn.nav_date DESC
        LIMIT 1
    ) prev_nav_for_return ON hn.nav IS NOT NULL
    LEFT JOIN LATERAL (
        -- Get previous trading day's NAV for non-trading days (for valuation only, like equity)
        SELECT hn.nav
        FROM historic_nav hn
        WHERE hn.isin = deu.isin
          AND hn.nav IS NOT NULL
          AND hn.nav_date < deu.ledger_date
          AND hn.nav_date >= deu.ledger_date - INTERVAL '10 days'
        ORDER BY hn.nav_date DESC
        LIMIT 1
    ) prev_hn ON hn.nav IS NULL
    WHERE deu.units > 0
      AND (hn.nav IS NOT NULL OR prev_hn.nav IS NOT NULL)
),

-- ===== COMBINED PORTFOLIO SECTION =====
-- Combine all asset classes
combined_daily_state AS (
    SELECT * FROM daily_equity_state
    UNION ALL
    SELECT * FROM daily_mf_state
    UNION ALL
    SELECT * FROM daily_etf_state
),

-- Calculate daily portfolio returns for all asset classes combined
combined_portfolio_returns AS (
    SELECT
        ledger_date,
        SUM(CASE WHEN current_value > 0 THEN daily_return * current_value ELSE 0 END) / 
        NULLIF(SUM(current_value), 0) AS portfolio_return
    FROM combined_daily_state
    GROUP BY ledger_date
    HAVING SUM(current_value) > 0
),

-- Calculate volatility statistics
volatility_calculation AS (
    SELECT
        COUNT(*) AS total_data_points,
        COUNT(portfolio_return) AS valid_return_points,
        AVG(portfolio_return) AS mean_daily_return,
        STDDEV(portfolio_return) AS daily_std_dev,
        MIN(portfolio_return) AS min_daily_return,
        MAX(portfolio_return) AS max_daily_return
    FROM combined_portfolio_returns
    WHERE portfolio_return IS NOT NULL
      AND portfolio_return BETWEEN -30 AND 50  -- Filter extreme outliers
)

-- Final Results
SELECT 
    'Combined Portfolio Volatility Analysis' AS analysis_type,
    (SELECT user_id FROM parameters) AS user_id,
    (SELECT start_date FROM date_range) AS analysis_start_date,
    (SELECT end_date FROM date_range) AS analysis_end_date,
    
    -- Data Quality Metrics
    vc.total_data_points,
    vc.valid_return_points,
    CASE 
        WHEN vc.total_data_points > 0 
        THEN ROUND((vc.valid_return_points::numeric / vc.total_data_points::numeric) * 100, 2)
        ELSE 0
    END AS data_completeness_pct,
    
    -- Daily Statistics
    ROUND(vc.mean_daily_return::numeric, 4) AS mean_daily_return_pct,
    ROUND(vc.daily_std_dev::numeric, 4) AS daily_std_dev_pct,
    ROUND(vc.min_daily_return::numeric, 4) AS min_daily_return_pct,
    ROUND(vc.max_daily_return::numeric, 4) AS max_daily_return_pct,
    
    -- Annualized Volatility Calculation
    CASE 
        WHEN vc.valid_return_points >= (SELECT min_data_points FROM parameters) 
             AND vc.daily_std_dev IS NOT NULL 
        THEN
            -- Convert daily std dev to annualized: σ_annual = σ_daily × √(trading_days)
            ROUND((vc.daily_std_dev * SQRT((SELECT trading_days FROM parameters)))::numeric, 2)
        ELSE NULL
    END AS annualized_volatility_pct,
    
    -- Interpretation
    CASE 
        WHEN vc.valid_return_points < (SELECT min_data_points FROM parameters) 
        THEN 'Insufficient Data'
        WHEN vc.daily_std_dev IS NULL 
        THEN 'Calculation Error'
        WHEN (vc.daily_std_dev * SQRT((SELECT trading_days FROM parameters))) < 10 
        THEN 'Low Volatility'
        WHEN (vc.daily_std_dev * SQRT((SELECT trading_days FROM parameters))) < 20 
        THEN 'Moderate Volatility'
        WHEN (vc.daily_std_dev * SQRT((SELECT trading_days FROM parameters))) < 30 
        THEN 'High Volatility'
        ELSE 'Very High Volatility'
    END AS volatility_interpretation,
    
    -- Additional Risk Metrics
    CASE 
        WHEN vc.valid_return_points >= (SELECT min_data_points FROM parameters) 
             AND vc.daily_std_dev IS NOT NULL 
        THEN
            -- Annualized return
            ROUND((vc.mean_daily_return * (SELECT trading_days FROM parameters))::numeric, 2)
        ELSE NULL
    END AS annualized_return_pct,
    
    CASE 
        WHEN vc.valid_return_points >= (SELECT min_data_points FROM parameters) 
             AND vc.daily_std_dev IS NOT NULL 
        THEN
            -- 95% confidence range
            ROUND((2 * vc.daily_std_dev * SQRT((SELECT trading_days FROM parameters)))::numeric, 2)
        ELSE NULL
    END AS annualized_95_confidence_range_pct

FROM volatility_calculation vc;
