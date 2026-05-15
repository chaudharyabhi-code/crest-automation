WITH manual_nps AS (
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
        END AS value,
        'MANUAL' AS source
    FROM user_assets ua
    LEFT JOIN asset_classes ac ON ua.asset_class_id = ac.id
    WHERE ua.user_id = {USER_ID}
      AND ua.deleted_at IS NULL
      AND ua.is_manual_entry = true
      AND ac.type = 'nps'
),
automated_nps AS (
    SELECT DISTINCT ON (n.user_id)
        'NPS Account' AS name,
        COALESCE(n.current_value, 0) AS value,
        'AUTOMATED' AS source
    FROM nps n
    WHERE n.user_id IN ({USER_ID})
      AND n.deleted_at IS NULL
    ORDER BY n.user_id, n.updated_at DESC
),
all_nps AS (
    SELECT name, value, source FROM manual_nps    WHERE value > 0
    UNION ALL
    SELECT name, value, source FROM automated_nps WHERE value > 0
),
grand_total AS (SELECT SUM(value) AS total FROM all_nps)
SELECT
    name,
--    source,
--    ROUND(value::numeric, 2) AS value,
    ROUND((value / NULLIF(gt.total, 0) * 100)::numeric, 2) AS percentage
--    CASE WHEN (value / NULLIF(gt.total, 0) * 100) > 10 THEN 'RISK' ELSE 'OK' END AS risk_flag
FROM all_nps CROSS JOIN grand_total gt
ORDER BY percentage DESC
LIMIT 5;

