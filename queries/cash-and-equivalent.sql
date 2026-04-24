WITH parameters AS (
    SELECT 
        {USER_ID}::integer AS user_id  -- Replace with your user_id
),

-- 1. Deposits (Savings/Current accounts)
deposits_cash AS (
    SELECT 
        COALESCE(SUM(d.account_current_balance), 0) AS deposits_value
    FROM deposits d
    JOIN parameters p ON d.user_id = p.user_id
    WHERE d.account_current_balance > 0
),

-- 2. Liquid Mutual Funds (Liquid, Arbitrage, Overnight)
liquid_mf AS (
    SELECT 
        COALESCE(SUM(mf.current_value), 0) AS liquid_mf_value
    FROM mf 
    JOIN parameters p ON mf.user_id = p.user_id
    WHERE mf.current_value IS NOT NULL
      AND (
            mf.fund_name ILIKE '%Liquid%' 
         OR mf.fund_name ILIKE '%Arbitrage%' 
         OR mf.fund_name ILIKE '%Overnight%'
          )
),

-- 3. Liquid ETFs (Liquid, Arbitrage, Overnight)
liquid_etf AS (
    SELECT 
        COALESCE(SUM(eh.current_value), 0) AS liquid_etf_value
    FROM etf_holdings eh
    JOIN parameters p ON eh.user_id = p.user_id
    WHERE eh.current_value IS NOT NULL
      AND (
            eh.scheme_name ILIKE '%Liquid%' 
         OR eh.scheme_name ILIKE '%Arbitrage%' 
         OR eh.scheme_name ILIKE '%Overnight%'
          )
)

SELECT 
    d.deposits_value,
    mf.liquid_mf_value,
    etf.liquid_etf_value,
    (d.deposits_value + mf.liquid_mf_value + etf.liquid_etf_value) AS total_cash_and_equivalent
FROM deposits_cash d
CROSS JOIN liquid_mf mf
CROSS JOIN liquid_etf etf;