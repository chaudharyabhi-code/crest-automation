-- ============================================================================== --
-- CONSOLIDATED HOLDINGS QUERY WITH WEIGHTED AVERAGE PERFORMANCE
-- Focuses on: Current Value, Cost Basis, Gains/Loss, and Portfolio Weight.
-- Includes a SUMMARY ROW at the bottom for overall portfolio performance.
-- ============================================================================== --
WITH params AS (
    SELECT 
        {USER_ID} AS target_user_id,   -- <--- SET USER ID HERE
        'ALL' AS filter_class     -- <--- SET FILTER HERE: 'ALL', 'Equity', 'Mutual Fund', 'ETF', 'Bank Balance', 'Fixed Deposit', 'Recurring Deposit', 'NPS', 'Gold', 'Real Estate'
),
raw_holdings AS (
    -- 1. Broker-linked Equity
    SELECT 
        'Equity' AS asset_class,
        issuer_name AS item_name,
        (units * last_traded_price) AS current_value,
        cost_basis
    FROM demat_holdings CROSS JOIN params
    WHERE user_id = params.target_user_id
    UNION ALL
    -- 2. Broker-linked Mutual Funds
    SELECT 
        'Mutual Fund' AS asset_class,
        fund_name AS item_name,
        current_value,
        COALESCE(invested_value, cost_basis) AS cost_basis
    FROM mf CROSS JOIN params
    WHERE user_id = params.target_user_id
    UNION ALL
    -- 3. Broker-linked ETFs
    SELECT 
        'ETF' AS asset_class,
        scheme_name AS item_name,
        current_value,
        cost_basis
    FROM etf_holdings CROSS JOIN params
    WHERE user_id = params.target_user_id
    UNION ALL
    -- 4. Linked Bank Balances
    SELECT 
        'Bank Balance' AS asset_class,
        fip_name || ' - ' || account_type AS item_name,
        account_current_balance AS current_value,
        account_current_balance AS cost_basis
    FROM deposits CROSS JOIN params
    WHERE user_id = params.target_user_id
    UNION ALL
    -- 5. Linked FDs
    SELECT 
        'Fixed Deposit' AS asset_class,
        'FD - ' || fip_name AS item_name,
        account_maturity_amount AS current_value,
        account_principal_amount AS cost_basis
    FROM term_deposits CROSS JOIN params
    WHERE user_id = params.target_user_id
    UNION ALL
    -- 6. Linked RDs
    SELECT 
        'Recurring Deposit' AS asset_class,
        'RD - ' || fip_name AS item_name,
        account_current_value AS current_value,
        account_principal_amount AS cost_basis
    FROM recurring_deposits CROSS JOIN params
    WHERE user_id = params.target_user_id
    UNION ALL
    -- 7. Linked NPS
    SELECT 
        'NPS' AS asset_class,
        scheme_name AS item_name,
        total_value_of_scheme AS current_value,
        total_value_of_scheme AS cost_basis
    FROM nps_holdings CROSS JOIN params
    WHERE user_id = params.target_user_id
    UNION ALL
    -- 8. MANUALLY CREATED ASSETS
    SELECT 
        CASE 
            WHEN ac.type = 'equity' OR ac.name ILIKE '%Equity%' THEN 'Equity'
            WHEN ac.type = 'mf' OR ac.name ILIKE '%Mutual Fund%' THEN 'Mutual Fund'
            WHEN ac.type = 'etf' OR ac.name ILIKE '%ETF%' THEN 'ETF'
            WHEN ac.type = 'deposits' OR ac.name ILIKE '%Savings%' OR ac.name ILIKE '%Bank%' THEN 'Bank Balance'
            WHEN ac.type = 'term' OR ac.name ILIKE '%Fixed Deposit%' OR ac.name ILIKE '%Term Deposit%' OR ac.name ILIKE '%FD%' THEN 'Fixed Deposit'
            WHEN ac.type = 'recurring' OR ac.name ILIKE '%Recurring Deposit%' OR ac.name ILIKE '%RD%' THEN 'Recurring Deposit'
            WHEN ac.type = 'nps' OR ac.name ILIKE '%NPS%' THEN 'NPS'
            WHEN ac.type = 'gold' OR ac.name ILIKE '%Gold%' THEN 'Gold'
            WHEN ac.type = 'real_estate' OR ac.name ILIKE '%Real Estate%' OR ac.name ILIKE '%Property%' THEN 'Real Estate'
            ELSE 'Other'
        END AS asset_class,
        ua.user_asset_name AS item_name,
        COALESCE(
            (ua.data_json->>'current_value')::FLOAT, 
            (COALESCE((ua.data_json->>'quantity')::FLOAT, (ua.data_json->>'weight_grams')::FLOAT, 0) * COALESCE((ua.data_json->>'current_price')::FLOAT, 0))
        ) AS current_value,
        CASE 
            WHEN ac.type IN ('equity', 'etf', 'crypto') THEN COALESCE((ua.data_json->>'quantity')::FLOAT, 0) * COALESCE((ua.data_json->>'buy_price')::FLOAT, 0)
            WHEN ac.type = 'mf' THEN COALESCE((ua.data_json->>'quantity')::FLOAT, 0) * COALESCE((ua.data_json->>'purchase_nav')::FLOAT, (ua.data_json->>'buy_price')::FLOAT, 0)
            WHEN ac.type = 'gold' THEN COALESCE((ua.data_json->>'weight_grams')::FLOAT, 0) * COALESCE((ua.data_json->>'purchase_price')::FLOAT, 0)
            WHEN ac.type IN ('nps', 'recurring') THEN COALESCE((ua.data_json->>'total_invested_amount')::FLOAT, 0)
            WHEN ac.type = 'term' THEN COALESCE((ua.data_json->>'principal_amount')::FLOAT, 0)
            WHEN ac.type = 'real_estate' THEN COALESCE((ua.data_json->>'purchase_cost')::FLOAT, 0)
            ELSE COALESCE((ua.data_json->>'current_value')::FLOAT, 0)
        END AS cost_basis
    FROM user_assets ua
    JOIN asset_classes ac ON ua.asset_class_id = ac.id CROSS JOIN params
    WHERE ua.user_id = params.target_user_id AND ua.is_manual_entry = TRUE
),
total_wealth_global AS (
    SELECT SUM(val) AS total_val FROM (
        SELECT SUM((ua.data_json ->> 'current_value')::FLOAT) AS val FROM public.user_assets ua CROSS JOIN params WHERE ua.user_id = params.target_user_id AND ua.data_json ? 'current_value'
        UNION ALL
        SELECT 
            (COALESCE((SELECT SUM(d.account_current_balance) FROM deposits d CROSS JOIN params WHERE d.user_id = params.target_user_id), 0)
            + COALESCE((SELECT SUM(da.current_value) FROM demat_accounts da CROSS JOIN params WHERE da.user_id = params.target_user_id), 0)
            + COALESCE((SELECT SUM(ea.current_value) FROM etf_accounts ea CROSS JOIN params WHERE ea.user_id = params.target_user_id), 0)
            + COALESCE((SELECT SUM(m.current_value) FROM mf m CROSS JOIN params WHERE m.user_id = params.target_user_id), 0)
            + COALESCE((SELECT SUM(n.current_value) FROM nps n CROSS JOIN params WHERE n.user_id = params.target_user_id), 0)
            + COALESCE((SELECT SUM(rd.account_current_value) FROM recurring_deposits rd CROSS JOIN params WHERE rd.user_id = params.target_user_id), 0)
            + COALESCE((SELECT SUM(td.account_current_balance) FROM term_deposits td CROSS JOIN params WHERE td.user_id = params.target_user_id), 0)) AS val
    ) total_sub
),
filtered_holdings AS (
    SELECT * FROM raw_holdings CROSS JOIN params 
    WHERE params.filter_class = 'ALL' OR raw_holdings.asset_class = params.filter_class
),
final_list AS (
    SELECT 
        asset_class,
        item_name,
        current_value,
        cost_basis,
        (current_value - cost_basis) AS absolute_gain_loss,
        CASE 
            WHEN cost_basis > 0 THEN ((current_value - cost_basis) / cost_basis) * 100 
            ELSE 0 
        END AS percentage_gain_loss,
        CASE 
            WHEN (SELECT total_val FROM total_wealth_global) > 0 
            THEN (current_value / (SELECT total_val FROM total_wealth_global)) * 100 
            ELSE 0 
        END AS portfolio_weight,
        1 AS sort_order
    FROM filtered_holdings
)
-- Main output with Summary Row
SELECT count(*) FROM final_list
-- SUMMARY ROW

