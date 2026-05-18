WITH automated_fd AS (
    SELECT
        COALESCE(td.fip_name, 'Fixed Deposit') AS name,
        COALESCE(td.account_current_balance, 0)  AS value
    FROM term_deposits td
    WHERE td.user_id = {USER_ID}
      AND td.account_current_balance > 0
),
manual_fd AS (
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
    WHERE ua.user_id = {USER_ID}
      AND ua.deleted_at IS NULL
      AND ua.is_manual_entry = TRUE
      AND ac.type = 'term'
),
all_fd AS (
    SELECT name, value FROM automated_fd
    UNION ALL
    SELECT name, value FROM manual_fd WHERE value > 0
),
grand_total AS (
    SELECT SUM(value) AS total FROM all_fd
)
SELECT
    name,
    ROUND((value / NULLIF(gt.total, 0) * 100)::numeric, 2) AS percentage
FROM all_fd
CROSS JOIN grand_total gt
WHERE value > 0
ORDER BY percentage DESC
LIMIT 5;
