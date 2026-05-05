-- Max Drawdown Calculation
-- Max Drawdown = max((peak - trough) / peak)
-- Uses cumulative returns and running maximum

WITH parameters AS (
    SELECT 
        {USER_ID}::integer AS user_id,
        {LOOKBACK_DAYS}::integer AS lookback_days,
        {LOOKBACK_MONTHS}::integer AS lookback_months
),

date_range AS (
    SELECT 
        CURRENT_DATE - (SELECT lookback_days FROM parameters) AS start_date,
        CURRENT_DATE AS end_date
),

-- Portfolio daily returns
equity_returns AS (
    SELECT ledger_date AS date, daily_return AS return
    FROM equity_ledger el
    CROSS JOIN parameters p
    CROSS JOIN date_range dr
    WHERE el.user_id = p.user_id
      AND el.ledger_date BETWEEN dr.start_date AND dr.end_date
      AND el.daily_return IS NOT NULL
),

mf_returns AS (
    SELECT ledger_date AS date, daily_return AS return
    FROM mf_ledger ml
    CROSS JOIN parameters p
    CROSS JOIN date_range dr
    WHERE ml.user_id = p.user_id
      AND ml.ledger_date BETWEEN dr.start_date AND dr.end_date
      AND ml.daily_return IS NOT NULL
),

etf_returns AS (
    SELECT ledger_date AS date, daily_return AS return
    FROM etf_ledger etl
    CROSS JOIN parameters p
    CROSS JOIN date_range dr
    WHERE etl.user_id = p.user_id
      AND etl.ledger_date BETWEEN dr.start_date AND dr.end_date
      AND etl.daily_return IS NOT NULL
),

portfolio_returns AS (
    SELECT date, return FROM equity_returns
    UNION ALL
    SELECT date, return FROM mf_returns
    UNION ALL
    SELECT date, return FROM etf_returns
),

aggregated_portfolio_returns AS (
    SELECT date, AVG(return) AS portfolio_return
    FROM portfolio_returns
    GROUP BY date
    ORDER BY date
),

-- Calculate cumulative returns and running max
cumulative_returns AS (
    SELECT 
        date,
        portfolio_return,
        -- Cumulative return using window function
        EXP(SUM(LN(1 + portfolio_return / 100.0)) OVER (ORDER BY date)) - 1 AS cumulative_return,
        -- Running maximum
        MAX(EXP(SUM(LN(1 + portfolio_return / 100.0)) OVER (ORDER BY date)) - 1) 
            OVER (ORDER BY date) AS running_max
    FROM aggregated_portfolio_returns
),

-- Calculate drawdown at each point
drawdowns AS (
    SELECT 
        date,
        cumulative_return,
        running_max,
        -- Drawdown = (cumulative - running_max) / running_max
        CASE 
            WHEN running_max > 0 
            THEN (cumulative_return - running_max) / running_max
            ELSE 0
        END AS drawdown
    FROM cumulative_returns
),

-- Filter to lookback window from last date
filtered_drawdowns AS (
    SELECT 
        d.*,
        (SELECT MAX(date) FROM drawdowns) AS last_date
    FROM drawdowns d
    WHERE d.date >= (SELECT MAX(date) - INTERVAL '1 month' * lookback_months FROM drawdowns)
),

-- Get max drawdown
max_drawdown_result AS (
    SELECT 
        MIN(drawdown) AS max_drawdown,
        COUNT(*) AS data_points,
        (SELECT MAX(date) FROM drawdowns) AS last_date,
        (SELECT MIN(date) FROM filtered_drawdowns) AS filtered_start_date
    FROM filtered_drawdowns
)

SELECT 
    max_drawdown,
    data_points,
    last_date,
    filtered_start_date
FROM max_drawdown_result;
