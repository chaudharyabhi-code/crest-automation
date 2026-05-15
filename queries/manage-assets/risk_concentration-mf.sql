-- Combined risk concentration for Mutual Funds (automated + manual)
-- Filters: individual fund > 10% of total MF value

WITH automated_mf AS (
    SELECT DISTINCT ON (mf.user_id, mf.isin)
        COALESCE(mf.fund_name, mf.isin, 'MF Holding') AS name,
        COALESCE(mf.current_value, 0) AS value
    FROM mf mf
    WHERE mf.user_id IN ({USER_ID})
      AND mf.deleted_at IS NULL
      AND mf.current_value > 0
    ORDER BY mf.user_id, mf.isin, mf.updated_at DESC
),
manual_mf AS (
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
      AND ac.type = 'mf'
      AND COALESCE(
            (ua.data_json->>'current_value')::float,
            (ua.data_json->>'value')::float, 0
          ) > 0
),
all_mf AS (
    SELECT name, value FROM automated_mf
    UNION ALL
    SELECT name, value FROM manual_mf
),
total AS (
    SELECT SUM(value) AS total_value FROM all_mf
)
SELECT
    name,
    ROUND((value / NULLIF(total_value, 0) * 100)::numeric, 2) AS percentage
FROM all_mf
CROSS JOIN total
WHERE (value / NULLIF(total_value, 0) * 100) > 10
ORDER BY value DESC
LIMIT 5;
