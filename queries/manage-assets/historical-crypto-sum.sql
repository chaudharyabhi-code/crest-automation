WITH specific_user_assets AS (
    SELECT *
    FROM user_assets ua
    WHERE ua.user_id IN ({USER_ID})
)

SELECT
    COALESCE(SUM((ua.data_json ->> 'current_value')::numeric), 0) AS total_current_value
FROM specific_user_assets ua
WHERE ua.data_json ? 'current_value'
  AND (ua.data_json ->> 'purchase_date')::date <= DATE '{END_DATE}'
  AND ua.asset_class_id = {ASSET_CLASS_ID};
