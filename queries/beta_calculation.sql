-- Beta Calculation
-- β = Cov(Rp, Rm) / Var(Rm)
-- Portfolio returns from equity_ledger, mf_ledger, etf_ledger
-- Benchmark returns from benchmark_price_history

WITH parameters AS (
    SELECT 
        {USER_ID}::integer AS user_id,
        {BENCHMARK_ID}::integer AS benchmark_id,
        {LOOKBACK_DAYS}::integer AS lookback_days
),

date_range AS (
    SELECT 
        CURRENT_DATE - (SELECT lookback_days FROM parameters) AS start_date,
        CURRENT_DATE AS end_date
),

-- Portfolio daily returns from equity ledger
equity_returns AS (
    SELECT 
        ledger_date AS date,
        daily_return AS return
    FROM equity_ledger el
    CROSS JOIN parameters p
    CROSS JOIN date_range dr
    WHERE el.user_id = p.user_id
      AND el.ledger_date BETWEEN dr.start_date AND dr.end_date
      AND el.daily_return IS NOT NULL
),

-- Portfolio daily returns from MF ledger
mf_returns AS (
    SELECT 
        ledger_date AS date,
        daily_return AS return
    FROM mf_ledger ml
    CROSS JOIN parameters p
    CROSS JOIN date_range dr
    WHERE ml.user_id = p.user_id
      AND ml.ledger_date BETWEEN dr.start_date AND dr.end_date
      AND ml.daily_return IS NOT NULL
),

-- Portfolio daily returns from ETF ledger
etf_returns AS (
    SELECT 
        ledger_date AS date,
        daily_return AS return
    FROM etf_ledger etl
    CROSS JOIN parameters p
    CROSS JOIN date_range dr
    WHERE etl.user_id = p.user_id
      AND etl.ledger_date BETWEEN dr.start_date AND dr.end_date
      AND etl.daily_return IS NOT NULL
),

-- Combined portfolio returns (simple average - for proper weighted average use full query)
portfolio_returns AS (
    SELECT date, return FROM equity_returns
    UNION ALL
    SELECT date, return FROM mf_returns
    UNION ALL
    SELECT date, return FROM etf_returns
),

-- Aggregate portfolio returns by date
aggregated_portfolio_returns AS (
    SELECT 
        date,
        AVG(return) AS portfolio_return
    FROM portfolio_returns
    GROUP BY date
    ORDER BY date
),

-- Benchmark returns
benchmark_returns AS (
    SELECT 
        price_date AS date,
        daily_return AS benchmark_return
    FROM benchmark_price_history bph
    CROSS JOIN parameters p
    CROSS JOIN date_range dr
    WHERE bph.benchmark_id = p.benchmark_id
      AND bph.price_date BETWEEN dr.start_date AND dr.end_date
      AND bph.daily_return IS NOT NULL
    ORDER BY price_date
),

-- Align portfolio and benchmark returns by date
aligned_returns AS (
    SELECT 
        pr.date,
        pr.portfolio_return,
        br.benchmark_return
    FROM aggregated_portfolio_returns pr
    INNER JOIN benchmark_returns br ON pr.date = br.date
),

-- Calculate statistics
calculated_beta AS (
    SELECT 
        -- Portfolio stats
        AVG(portfolio_return) AS portfolio_mean,
        VAR_SAMP(portfolio_return) AS portfolio_variance,
        
        -- Benchmark stats
        AVG(benchmark_return) AS benchmark_mean,
        VAR_SAMP(benchmark_return) AS benchmark_variance,
        
        -- Covariance
        COVAR_SAMP(portfolio_return, benchmark_return) AS covariance,
        
        -- Beta = Covariance(Portfolio, Benchmark) / Variance(Benchmark)
        CASE 
            WHEN VAR_SAMP(benchmark_return) > 0 
            THEN COVAR_SAMP(portfolio_return, benchmark_return) / VAR_SAMP(benchmark_return)
            ELSE NULL
        END AS beta,
        
        -- Additional stats
        COUNT(*) AS data_points,
        STDDEV_SAMP(portfolio_return) AS portfolio_stddev,
        STDDEV_SAMP(benchmark_return) AS benchmark_stddev,
        
        -- Correlation coefficient
        CASE 
            WHEN STDDEV_SAMP(portfolio_return) > 0 AND STDDEV_SAMP(benchmark_return) > 0
            THEN COVAR_SAMP(portfolio_return, benchmark_return) / 
                 (STDDEV_SAMP(portfolio_return) * STDDEV_SAMP(benchmark_return))
            ELSE NULL
        END AS correlation
    FROM aligned_returns
)

SELECT 
    portfolio_mean,
    benchmark_mean,
    portfolio_variance,
    benchmark_variance,
    covariance,
    beta,
    data_points,
    portfolio_stddev,
    benchmark_stddev,
    correlation
FROM calculated_beta;
