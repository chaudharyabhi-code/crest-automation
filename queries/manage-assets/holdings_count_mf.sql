SELECT
    (SELECT COUNT(*) FROM mf WHERE user_id = {USER_ID} AND current_value != 0)
    +
    (SELECT COUNT(*) FROM user_assets WHERE user_id = {USER_ID} AND asset_class_id = 21 AND is_manual_entry = TRUE)
    AS count;
