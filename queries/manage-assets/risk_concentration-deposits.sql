-- Combined risk concentration for Cash Deposits (automated + manual)
-- Filters: individual asset > 10% of total deposits

WITH automated_deposits AS (
    SELECT DISTINCT ON (d.user_id, d.account_ref_number)
        COALESCE(d.fip_name, d.masked_acc_number, 'Deposit Account') AS name,
        COALESCE(d.account_current_balance, 0) AS value
    FROM deposits d
    WHERE d.user_id IN ({USER_ID})
      AND d.account_current_balance > 0
    ORDER BY d.user_id, d.account_ref_number, d.last_fetch_date_time DESC
),
manual_deposits AS (
    SELECT
        ua.user_asset_name AS name,
        CASE
            WHEN (ua.data_json->>'maturity_date') IS NOT NULL
                 AND (ua.data_json->>'maturity_date')::date < CURRENT_DATE
            THEN COALESCE((ua.data_json->>'maturity_amount')::float, 0)
            ELSE COALESCE(
                (ua.data_json->>'current_value')::float,
                (ua.data_json->>'value')::float,
                0
            )
        END AS value
    FROM user_assets ua
    JOIN asset_classes ac ON ua.asset_class_id = ac.id
    WHERE ua.user_id IN ({USER_ID})
      AND ua.is_manual_entry = true
      AND ua.deleted_at IS NULL
      AND ac.type = 'deposits'
      AND COALESCE(
            (ua.data_json->>'current_value')::float,
            (ua.data_json->>'value')::float, 0
          ) > 0
),
all_deposits AS (
    SELECT name, value FROM automated_deposits
    UNION ALL
    SELECT name, value FROM manual_deposits
),
total AS (
    SELECT SUM(value) AS total_value FROM all_deposits
)
SELECT
    name,
    ROUND((value / NULLIF(total_value, 0) * 100)::numeric, 2) AS percentage
FROM all_deposits
CROSS JOIN total
WHERE (value / NULLIF(total_value, 0) * 100) > 10
ORDER BY value DESC
LIMIT 5;
