SELECT
    COALESCE(SUM((ua.data_json ->> 'current_value')::numeric), 0) AS total_current_value
FROM public.user_assets ua
WHERE ua.user_id = {USER_ID}
  AND ua.asset_class_id = 22
  AND ua.data_json ? 'current_value';
