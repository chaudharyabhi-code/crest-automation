SELECT
    (SELECT COUNT(*) FROM recurring_deposits WHERE user_id = {USER_ID})
    +
    (SELECT COUNT(*) FROM user_assets WHERE user_id = {USER_ID} AND asset_class_id = 14 AND is_manual_entry = TRUE)
    AS count;
