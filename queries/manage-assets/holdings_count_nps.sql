SELECT
    (SELECT COUNT(*) FROM nps_holdings WHERE user_id = {USER_ID})
    +
    (SELECT COUNT(*) FROM user_assets WHERE user_id = {USER_ID} AND asset_class_id = 16 AND is_manual_entry = TRUE)
    AS count;
