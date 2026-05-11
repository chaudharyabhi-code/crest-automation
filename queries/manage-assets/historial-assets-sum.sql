WITH specific_user_assets AS (
    SELECT *
    FROM user_assets ua
    WHERE ua.user_id IN ({USER_ID})
)

SELECT
    COALESCE(SUM((ua.data_json ->> 'current_value')::numeric), 0) AS total_current_value
FROM specific_user_assets ua
WHERE ua.data_json ? 'current_value'
  AND (
       (ua.data_json ->> 'purchase_date')::date <= DATE '{END_DATE}'
    OR (ua.data_json ->> 'start_date')::date <= DATE '{END_DATE}'
    OR ua.asset_class_id = 22
  );
