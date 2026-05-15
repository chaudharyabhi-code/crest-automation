SELECT
    (SELECT COUNT(*) FROM deposits WHERE user_id = {USER_ID})
    +
    (SELECT COUNT(*) FROM user_assets WHERE user_id = {USER_ID} AND asset_class_id = 22 AND is_manual_entry = TRUE)
    AS count;
