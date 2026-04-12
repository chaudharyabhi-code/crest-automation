-- Total Wealth Calculation Test Case
-- Calculates comprehensive wealth across all account types for specified user

WITH user_ids AS (
    SELECT unnest(ARRAY[{USER_ID}]) AS user_id
)

SELECT
    /* Deposits */
    COALESCE((
        SELECT SUM(d.account_current_balance)
        FROM deposits d
        JOIN user_ids u ON u.user_id = d.user_id
    ), 0) AS deposits_total,

    /* Equity */
    COALESCE((
        SELECT SUM(da.current_value)
        FROM demat_accounts da
        JOIN user_ids u ON u.user_id = da.user_id
    ), 0) AS equity_total,

    /* ETF */
    COALESCE((
        SELECT SUM(ea.current_value)
        FROM etf_accounts ea
        JOIN user_ids u ON u.user_id = ea.user_id
    ), 0) AS etf_total,

    /* Mutual Funds */
    COALESCE((
        SELECT SUM(m.current_value)
        FROM mf m
        JOIN user_ids u ON u.user_id = m.user_id
    ), 0) AS mf_total,

    /* NPS */
    COALESCE((
        SELECT SUM(n.current_value)
        FROM nps n
        JOIN user_ids u ON u.user_id = n.user_id
    ), 0) AS nps_total,

    /* Recurring Deposits */
    COALESCE((
        SELECT SUM(rd.account_current_value)
        FROM recurring_deposits rd
        JOIN user_ids u ON u.user_id = rd.user_id
    ), 0) AS recurring_deposits_total,

    /* Term Deposits */
    COALESCE((
        SELECT SUM(td.account_current_balance)
        FROM term_deposits td
        JOIN user_ids u ON u.user_id = td.user_id
    ), 0) AS term_deposits_total,

    /* Grand Total */
    (
        COALESCE((SELECT SUM(d.account_current_balance)
                  FROM deposits d
                  JOIN user_ids u ON u.user_id = d.user_id), 0)
      + COALESCE((SELECT SUM(da.current_value)
                  FROM demat_accounts da
                  JOIN user_ids u ON u.user_id = da.user_id), 0)
      + COALESCE((SELECT SUM(ea.current_value)
                  FROM etf_accounts ea
                  JOIN user_ids u ON u.user_id = ea.user_id), 0)
      + COALESCE((SELECT SUM(m.current_value)
                  FROM mf m
                  JOIN user_ids u ON u.user_id = m.user_id), 0)
      + COALESCE((SELECT SUM(n.current_value)
                  FROM nps n
                  JOIN user_ids u ON u.user_id = n.user_id), 0)
      + COALESCE((SELECT SUM(rd.account_current_value)
                  FROM recurring_deposits rd
                  JOIN user_ids u ON u.user_id = rd.user_id), 0)
      + COALESCE((SELECT SUM(td.account_current_balance)
                  FROM term_deposits td
                  JOIN user_ids u ON u.user_id = td.user_id), 0)
    ) AS grand_total;
