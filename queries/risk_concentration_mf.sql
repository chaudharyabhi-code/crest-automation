WITH RECURSIVE

user_mf AS (
    SELECT DISTINCT ON (mf.user_id, mf.isin)
        mf.isin AS fund_isin,
        mf.fund_name,
        mf.current_value
    FROM mf
    WHERE mf.user_id = {USER_ID}
      AND mf.deleted_at IS NULL
      AND mf.current_value > 0
    ORDER BY mf.user_id, mf.isin, mf.updated_at DESC
),

mf_tree AS (
    SELECT
        um.fund_isin AS root_isin,
        COALESCE(h.holding_isin, h.holding_name, um.fund_isin)::text AS holding_identifier,
        h.holding_isin::text,
        COALESCE(h.holding_name, um.fund_name)::text AS holding_name,
        h.sector::text AS sector,
        (um.current_value * COALESCE(h.weighting,
            CASE WHEN h.fund_isin IS NULL THEN 100.0 ELSE 0 END) / 100.0) AS effective_value,
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
    WHERE ft.is_leaf = false
      AND NOT h.fund_isin = ANY(ft.path)
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

grand_total AS (
    SELECT SUM(value) AS total FROM mf_underlying WHERE value > 0
),

with_pct AS (
    SELECT
        mu.name,
        mu.sector,
        mu.value,
        ROUND((mu.value / NULLIF(gt.total, 0) * 100)::numeric, 2) AS pct,
        gt.total AS grand_total
    FROM mf_underlying mu
    CROSS JOIN grand_total gt
    WHERE mu.value > 0
),

sector_agg AS (
    SELECT
        sector AS name,
        SUM(value)  AS value,
        SUM(pct)    AS pct,
        grand_total
    FROM with_pct
    WHERE sector IS NOT NULL AND sector != 'Unknown'
    GROUP BY sector, grand_total
),

all_items AS (
    SELECT name, sector, value, pct, grand_total, 'STOCK' AS asset_type FROM with_pct
    UNION ALL
    SELECT name, name AS sector, value, pct, grand_total, 'SECTOR' AS asset_type FROM sector_agg
)

SELECT * FROM (
    SELECT * FROM (
        SELECT
--            'STOCK' AS contributor_type,
            name,
--            sector,
--            ROUND(value::numeric, 2)       AS value,
            pct                            AS portfolio_percentage
--            ROUND(grand_total::numeric, 2) AS grand_total
        FROM all_items
        WHERE asset_type = 'STOCK' AND pct > 10
        ORDER BY pct DESC
        LIMIT 5
    ) stocks

    UNION ALL

    SELECT * FROM (
        SELECT
--            'SECTOR' AS contributor_type,
            name,
--            sector,
--            ROUND(value::numeric, 2)       AS value,
            pct                            AS portfolio_percentage
--            ROUND(grand_total::numeric, 2) AS grand_total
        FROM all_items
        WHERE asset_type = 'SECTOR' AND pct > 15
        ORDER BY pct DESC
        LIMIT 5
    ) sectors
) combined
--ORDER BY percentage DESC;
