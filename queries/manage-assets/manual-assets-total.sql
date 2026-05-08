SELECT
    COALESCE(SUM((ua.data_json ->> 'current_value')::numeric), 0) AS total_value
FROM public.user_assets ua
WHERE ua.user_id IN ({USER_ID})
  AND ua.data_json ? 'current_value';

