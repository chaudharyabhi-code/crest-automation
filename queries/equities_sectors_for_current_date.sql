-- Equity Sector-wise Allocation SQL
-- Returns sector allocation for current equity holdings
-- Format: sector | total_value | percentage

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id  -- Change this to your user ID
),

-- Equity sector allocation exactly like the API
equity_sector_allocation AS (
    SELECT
        COALESCE(NULLIF(TRIM(sm.sector), ''), 'Others') AS sector,
        SUM(dh.units * dh.last_traded_price) AS sector_value,
        COUNT(*) AS number_of_holdings
    FROM (
        SELECT DISTINCT ON (dh_inner.user_id, dh_inner.demat_account_id, dh_inner.isin)
            dh_inner.security_id,
            dh_inner.units,
            dh_inner.last_traded_price
        FROM demat_holdings dh_inner
        WHERE dh_inner.user_id = (SELECT user_id FROM parameters)
          AND dh_inner.units > 0
          AND dh_inner.deleted_at IS NULL
        ORDER BY dh_inner.user_id, dh_inner.demat_account_id, dh_inner.isin,
                 dh_inner.last_fetch_time DESC NULLS LAST
    ) dh
    LEFT JOIN securities_master sm ON dh.security_id = sm.id
    GROUP BY COALESCE(NULLIF(TRIM(sm.sector), ''), 'Others')
),

-- Calculate total market-linked wealth (equity + MF + ETF) for percentage calculation
total_portfolio_wealth AS (
    SELECT 
        (COALESCE(equity.balance, 0) + 
         COALESCE(mf.balance, 0) + 
         COALESCE(etf.balance, 0)) AS total_wealth
    FROM (
        -- Equity (using current_value from demat_accounts like dashboard)
        SELECT SUM(da.current_value) AS balance
        FROM demat_accounts da
        WHERE da.user_id = (SELECT user_id FROM parameters)
          AND da.current_value IS NOT NULL
    ) equity
    CROSS JOIN (
        -- Mutual Funds
        SELECT SUM(mf.current_value) AS balance
        FROM mf mf
        WHERE mf.user_id = (SELECT user_id FROM parameters)
          AND mf.current_value IS NOT NULL
    ) mf
    CROSS JOIN (
        -- ETFs
        SELECT SUM(ea.current_value) AS balance
        FROM etf_accounts ea
        WHERE ea.user_id = (SELECT user_id FROM parameters)
          AND ea.current_value IS NOT NULL
    ) etf
)

-- Final Result: Sector-wise allocation with percentages (against total wealth)
SELECT 
    esa.sector,
    esa.sector_value AS total_value
--    ROUND(((esa.sector_value / tpw.total_wealth) * 100)::numeric, 1) AS percentage,
--    esa.number_of_holdings,
--    tpw.total_wealth
FROM equity_sector_allocation esa
CROSS JOIN total_portfolio_wealth tpw
ORDER BY esa.sector_value DESC;
