-- Asset Class Allocation: Automated + Manually Added Assets Combined
-- Outputs: asset_class, percentage (matches API allocationData[].name + current)

WITH manual_by_type AS (
    SELECT
        ac.type                                                         AS ac_type,
        COALESCE(SUM(
            COALESCE((ua.data_json->>'current_value')::numeric,
                     (ua.data_json->>'value')::numeric, 0)
        ), 0)                                                           AS manual_value
    FROM user_assets ua
    JOIN asset_classes ac ON ua.asset_class_id = ac.id
    WHERE ua.user_id = {USER_ID}
      AND ua.is_manual_entry = TRUE
      AND ua.deleted_at IS NULL
    GROUP BY ac.type
),

asset_values AS (
    -- Cash / Bank Deposits
    SELECT 'Cash'               AS asset_class,
           COALESCE(SUM(d.account_current_balance), 0)
           + COALESCE((SELECT manual_value FROM manual_by_type WHERE ac_type = 'deposits'), 0) AS value
    FROM deposits d WHERE d.user_id = {USER_ID}

    UNION ALL

    -- Recurring Deposits
    SELECT 'Recurring Deposits',
           COALESCE(SUM(rd.account_current_value), 0)
           + COALESCE((SELECT manual_value FROM manual_by_type WHERE ac_type = 'recurring'), 0)
    FROM recurring_deposits rd WHERE rd.user_id = {USER_ID}

    UNION ALL

    -- Fixed / Term Deposits
    SELECT 'Term Deposits',
           COALESCE(SUM(td.account_current_balance), 0)
           + COALESCE((SELECT manual_value FROM manual_by_type WHERE ac_type = 'term'), 0)
    FROM term_deposits td WHERE td.user_id = {USER_ID}

    UNION ALL

    -- NPS
    SELECT 'NPS',
           COALESCE(SUM(n.current_value), 0)
           + COALESCE((SELECT manual_value FROM manual_by_type WHERE ac_type = 'nps'), 0)
    FROM nps n WHERE n.user_id = {USER_ID}

    UNION ALL

    -- Equity
    SELECT 'Equity',
           COALESCE(SUM(da.current_value), 0)
           + COALESCE((SELECT manual_value FROM manual_by_type WHERE ac_type = 'equity'), 0)
    FROM demat_accounts da WHERE da.user_id = {USER_ID}

    UNION ALL

    -- ETF
    SELECT 'ETF',
           COALESCE(SUM(ea.current_value), 0)
           + COALESCE((SELECT manual_value FROM manual_by_type WHERE ac_type = 'etf'), 0)
    FROM etf_accounts ea WHERE ea.user_id = {USER_ID}

    UNION ALL

    -- Mutual Funds
    SELECT 'Mutual Funds',
           COALESCE(SUM(mf.current_value), 0)
           + COALESCE((SELECT manual_value FROM manual_by_type WHERE ac_type = 'mf'), 0)
    FROM mf mf WHERE mf.user_id = {USER_ID}

    UNION ALL

    -- Gold (manual only)
    SELECT 'Gold',
           COALESCE((SELECT manual_value FROM manual_by_type WHERE ac_type = 'gold'), 0)

    UNION ALL

    -- Real Estate (manual only)
    SELECT 'Real Estate',
           COALESCE((SELECT manual_value FROM manual_by_type WHERE ac_type = 'real_estate'), 0)

    UNION ALL

    -- Crypto (manual only)
    SELECT 'Crypto',
           COALESCE((SELECT manual_value FROM manual_by_type WHERE ac_type = 'crypto'), 0)
),

total AS (
    SELECT COALESCE(SUM(value), 0) AS total_value FROM asset_values
)

SELECT
    av.asset_class,
    ROUND((av.value / NULLIF(t.total_value, 0) * 100)::numeric, 2) AS percentage
FROM asset_values av
CROSS JOIN total t
WHERE av.value > 0
ORDER BY av.value DESC;
