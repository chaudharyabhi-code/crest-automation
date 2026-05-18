-- Holdings Count with Manual Assets (Dashboard - Equity, MF, ETF)
-- Returns automated + manually added counts for each asset type

SELECT
    (SELECT COUNT(*) FROM demat_holdings  WHERE user_id = {USER_ID})
    + (SELECT COUNT(*) FROM user_assets   WHERE user_id = {USER_ID} AND asset_class_id = 17 AND is_manual_entry = TRUE)
    AS equity_count,

    (SELECT COUNT(*) FROM etf_holdings    WHERE user_id = {USER_ID})
    + (SELECT COUNT(*) FROM user_assets   WHERE user_id = {USER_ID} AND asset_class_id = 18 AND is_manual_entry = TRUE)
    AS etf_count,

    (SELECT COUNT(*) FROM mf              WHERE user_id = {USER_ID} AND current_value != 0)
    + (SELECT COUNT(*) FROM user_assets   WHERE user_id = {USER_ID} AND asset_class_id = 21 AND is_manual_entry = TRUE)
    AS mf_count;
