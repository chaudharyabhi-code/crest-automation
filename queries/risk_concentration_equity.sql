-- Equity Risk Concentration - Sector and Asset Level Analysis
-- Shows only sectors > 20% and assets > 10% concentration

WITH parameters AS (
    SELECT 
        {USER_ID}::integer AS user_id,
        2::integer AS decimal_places,
        0::numeric AS min_value_filter
),

-- ============================================================================
-- 1. EQUITY ASSETS WITH SECTOR INFO
-- ============================================================================
equity_assets AS (
    SELECT 
        CASE 
            WHEN COALESCE(sm.company_name, dh.issuer_name, dh.isin_description, dh.isin) = 'Unknown' 
            THEN 'Others'
            ELSE COALESCE(sm.company_name, dh.issuer_name, dh.isin_description, dh.isin)
        END AS asset_name,
        (dh.units * COALESCE(dh.last_traded_price, 0)) AS value,
        'equity' AS asset_class,
        COALESCE(sm.sector, 'Others') AS sector,
        'system' AS source
    FROM demat_holdings dh
    LEFT JOIN securities_master sm ON dh.security_id = sm.id
    CROSS JOIN parameters p
    WHERE dh.user_id = p.user_id
      AND dh.units > 0
      AND dh.deleted_at IS NULL
      AND dh.last_traded_price > 0
),

-- ============================================================================
-- 2. TOTAL PORTFOLIO VALUE
-- ============================================================================
total_portfolio AS (
    SELECT COALESCE(SUM(value), 0) AS total_value
    FROM equity_assets
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
    FROM equity_assets ea
    CROSS JOIN parameters p
    WHERE ea.value > p.min_value_filter
    GROUP BY sector
),

-- ============================================================================
-- 4. SECTOR BREAKDOWN (level = 'sector')
-- ============================================================================
sector_totals AS (
    SELECT 
        ea.sector,
        'TOTAL' AS asset_name,
        STRING_AGG(DISTINCT ea.asset_class, ', ') AS asset_classes,
        'sector' AS level,
        SUM(ea.value) AS value,
        CASE 
            WHEN tp.total_value > 0 THEN
                ROUND((SUM(ea.value)::numeric / tp.total_value::numeric) * 100, p.decimal_places)
            ELSE 0
        END AS portfolio_percentage,
        sto.sector_total,
        tp.total_value
    FROM equity_assets ea
    CROSS JOIN total_portfolio tp
    CROSS JOIN parameters p
    JOIN sector_totals_for_order sto ON ea.sector = sto.sector
    WHERE ea.value > p.min_value_filter
    GROUP BY ea.sector, sto.sector_total, p.decimal_places, tp.total_value
),

-- ============================================================================
-- 5. ASSET BREAKDOWN (level = 'asset')
-- ============================================================================
asset_breakdown AS (
    SELECT 
        ea.sector,
        ea.asset_name,
        ea.asset_class,
        'asset' AS level,
        SUM(ea.value) AS value,
        CASE 
            WHEN tp.total_value > 0 THEN
                ROUND((SUM(ea.value)::numeric / tp.total_value::numeric) * 100, p.decimal_places)
            ELSE 0
        END AS portfolio_percentage,
        sto.sector_total,
        tp.total_value
    FROM equity_assets ea
    CROSS JOIN total_portfolio tp
    CROSS JOIN parameters p
    JOIN sector_totals_for_order sto ON ea.sector = sto.sector
    WHERE ea.value > p.min_value_filter
    GROUP BY ea.sector, ea.asset_name, ea.asset_class, sto.sector_total, p.decimal_places, tp.total_value
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
    portfolio_percentage desc
    limit 5;
