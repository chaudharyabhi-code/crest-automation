WITH automated AS (
    SELECT COUNT(*) AS cnt FROM demat_holdings          WHERE user_id = {USER_ID}
    UNION ALL
    SELECT COUNT(*) FROM mf                             WHERE user_id = {USER_ID} AND current_value != 0
    UNION ALL
    SELECT COUNT(*) FROM etf_holdings                   WHERE user_id = {USER_ID}
    UNION ALL
    SELECT COUNT(*) FROM deposits                       WHERE user_id = {USER_ID}
    UNION ALL
    SELECT COUNT(*) FROM term_deposits                  WHERE user_id = {USER_ID}
    UNION ALL
    SELECT COUNT(*) FROM recurring_deposits             WHERE user_id = {USER_ID}
    UNION ALL
    SELECT COUNT(*) FROM nps_holdings                   WHERE user_id = {USER_ID}
),
manual AS (
    SELECT COUNT(*) AS cnt
    FROM user_assets
    WHERE user_id = {USER_ID}
      AND is_manual_entry = TRUE
)
SELECT
    (SELECT SUM(cnt) FROM automated) + (SELECT cnt FROM manual) AS count;
