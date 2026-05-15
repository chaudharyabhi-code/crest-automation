WITH manual_rd AS (
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
    LEFT JOIN asset_classes ac ON ua.asset_class_id = ac.id
    WHERE ua.user_id = {USER_ID}
      AND ua.deleted_at IS NULL
      AND ua.is_manual_entry = true
      AND ac.type = 'recurring'
),
grand_total AS (SELECT SUM(value) AS total FROM manual_rd WHERE value > 0)
SELECT
    name,
--    ROUND(value::numeric, 2) AS value,
    ROUND((value / NULLIF(gt.total, 0) * 100)::numeric, 2) AS percentage
FROM manual_rd CROSS JOIN grand_total gt
WHERE value > 0
ORDER BY percentage DESC
LIMIT 5;
