SELECT
    (
        SELECT COUNT(*)
        FROM user_assets ua
        WHERE ua.user_id = {USER_ID}
          AND ua.asset_class_id = 21
          and ua.data_json != 'null'

    ) AS mf_count,
    (
        SELECT COUNT(*)
        FROM user_assets ua
        WHERE ua.user_id = {USER_ID}
          AND ua.asset_class_id = 18
          and ua.data_json != 'null'

    ) AS etf_count,
    (
        SELECT COUNT(*)
        FROM user_assets ua
        WHERE ua.user_id = {USER_ID}
          AND ua.asset_class_id = 17
          and ua.data_json != 'null'

    ) AS equity_count;
