WITH automated_rd AS (
    SELECT
        COALESCE(rd.fip_name, 'Recurring Deposit') AS name,
        COALESCE(rd.account_current_value, 0)       AS value
    FROM recurring_deposits rd
    WHERE rd.user_id = {USER_ID}
      AND rd.account_current_value > 0
),
manual_rd AS (
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
      AND ac.type = 'recurring'
),
all_rd AS (
    SELECT name, value FROM automated_rd
    UNION ALL
    SELECT name, value FROM manual_rd WHERE value > 0
),
grand_total AS (
    SELECT SUM(value) AS total FROM all_rd
)
SELECT
    name,
    ROUND((value / NULLIF(gt.total, 0) * 100)::numeric, 2) AS percentage
FROM all_rd
CROSS JOIN grand_total gt
WHERE value > 0
ORDER BY percentage DESC
LIMIT 5;
