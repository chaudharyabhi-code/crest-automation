SELECT
    (SELECT COUNT(*) FROM demat_holdings WHERE user_id = {USER_ID})
    +
    (SELECT COUNT(*) FROM user_assets WHERE user_id = {USER_ID} AND asset_class_id = 17 AND is_manual_entry = TRUE)
    AS count;
