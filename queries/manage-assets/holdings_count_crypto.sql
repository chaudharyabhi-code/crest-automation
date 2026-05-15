SELECT
    COUNT(*) AS count
FROM user_assets
WHERE user_id = {USER_ID}
  AND asset_class_id = 19
  AND is_manual_entry = TRUE;
