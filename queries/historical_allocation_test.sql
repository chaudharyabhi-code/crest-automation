--updated query for the dashbopred calcualtions

-- ============================================================================
-- TEST QUERY: get_balances_as_of Function (matches dashboard exactly)
-- ============================================================================



WITH
config AS (
    SELECT
        ARRAY[{USER_ID}]::int[] AS user_ids,
        {HISTORICAL_DATES}::TIMESTAMP AS end_date,
        NULL::TIMESTAMP AS start_date
),

deposits_latest AS (
    SELECT DISTINCT ON (bs.user_id, bs.account_id)
        bs.user_id,
        bs.current_balance AS balance
    FROM bank_statements bs
    CROSS JOIN config
    WHERE bs.user_id = ANY(config.user_ids)
      AND bs.current_balance IS NOT null
      AND (
    config.end_date IS NULL
    OR bs.transaction_timestamp
       < (config.end_date::date + INTERVAL '1 day')
)
      AND (config.start_date IS NULL OR bs.transaction_timestamp >= config.start_date)
    ORDER BY bs.user_id, bs.account_id, bs.transaction_timestamp DESC
),

recurring_latest AS (
    SELECT DISTINCT ON (rdt.user_id, rdt.account_id)
        rdt.user_id,
        rdt.balance AS balance
    FROM recurring_deposits_transactions rdt
    CROSS JOIN config
    WHERE rdt.user_id = ANY(config.user_ids)
      AND rdt.balance IS NOT NULL
      AND (config.end_date IS NULL OR rdt.transaction_datetime <= config.end_date)
      AND (config.start_date IS NULL OR rdt.transaction_datetime >= config.start_date)
    ORDER BY rdt.user_id, rdt.account_id, rdt.transaction_datetime DESC
),

term_latest AS (
    SELECT DISTINCT ON (tdt.user_id, tdt.account_id)
        tdt.user_id,
        tdt.balance AS balance
    FROM term_deposits_transactions tdt
    CROSS JOIN config
    WHERE tdt.user_id = ANY(config.user_ids)
      AND tdt.balance IS NOT NULL
      AND (config.end_date IS NULL OR tdt.transaction_datetime <= config.end_date)
      AND (config.start_date IS NULL OR tdt.transaction_datetime >= config.start_date)
    ORDER BY tdt.user_id, tdt.account_id, tdt.transaction_datetime DESC
),

nps_latest AS (
    SELECT DISTINCT ON (n.user_id)
        n.user_id,
        n.current_value AS balance
    FROM nps n
    CROSS JOIN config
    WHERE n.user_id = ANY(config.user_ids)
      AND n.current_value IS NOT NULL
      AND (config.end_date IS NULL OR n.updated_at <= config.end_date)
      AND (config.start_date IS NULL OR n.updated_at >= config.start_date)
    ORDER BY n.user_id, n.updated_at DESC, n.id DESC
),

equity_latest AS (
    SELECT DISTINCT ON (el.user_id, el.security_id, el.demat_id)
        el.user_id,
        el.security_id,
        el.demat_id,
        el.cumulative_units AS units,
        el.ledger_date
    FROM equity_ledger el
    CROSS JOIN config
    WHERE el.user_id = ANY(config.user_ids)
--      AND el.cumulative_units > 0
      AND (config.end_date IS NULL OR (
    el.ledger_date >= DATE_TRUNC('month', DATE(config.end_date))::date
    AND el.ledger_date <= DATE(config.end_date)
))
    ORDER BY el.user_id, el.security_id, el.demat_id, el.ledger_date DESC
),

equity_latest_with_price AS (
    SELECT
        el.user_id,
        SUM(COALESCE(el.units * eph.close_price, 0)) AS balance
    FROM equity_latest el
    CROSS JOIN config
    JOIN LATERAL (
        SELECT eph.close_price
        FROM equity_price_history eph
        WHERE eph.security_id = el.security_id
          AND eph.close_price IS NOT NULL
          AND (config.end_date IS NULL OR eph.trade_date <= DATE(config.end_date))
        ORDER BY eph.trade_date DESC
        LIMIT 1
    ) eph ON TRUE
    GROUP BY el.user_id
),

-- *** FIXED: ETF now uses same logic as dashboard (DATE_TRUNC + DISTINCT ON) ***
etf_latest AS (
    SELECT DISTINCT ON (el.user_id, el.isin, el.etf_account_id)
        el.user_id,
        el.isin,
        el.etf_account_id,
        el.cumulative_units AS units,
        el.ledger_date
    FROM etf_ledger el
    CROSS JOIN config
    WHERE el.user_id = ANY(config.user_ids)
      AND (config.end_date IS NULL OR (
    el.ledger_date >= DATE_TRUNC('month', DATE(config.end_date))::date
    AND el.ledger_date <= DATE(config.end_date)
))

    ORDER BY el.user_id, el.isin, el.etf_account_id, el.ledger_date DESC
),

etf_latest_with_nav AS (
    SELECT
        el.user_id,
        SUM(COALESCE(el.units * hn.nav, 0)) AS balance
    FROM etf_latest el
    CROSS JOIN config
    JOIN LATERAL (
        SELECT hn.nav
        FROM historic_nav hn
        WHERE hn.isin = el.isin
          AND hn.nav IS NOT NULL
          AND (config.end_date IS NULL OR hn.nav_date <= DATE(config.end_date))
        ORDER BY hn.nav_date DESC
        LIMIT 1
    ) hn ON TRUE
    WHERE el.units > 0
    GROUP BY el.user_id
),

mf_latest AS (
    SELECT DISTINCT ON (mfl.user_id, mfl.isin)
        mfl.user_id,
        mfl.isin,
        mfl.cumulative_units as units,
        mfl.ledger_date
    FROM mf_ledger mfl
    CROSS JOIN config
    WHERE mfl.user_id = ANY(config.user_ids)
      AND mfl.current_value IS NOT NULL
      AND (config.end_date IS NULL OR (
    mfl.ledger_date >= DATE_TRUNC('month', DATE(config.end_date))::date
    AND mfl.ledger_date <= DATE(config.end_date)
))

    ORDER BY mfl.user_id, mfl.isin, mfl.ledger_date DESC
),

mf_latest_with_nav AS (
    SELECT
        mfl.user_id,
        SUM(COALESCE(mfl.units * hn.nav, 0)) AS balance
    FROM mf_latest mfl
    CROSS JOIN config
    JOIN LATERAL (
        SELECT hn.nav
        FROM historic_nav hn
        WHERE hn.isin = mfl.isin
          AND hn.nav IS NOT NULL
          AND (config.end_date IS NULL OR hn.nav_date <= DATE(config.end_date))
        ORDER BY hn.nav_date DESC
        LIMIT 1
    ) hn ON true
      WHERE mfl.units > 0
    GROUP BY mfl.user_id
),


-- Compute each output column ONCE, then reuse for grand_total
final_balances AS (
    SELECT
        (SELECT COALESCE(SUM(balance), 0) FROM deposits_latest) AS deposits,

        (SELECT COALESCE(SUM(balance), 0) FROM recurring_latest) AS recurring,

        (SELECT COALESCE(SUM(balance), 0) FROM term_latest) AS term,

        (SELECT COALESCE(SUM(balance), 0) FROM nps_latest) AS nps,

        (SELECT COALESCE(SUM(balance), 0) FROM equity_latest_with_price) AS equity,

        (SELECT COALESCE(SUM(balance), 0) FROM etf_latest_with_nav) AS etf,

        (SELECT COALESCE(SUM(balance), 0) FROM mf_latest_with_nav) AS mf,

               (SELECT config.end_date FROM config) AS end_date_used,
        (SELECT config.start_date FROM config) AS start_date_used,
        (SELECT config.user_ids FROM config) AS user_ids_used
)

SELECT
    fb.*,
    (fb.deposits + fb.recurring + fb.term + fb.nps + fb.equity + fb.etf + fb.mf ) AS grand_total
    
FROM final_balances fb;