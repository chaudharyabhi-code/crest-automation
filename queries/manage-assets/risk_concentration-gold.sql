
-- Deposits (manual) → ac.type = 'deposits'
-- Equity (manual)   → ac.type = 'equity'

WITH assets AS (
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
      AND ac.type = 'gold'          -- ← change per type
),
total AS (
    SELECT SUM(value) AS total_value FROM assets
)
SELECT
    name,
    ROUND((value / NULLIF(total_value, 0) * 100)::numeric, 2) AS percentage
FROM assets
CROSS JOIN total
WHERE (value / NULLIF(total_value, 0) * 100) > 10   -- risk threshold: individual asset > 10%
ORDER BY value DESC
LIMIT 5;
