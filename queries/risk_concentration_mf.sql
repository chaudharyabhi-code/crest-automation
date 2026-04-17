-- Mutual Fund Risk Concentration - Sector and Asset Level Analysis
-- Shows only sectors > 20% and assets > 10% concentration

WITH parameters AS (
    SELECT 
        {USER_ID}::integer AS user_id,
        2::integer AS decimal_places,
        0::numeric AS min_value_filter
),

-- ============================================================================
-- 1. MUTUAL FUND ASSETS (underlying holdings)
-- ============================================================================
user_mf AS (
    SELECT DISTINCT ON (mf.user_id, mf.isin)
        mf.isin AS fund_isin,
        mf.current_value
    FROM mf mf
    CROSS JOIN parameters p
    WHERE mf.user_id = p.user_id
      AND mf.deleted_at IS NULL
      AND mf.current_value > 0
    ORDER BY mf.user_id, mf.isin, mf.updated_at DESC
),

mf_assets AS (
    SELECT 
        CASE 
            WHEN COALESCE(h.holding_name, h.holding_isin) = 'Unknown' 
            THEN 'Others'
            ELSE COALESCE(h.holding_name, h.holding_isin)
        END AS asset_name,
        SUM(um.current_value * COALESCE(h.weighting, 0) / 100) AS value,
        'mf' AS asset_class,
        COALESCE(h.sector, 'Others') AS sector,
        'system' AS source
    FROM user_mf um
    JOIN mf_fund_holdings h ON um.fund_isin = h.fund_isin
    WHERE h.holding_isin IS NOT NULL OR h.holding_name IS NOT NULL
      AND COALESCE(h.weighting, 0) > 0
    GROUP BY 
        CASE 
            WHEN COALESCE(h.holding_name, h.holding_isin) = 'Unknown' 
            THEN 'Others'
            ELSE COALESCE(h.holding_name, h.holding_isin)
        END, 
        h.sector
),

-- ============================================================================
-- 2. TOTAL PORTFOLIO VALUE
-- ============================================================================
total_portfolio AS (
    SELECT COALESCE(SUM(value), 0) AS total_value
    FROM mf_assets
    CROSS JOIN parameters p
    WHERE value > p.min_value_filter
),

-- ============================================================================
-- 3. SECTOR TOTALS FOR ORDERING
-- ============================================================================
sector_totals_for_order AS (
    SELECT 
        sector,
        SUM(value) AS sector_total
    FROM mf_assets ma
    CROSS JOIN parameters p
    WHERE ma.value > p.min_value_filter
    GROUP BY sector
),

-- ============================================================================
-- 4. SECTOR BREAKDOWN (level = 'sector')
-- ============================================================================
sector_totals AS (
    SELECT 
        ma.sector,
        'TOTAL' AS asset_name,
        STRING_AGG(DISTINCT ma.asset_class, ', ') AS asset_classes,
        'sector' AS level,
        SUM(ma.value) AS value,
        CASE 
            WHEN tp.total_value > 0 THEN
                ROUND((SUM(ma.value)::numeric / tp.total_value::numeric) * 100, p.decimal_places)
            ELSE 0
        END AS portfolio_percentage,
        sto.sector_total,
        tp.total_value
    FROM mf_assets ma
    CROSS JOIN total_portfolio tp
    CROSS JOIN parameters p
    JOIN sector_totals_for_order sto ON ma.sector = sto.sector
    WHERE ma.value > p.min_value_filter
    GROUP BY ma.sector, sto.sector_total, p.decimal_places, tp.total_value
),

-- ============================================================================
-- 5. ASSET BREAKDOWN (level = 'asset')
-- ============================================================================
asset_breakdown AS (
    SELECT 
        ma.sector,
        ma.asset_name,
        ma.asset_class,
        'asset' AS level,
        SUM(ma.value) AS value,
        CASE 
            WHEN tp.total_value > 0 THEN
                ROUND((SUM(ma.value)::numeric / tp.total_value::numeric) * 100, p.decimal_places)
            ELSE 0
        END AS portfolio_percentage,
        sto.sector_total,
        tp.total_value
    FROM mf_assets ma
    CROSS JOIN total_portfolio tp
    CROSS JOIN parameters p
    JOIN sector_totals_for_order sto ON ma.sector = sto.sector
    WHERE ma.value > p.min_value_filter
    GROUP BY ma.sector, ma.asset_name, ma.asset_class, sto.sector_total, p.decimal_places, tp.total_value
),

-- ============================================================================
-- 6. COMBINED RESULTS
-- ============================================================================
combined_results AS (
    SELECT 
        sector,
        asset_name,
        asset_classes AS asset_class,
        level,
        ROUND(value::numeric, 2) AS value,
        portfolio_percentage,
        ROUND(total_value::numeric, 2) AS total_portfolio_value,
        sector_total
    FROM sector_totals
    UNION ALL
    SELECT 
        sector,
        CONCAT('', asset_name) AS asset_name,
        asset_class,
        level,
        ROUND(value::numeric, 2) AS value,
        portfolio_percentage,
        ROUND(total_value::numeric, 2) AS total_portfolio_value,
        sector_total
    FROM asset_breakdown
)

-- ============================================================================
-- FINAL RESULT: FILTERED AND SORTED
-- ============================================================================
SELECT 
    CASE 
        WHEN level = 'sector' THEN sector
        ELSE asset_name
    END AS name,
    asset_class,
    level,
    value,
    portfolio_percentage,
    total_portfolio_value,
    sector_total
FROM combined_results
WHERE 
    -- Show only sectors > 20% and assets > 10%
    (level = 'sector' AND portfolio_percentage > 20)
    OR (level = 'asset' AND portfolio_percentage > 10)
ORDER BY 
    -- Priority: Sectors first, then assets
    CASE WHEN level = 'sector' THEN 0 ELSE 1 END,
    -- Sort by portfolio percentage descending
    portfolio_percentage DESC;
