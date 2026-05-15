WITH RECURSIVE

user_mf AS (
    SELECT DISTINCT ON (mf.user_id, mf.isin)
        mf.isin AS fund_isin, mf.fund_name, mf.current_value
    FROM mf
    WHERE mf.user_id = {USER_ID} AND mf.deleted_at IS NULL AND mf.current_value > 0
    ORDER BY mf.user_id, mf.isin, mf.updated_at DESC
),
mf_tree AS (
    SELECT
        um.fund_isin AS root_isin,
        COALESCE(h.holding_isin, h.holding_name, um.fund_isin)::text AS holding_identifier,
        h.holding_isin::text,
        COALESCE(h.holding_name, um.fund_name)::text AS holding_name,
        h.sector::text AS sector,
        (um.current_value * COALESCE(h.weighting, CASE WHEN h.fund_isin IS NULL THEN 100.0 ELSE 0 END) / 100.0) AS effective_value,
        1 AS depth,
        ARRAY[um.fund_isin]::varchar[] AS path,
        CASE
            WHEN h.sector IN ('mf_units', 'etf_units', 'Overseas ETF Units')
                 AND h.holding_isin IS NOT NULL
                 AND EXISTS (SELECT 1 FROM mf_fund_holdings h2 WHERE h2.fund_isin = h.holding_isin)
            THEN false ELSE true
        END AS is_leaf
    FROM user_mf um
    LEFT JOIN mf_fund_holdings h ON um.fund_isin = h.fund_isin

    UNION ALL

    SELECT
        ft.root_isin,
        COALESCE(h.holding_isin, h.holding_name)::text,
        h.holding_isin::text,
        h.holding_name::text,
        h.sector::text,
        (ft.effective_value * COALESCE(h.weighting, 0) / 100.0),
        ft.depth + 1,
        ft.path || h.fund_isin,
        CASE
            WHEN h.sector IN ('mf_units', 'etf_units', 'Overseas ETF Units')
                 AND h.holding_isin IS NOT NULL
                 AND EXISTS (SELECT 1 FROM mf_fund_holdings h2 WHERE h2.fund_isin = h.holding_isin)
            THEN false ELSE true
        END
    FROM mf_tree ft
    JOIN mf_fund_holdings h ON h.fund_isin = ft.holding_isin
    WHERE ft.is_leaf = false AND NOT h.fund_isin = ANY(ft.path)
),
mf_underlying AS (
    SELECT
        holding_identifier AS holding_isin,
        MAX(holding_name) AS name,
        CASE
            WHEN sector IN ('mf_units', 'etf_units', 'Overseas ETF Units') THEN 'Others'
            ELSE COALESCE(NULLIF(TRIM(sector), ''), 'Others')
        END AS sector,
        SUM(effective_value) AS value
    FROM mf_tree
    WHERE is_leaf = true
    GROUP BY holding_identifier,
        CASE
            WHEN sector IN ('mf_units', 'etf_units', 'Overseas ETF Units') THEN 'Others'
            ELSE COALESCE(NULLIF(TRIM(sector), ''), 'Others')
        END
),

user_etf AS (
    SELECT DISTINCT ON (eh.user_id, eh.etf_account_id, eh.isin)
        eh.isin AS etf_isin, eh.scheme_name, eh.current_value
    FROM etf_holdings eh
    WHERE eh.user_id = {USER_ID} AND eh.deleted_at IS NULL AND eh.current_value > 0
    ORDER BY eh.user_id, eh.etf_account_id, eh.isin, eh.current_nav_date DESC NULLS LAST
),
etf_tree AS (
    SELECT
        ue.etf_isin AS root_isin,
        COALESCE(h.holding_isin, h.holding_name, ue.etf_isin)::text AS holding_identifier,
        h.holding_isin::text,
        COALESCE(h.holding_name, ue.scheme_name)::text AS holding_name,
        h.sector::text AS sector,
        (ue.current_value * COALESCE(h.weighting, CASE WHEN h.etf_isin IS NULL THEN 100.0 ELSE 0 END) / 100.0) AS effective_value,
        1 AS depth,
        ARRAY[ue.etf_isin]::varchar[] AS path,
        CASE
            WHEN h.sector IN ('mf_units', 'etf_units', 'Overseas ETF Units')
                 AND h.holding_isin IS NOT NULL
                 AND EXISTS (SELECT 1 FROM etf_holdings_fund h2 WHERE h2.etf_isin = h.holding_isin)
            THEN false ELSE true
        END AS is_leaf
    FROM user_etf ue
    LEFT JOIN etf_holdings_fund h ON ue.etf_isin = h.etf_isin

    UNION ALL

    SELECT
        ft.root_isin,
        COALESCE(h.holding_isin, h.holding_name)::text,
        h.holding_isin::text,
        h.holding_name::text,
        h.sector::text,
        (ft.effective_value * COALESCE(h.weighting, 0) / 100.0),
        ft.depth + 1,
        ft.path || h.etf_isin,
        CASE
            WHEN h.sector IN ('mf_units', 'etf_units', 'Overseas ETF Units')
                 AND h.holding_isin IS NOT NULL
                 AND EXISTS (SELECT 1 FROM etf_holdings_fund h2 WHERE h2.etf_isin = h.holding_isin)
            THEN false ELSE true
        END
    FROM etf_tree ft
    JOIN etf_holdings_fund h ON h.etf_isin = ft.holding_isin
    WHERE ft.is_leaf = false AND NOT h.etf_isin = ANY(ft.path)
),
etf_underlying AS (
    SELECT
        holding_identifier AS holding_isin,
        MAX(holding_name) AS name,
        CASE
            WHEN sector IN ('mf_units', 'etf_units', 'Overseas ETF Units') THEN 'Others'
            ELSE COALESCE(NULLIF(TRIM(sector), ''), 'Others')
        END AS sector,
        SUM(effective_value) AS value
    FROM etf_tree
    WHERE is_leaf = true
    GROUP BY holding_identifier,
        CASE
            WHEN sector IN ('mf_units', 'etf_units', 'Overseas ETF Units') THEN 'Others'
            ELSE COALESCE(NULLIF(TRIM(sector), ''), 'Others')
        END
),

equity_raw AS (
    SELECT DISTINCT ON (dh.user_id, dh.demat_account_id, dh.isin)
        COALESCE(sm.company_name, dh.issuer_name, dh.isin_description, dh.isin) AS name,
        COALESCE(dh.units * dh.last_traded_price, 0) AS value,
        COALESCE(NULLIF(TRIM(sm.sector), ''), 'Others') AS sector
    FROM demat_holdings dh
    LEFT JOIN securities_master sm ON dh.security_id = sm.id
    WHERE dh.user_id = {USER_ID} AND dh.deleted_at IS NULL
    ORDER BY dh.user_id, dh.demat_account_id, dh.isin, dh.last_fetch_time DESC NULLS LAST
),

volatile_combined AS (
    SELECT NULL::text AS holding_isin, name, sector, value FROM equity_raw
    UNION ALL
    SELECT holding_isin, name, sector, value FROM mf_underlying
    UNION ALL
    SELECT holding_isin, name, sector, value FROM etf_underlying
),
volatile_aggregated AS (
    SELECT
        COALESCE(holding_isin, name) AS agg_key,
        MAX(name) AS name,
        (ARRAY_AGG(sector ORDER BY (CASE WHEN holding_isin IS NULL THEN 1 ELSE 2 END) ASC)
            FILTER (WHERE sector IS NOT NULL))[1] AS sector,
        SUM(value) AS value,
        'STOCK' AS asset_type
    FROM volatile_combined
    GROUP BY COALESCE(holding_isin, name)
),

deposits_agg AS (
    SELECT DISTINCT ON (d.user_id, d.account_ref_number)
        COALESCE(d.fip_name, d.masked_acc_number, 'Deposit Account') AS name,
        COALESCE(d.account_current_balance, 0) AS value,
        'OTHER' AS asset_type
    FROM deposits d
    WHERE d.user_id = {USER_ID}
    ORDER BY d.user_id, d.account_ref_number, d.last_fetch_date_time DESC NULLS LAST
),
term_deposits_agg AS (
    SELECT DISTINCT ON (td.user_id, td.account_ref_number)
        COALESCE(td.fip_name, td.masked_acc_number, 'Term Deposit') AS name,
        COALESCE(td.account_current_balance, 0) AS value,
        'OTHER' AS asset_type
    FROM term_deposits td
    WHERE td.user_id = {USER_ID}
    ORDER BY td.user_id, td.account_ref_number, td.last_fetch_date_time DESC NULLS LAST
),
recurring_deposits_agg AS (
    SELECT DISTINCT ON (rd.user_id, rd.account_ref_number)
        COALESCE(rd.fip_name, rd.masked_acc_number, 'Recurring Deposit') AS name,
        COALESCE(rd.account_current_value, 0) AS value,
        'OTHER' AS asset_type
    FROM recurring_deposits rd
    WHERE rd.user_id = {USER_ID}
    ORDER BY rd.user_id, rd.account_ref_number, rd.last_fetch_date_time DESC NULLS LAST
),
nps_agg AS (
    SELECT DISTINCT ON (n.user_id)
        'NPS Account' AS name,
        COALESCE(n.current_value, 0) AS value,
        'OTHER' AS asset_type
    FROM nps n
    WHERE n.user_id = {USER_ID} AND n.deleted_at IS NULL
    ORDER BY n.user_id, n.updated_at DESC
),

all_holdings AS (
    SELECT name, value, sector, asset_type FROM volatile_aggregated WHERE value > 0
    UNION ALL
    SELECT name, value, NULL::text AS sector, asset_type FROM deposits_agg        WHERE value > 0
    UNION ALL
    SELECT name, value, NULL::text AS sector, asset_type FROM term_deposits_agg   WHERE value > 0
    UNION ALL
    SELECT name, value, NULL::text AS sector, asset_type FROM recurring_deposits_agg WHERE value > 0
    UNION ALL
    SELECT name, value, NULL::text AS sector, asset_type FROM nps_agg             WHERE value > 0
),
grand_total AS (
    SELECT SUM(value) AS total_value FROM all_holdings
),
sector_agg AS (
    SELECT sector AS name, SUM(value) AS value, 'SECTOR' AS asset_type
    FROM all_holdings
    WHERE sector IS NOT NULL AND sector != 'Unknown'
    GROUP BY sector
),
all_items AS (
    SELECT name, value, asset_type FROM all_holdings
    UNION ALL
    SELECT name, value, asset_type FROM sector_agg
)

SELECT
    ai.name,
    ROUND((ai.value / NULLIF(gt.total_value, 0) * 100)::numeric, 2) AS percentage,
    ai.asset_type
FROM all_items ai
CROSS JOIN grand_total gt
WHERE
    (ai.asset_type = 'SECTOR'            AND ai.value / NULLIF(gt.total_value, 0) * 100 > 15)
    OR
    (ai.asset_type IN ('STOCK', 'OTHER') AND ai.value / NULLIF(gt.total_value, 0) * 100 > 10)
ORDER BY percentage DESC
LIMIT 5;
