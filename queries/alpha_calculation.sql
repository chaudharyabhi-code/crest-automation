-- Alpha Calculation
-- α = Rp - Rf - β × (Rm - Rf)
-- Where Rp = portfolio total return, Rm = benchmark total return, Rf = risk-free rate

WITH parameters AS (
    SELECT 
        {USER_ID}::integer AS user_id,
        {BENCHMARK_ID}::integer AS benchmark_id,
        {LOOKBACK_DAYS}::integer AS lookback_days,
        {RISK_FREE_RATE}::numeric AS risk_free_rate
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

-- Benchmark returns
benchmark_returns AS (
    SELECT price_date AS date, daily_return AS benchmark_return
    FROM benchmark_price_history bph
    CROSS JOIN parameters p
    CROSS JOIN date_range dr
    WHERE bph.benchmark_id = p.benchmark_id
      AND bph.price_date BETWEEN dr.start_date AND dr.end_date
      AND bph.daily_return IS NOT NULL
    ORDER BY price_date
),

-- Align returns
aligned_returns AS (
    SELECT 
        pr.date,
        pr.portfolio_return,
        br.benchmark_return
    FROM aggregated_portfolio_returns pr
    INNER JOIN benchmark_returns br ON pr.date = br.date
),

-- Calculate Beta first
beta_calc AS (
    SELECT 
        COVAR_SAMP(portfolio_return, benchmark_return) / VAR_SAMP(benchmark_return) AS beta
    FROM aligned_returns
),

-- Calculate total returns (annualized)
total_returns AS (
    SELECT 
        -- Portfolio total return: (1 + r1) * (1 + r2) * ... - 1, then annualized
        CASE 
            WHEN COUNT(*) > 1 
            THEN POWER(EXP(SUM(LN(1 + portfolio_return / 100.0))), 365.0 / COUNT(*)) - 1
            ELSE NULL
        END AS portfolio_total_return,
        -- Benchmark total return
        CASE 
            WHEN COUNT(*) > 1 
            THEN POWER(EXP(SUM(LN(1 + benchmark_return / 100.0))), 365.0 / COUNT(*)) - 1
            ELSE NULL
        END AS benchmark_total_return
    FROM aligned_returns
),

-- Calculate Alpha
alpha_calc AS (
    SELECT 
        beta_calc.beta,
        total_returns.portfolio_total_return,
        total_returns.benchmark_total_return,
        parameters.risk_free_rate,
        -- Alpha = Rp - Rf - β × (Rm - Rf)
        portfolio_total_return - risk_free_rate - beta * (benchmark_total_return - risk_free_rate) AS alpha
    FROM beta_calc
    CROSS JOIN total_returns
    CROSS JOIN parameters
)

SELECT 
    beta,
    portfolio_total_return,
    benchmark_total_return,
    risk_free_rate,
    alpha
FROM alpha_calc;
