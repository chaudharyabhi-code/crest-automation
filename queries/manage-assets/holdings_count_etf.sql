SELECT
    (SELECT COUNT(*) FROM etf_holdings WHERE user_id = {USER_ID})
    +
    (SELECT COUNT(*) FROM user_assets WHERE user_id = {USER_ID} AND asset_class_id = 18 AND is_manual_entry = TRUE)
    AS count;
