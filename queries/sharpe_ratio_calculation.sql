-- Sharpe Ratio Calculation
-- Sharpe = (Rp - Rf) / σp
-- Where Rp = annualized portfolio return, Rf = risk-free rate, σp = annualized std dev

WITH parameters AS (
    SELECT 
        {USER_ID}::integer AS user_id,
        {LOOKBACK_DAYS}::integer AS lookback_days,
        {RISK_FREE_RATE}::numeric AS risk_free_rate,
        {TRADING_DAYS_PER_YEAR}::integer AS trading_days_per_year
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

-- Calculate Sharpe
sharpe_calc AS (
    SELECT 
        -- Mean daily return
        AVG(portfolio_return) AS mean_daily_return,
        
        -- Annualized return = mean_daily * trading_days
        AVG(portfolio_return) * trading_days_per_year AS annualized_return,
        
        -- Daily std dev (sample)
        STDDEV_SAMP(portfolio_return) AS daily_stddev,
        
        -- Annualized std dev = daily_stddev * sqrt(trading_days)
        STDDEV_SAMP(portfolio_return) * SQRT(trading_days_per_year) AS annualized_stddev,
        
        -- Sharpe = (annualized_return - risk_free_rate) / annualized_stddev
        CASE 
            WHEN STDDEV_SAMP(portfolio_return) > 0
            THEN (AVG(portfolio_return) * trading_days_per_year - risk_free_rate) / 
                 (STDDEV_SAMP(portfolio_return) * SQRT(trading_days_per_year))
            ELSE NULL
        END AS sharpe_ratio,
        
        COUNT(*) AS data_points
    FROM aggregated_portfolio_returns
    CROSS JOIN parameters
)

SELECT 
    mean_daily_return,
    annualized_return,
    daily_stddev,
    annualized_stddev,
    sharpe_ratio,
    data_points
FROM sharpe_calc;
