-- Top 5 Current Holdings SQL
-- Returns top 5 holdings across all asset classes for a user
-- Format: id | holding_name | current_balance | portfolio_percentage

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id  -- Change this to your user ID
),

-- Top deposits by balance
deposits_latest AS (
    SELECT DISTINCT ON (d.user_id, d.account_ref_number)
        d.id,
        d.user_id,
        COALESCE(d.fip_name, d.account_type, 'Deposit Account') AS name,
        'Cash Balance' AS type,
        d.account_current_balance AS balance,
        d.last_fetch_date_time::timestamptz AS last_updated
    FROM deposits d
    WHERE d.user_id = (SELECT user_id FROM parameters)
      AND d.account_current_balance IS NOT NULL
      AND d.account_current_balance > 0
    ORDER BY d.user_id, d.account_ref_number, d.last_fetch_date_time DESC
),

-- Top term deposits by balance
term_deposits_latest AS (
    SELECT DISTINCT ON (td.user_id, td.account_ref_number)
        td.id,
        td.user_id,
        COALESCE(td.fip_name, td.account_type, 'Term Deposit') AS name,
        'Term Deposits' AS type,
        td.account_current_balance AS balance,
        td.last_fetch_date_time::timestamptz AS last_updated
    FROM term_deposits td
    WHERE td.user_id = (SELECT user_id FROM parameters)
      AND td.account_current_balance IS NOT NULL
      AND td.account_current_balance > 0
    ORDER BY td.user_id, td.account_ref_number, td.last_fetch_date_time DESC
),

-- Top recurring deposits by current value
recurring_deposits_latest AS (
    SELECT DISTINCT ON (rd.user_id, rd.account_ref_number)
        rd.id,
        rd.user_id,
        COALESCE(rd.fip_name, rd.account_type, 'Recurring Deposit') AS name,
        'Recurring Deposits' AS type,
        rd.account_current_value AS balance,
        rd.last_fetch_date_time::timestamptz AS last_updated
    FROM recurring_deposits rd
    WHERE rd.user_id = (SELECT user_id FROM parameters)
      AND rd.account_current_value IS NOT NULL
      AND rd.account_current_value > 0
    ORDER BY rd.user_id, rd.account_ref_number, rd.last_fetch_date_time DESC
),

-- Top NPS by current value
nps_latest AS (
    SELECT DISTINCT ON (n.user_id)
        n.id,
        n.user_id,
        'NPS Account' AS name,
        'NPS' AS type,
        n.current_value AS balance,
        n.updated_at::timestamptz AS last_updated
    FROM nps n
    WHERE n.user_id = (SELECT user_id FROM parameters)
      AND n.current_value IS NOT NULL
      AND n.current_value > 0
    ORDER BY n.user_id, n.updated_at DESC, n.id DESC
),

-- Top equities by market value
equity_latest AS (
    SELECT DISTINCT ON (dh.user_id, dh.demat_account_id, dh.isin)
        dh.id,
        dh.user_id,
        COALESCE(
            NULLIF(dh.issuer_name, ''),
            NULLIF(dh.isin_description, ''),
            COALESCE(NULLIF(dh.bse_symbol, ''), NULLIF(dh.nse_symbol, '')),
            'Equity Holding'
        ) AS name,
        'Equity' AS type,
        COALESCE(dh.units, 0) * COALESCE(dh.last_traded_price, 0) AS balance,
        dh.last_fetch_time::timestamptz AS last_updated
    FROM demat_holdings dh
    WHERE dh.user_id = (SELECT user_id FROM parameters)
      AND dh.units IS NOT NULL
      AND dh.last_traded_price IS NOT NULL
      AND dh.units * dh.last_traded_price > 0
    ORDER BY dh.user_id, dh.demat_account_id, dh.isin,
             dh.last_fetch_time DESC NULLS LAST, dh.id DESC
),

-- Top MF by current value
mf_latest AS (
    SELECT DISTINCT ON (mf.user_id, mf.isin)
        mf.id,
        mf.user_id,
        COALESCE(mf.fund_name, 'MF Holding') AS name,
        'MF' AS type,
        mf.current_value AS balance,
        mf.updated_at::timestamptz AS last_updated
    FROM mf mf
    WHERE mf.user_id = (SELECT user_id FROM parameters)
      AND mf.current_value IS NOT NULL
      AND mf.current_value > 0
    ORDER BY mf.user_id, mf.isin, mf.updated_at DESC
),

-- Top ETFs by current value
etf_latest AS (
    SELECT DISTINCT ON (eh.user_id, eh.etf_account_id, eh.isin)
        eh.id,
        eh.user_id,
        COALESCE(NULLIF(eh.scheme_name, ''), 'ETF Holding') AS name,
        'ETF' AS type,
        COALESCE(eh.current_value, 0) AS balance,
        eh.current_nav_date::timestamptz AS last_updated
    FROM etf_holdings eh
    WHERE eh.user_id = (SELECT user_id FROM parameters)
      AND eh.current_value IS NOT NULL
      AND eh.current_value > 0
    ORDER BY eh.user_id, eh.etf_account_id, eh.isin,
             eh.current_nav_date DESC NULLS LAST, eh.id DESC
),

-- Top Manual Assets
manual_assets_latest AS (
    SELECT 
        ua.id,
        ua.user_id,
        COALESCE(ua.user_asset_name, ac.name, 'Manual Asset') AS name,
        CASE 
            WHEN ac.type = 'gold' THEN 'Gold'
            WHEN ac.type = 'real_estate' THEN 'Real Estate'
            WHEN ac.type = 'crypto' THEN 'Crypto'
            WHEN ac.type = 'equity' THEN 'Equity'
            WHEN ac.type = 'mf' THEN 'MF'
            WHEN ac.type = 'etf' THEN 'ETF'
            WHEN ac.type = 'deposits' THEN 'Cash Balance'
            WHEN ac.type = 'term' THEN 'Term Deposits'
            WHEN ac.type = 'recurring' THEN 'Recurring Deposits'
            WHEN ac.type = 'nps' THEN 'NPS'
            ELSE ac.name
        END AS type,
        COALESCE((ua.data_json->>'current_value')::numeric, (ua.data_json->>'value')::numeric, 0) AS balance,
        to_timestamp(ua.updated_at)::timestamptz AS last_updated
    FROM user_assets ua
    JOIN asset_classes ac ON ua.asset_class_id = ac.id
    WHERE ua.user_id = (SELECT user_id FROM parameters)
      AND ua.is_manual_entry = true
      AND ua.deleted_at IS NULL
      AND COALESCE((ua.data_json->>'current_value')::numeric, (ua.data_json->>'value')::numeric, 0) > 0
    ORDER BY balance DESC
),

-- Combine all holdings
all_holdings AS (
    SELECT id, user_id, name, type, balance, last_updated FROM deposits_latest
    UNION ALL
    SELECT id, user_id, name, type, balance, last_updated FROM term_deposits_latest
    UNION ALL
    SELECT id, user_id, name, type, balance, last_updated FROM recurring_deposits_latest
    UNION ALL
    SELECT id, user_id, name, type, balance, last_updated FROM nps_latest
    UNION ALL
    SELECT id, user_id, name, type, balance, last_updated FROM equity_latest
    UNION ALL
    SELECT id, user_id, name, type, balance, last_updated FROM mf_latest
    UNION ALL
    SELECT id, user_id, name, type, balance, last_updated FROM etf_latest
    UNION ALL
    SELECT id, user_id, name, type, balance, last_updated FROM manual_assets_latest
),

-- Get total portfolio value for percentage calculation
total_portfolio AS (
    SELECT SUM(balance) AS total_value
    FROM (
        SELECT balance FROM deposits_latest
        UNION ALL
        SELECT balance FROM term_deposits_latest
        UNION ALL
        SELECT balance FROM recurring_deposits_latest
        UNION ALL
        SELECT balance FROM nps_latest
        UNION ALL
        SELECT balance FROM equity_latest
        UNION ALL
        SELECT balance FROM mf_latest
        UNION ALL
        SELECT balance FROM etf_latest
        UNION ALL
        SELECT balance FROM manual_assets_latest
    ) all_balances
    WHERE balance > 0
)

-- Final Result: Top 5 holdings with portfolio percentage
SELECT 
    id,
    name AS holding_name,
    balance AS current_balance,
    type AS holding_type,
    last_updated,
    ROUND(((balance::numeric / tp.total_value) * 100)::numeric, 1) AS portfolio_percentage
FROM all_holdings ah
CROSS JOIN total_portfolio tp
WHERE ah.balance > 0
ORDER BY ah.balance DESC
LIMIT 5;
