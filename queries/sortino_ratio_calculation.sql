-- Sortino Ratio Calculation
-- Sortino = (Rp - Rf) / σ_downside
-- Where σ_downside = std dev of returns below risk-free rate

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

-- Calculate Sortino
sortino_calc AS (
    SELECT 
        -- Mean daily return
        AVG(portfolio_return) AS mean_daily_return,
        
        -- Annualized return
        AVG(portfolio_return) * trading_days_per_year AS annualized_return,
        
        -- Daily risk-free rate
        risk_free_rate / trading_days_per_year AS daily_risk_free_rate,
        
        -- Excess returns
        portfolio_return - (risk_free_rate / trading_days_per_year) AS excess_return,
        
        -- Downside returns (excess < 0)
        CASE 
            WHEN portfolio_return - (risk_free_rate / trading_days_per_year) < 0
            THEN portfolio_return - (risk_free_rate / trading_days_per_year)
            ELSE NULL
        END AS downside_return
    FROM aggregated_portfolio_returns
    CROSS JOIN parameters
),

-- Calculate downside std dev
downside_stats AS (
    SELECT 
        AVG(mean_daily_return) AS mean_daily_return,
        AVG(annualized_return) AS annualized_return,
        AVG(daily_risk_free_rate) AS daily_risk_free_rate,
        STDDEV_SAMP(downside_return) AS daily_downside_stddev,
        STDDEV_SAMP(downside_return) * SQRT(trading_days_per_year) AS annualized_downside_stddev,
        COUNT(*) AS data_points
    FROM sortino_calc
),

-- Final Sortino calculation
sortino_final AS (
    SELECT 
        mean_daily_return,
        annualized_return,
        daily_risk_free_rate,
        daily_downside_stddev,
        annualized_downside_stddev,
        data_points,
        parameters.risk_free_rate,
        -- Sortino = (annualized_return - risk_free_rate) / annualized_downside_stddev
        CASE 
            WHEN annualized_downside_stddev > 0 AND annualized_downside_stddev IS NOT NULL
            THEN (annualized_return - risk_free_rate) / annualized_downside_stddev
            ELSE NULL
        END AS sortino_ratio
    FROM downside_stats
    CROSS JOIN parameters
)

SELECT 
    mean_daily_return,
    annualized_return,
    daily_downside_stddev,
    annualized_downside_stddev,
    sortino_ratio,
    data_points
FROM sortino_final;
