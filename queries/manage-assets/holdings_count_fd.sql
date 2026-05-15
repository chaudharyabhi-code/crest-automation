SELECT
    (SELECT COUNT(*) FROM term_deposits WHERE user_id = {USER_ID})
    +
    (SELECT COUNT(*) FROM user_assets WHERE user_id = {USER_ID} AND asset_class_id = 15 AND is_manual_entry = TRUE)
    AS count;
