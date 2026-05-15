-- Combined risk concentration for Equity (automated + manual)
-- Filters: individual asset > 10% of total equity value

WITH automated_equity AS (
    SELECT DISTINCT ON (dh.user_id, dh.demat_account_id, dh.isin)
        COALESCE(sm.company_name, dh.issuer_name, dh.isin_description, dh.isin) AS name,
        COALESCE(dh.units * dh.last_traded_price, 0) AS value
    FROM demat_holdings dh
    LEFT JOIN securities_master sm ON dh.security_id = sm.id
    WHERE dh.user_id IN ({USER_ID})
      AND dh.deleted_at IS NULL
      AND dh.units > 0
      AND dh.last_traded_price > 0
    ORDER BY dh.user_id, dh.demat_account_id, dh.isin, dh.last_fetch_time DESC NULLS LAST
),
manual_equity AS (
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
      AND ac.type = 'equity'
      AND COALESCE(
            (ua.data_json->>'current_value')::float,
            (ua.data_json->>'value')::float, 0
          ) > 0
),
all_equity AS (
    SELECT name, value FROM automated_equity
    UNION ALL
    SELECT name, value FROM manual_equity
),
total AS (
    SELECT SUM(value) AS total_value FROM all_equity
)
SELECT
    name,
    ROUND((value / NULLIF(total_value, 0) * 100)::numeric, 2) AS percentage
FROM all_equity
CROSS JOIN total
WHERE (value / NULLIF(total_value, 0) * 100) > 10
ORDER BY value DESC
LIMIT 5;
