 
    
 WITH parameters AS (
    SELECT 
        {USER_ID}::integer AS user_id,
        2::integer AS decimal_places,
        -- ================================================================
        -- ASSET CLASS FILTER - Set to NULL to include all, or specify one
        -- Options: 'equity', 'mf', 'etf', 'deposits', 'term', 'recurring', 'nps', 'gold', 'real_estate', 'crypto'
        -- ================================================================
        NULL::text AS asset_class_filter,
        
        -- ================================================================
        -- MINIMUM VALUE FILTER - Set to 0 to include all
        -- ================================================================
        0::numeric AS min_value_filter
),

-- ============================================================================
-- 1. EQUITY ASSETS
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
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'equity')
),

-- ============================================================================
-- 2. MUTUAL FUND ASSETS (underlying holdings)
-- ============================================================================
mf_assets AS (
    WITH user_mf AS (
        SELECT DISTINCT ON (mf.user_id, mf.isin)
            mf.isin AS fund_isin,
            mf.current_value
        FROM mf mf
        CROSS JOIN parameters p
        WHERE mf.user_id = p.user_id
          AND mf.deleted_at IS NULL
          AND mf.current_value > 0
          AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'mf')
        ORDER BY mf.user_id, mf.isin, mf.updated_at DESC
    )
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
-- 3. ETF ASSETS (underlying holdings)
-- ============================================================================
etf_assets AS (
    WITH user_etf AS (
        SELECT DISTINCT ON (eh.user_id, eh.etf_account_id, eh.isin)
            eh.isin AS etf_isin,
            eh.current_value
        FROM etf_holdings eh
        CROSS JOIN parameters p
        WHERE eh.user_id = p.user_id
          AND eh.deleted_at IS NULL
          AND eh.current_value > 0
          AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'etf')
        ORDER BY eh.user_id, eh.etf_account_id, eh.isin, eh.current_nav_date DESC NULLS LAST
    )
    SELECT 
        CASE 
            WHEN COALESCE(h.holding_name, h.holding_isin) = 'Unknown' 
            THEN 'Others'
            ELSE COALESCE(h.holding_name, h.holding_isin)
        END AS asset_name,
        SUM(ue.current_value * COALESCE(h.weighting, 0) / 100) AS value,
        'etf' AS asset_class,
        COALESCE(h.sector, 'Others') AS sector,
        'system' AS source
    FROM user_etf ue
    JOIN etf_holdings_fund h ON ue.etf_isin = h.etf_isin
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
-- 4. CASH/DEPOSITS (System + Manual)
-- ============================================================================
cash_assets AS (
    -- System deposits
    SELECT 
        COALESCE(d.fip_name, d.masked_acc_number, 'Deposit Account') AS asset_name,
        d.account_current_balance AS value,
        'deposits' AS asset_class,
        'Cash/Bank' AS sector,
        'system' AS source
    FROM deposits d
    CROSS JOIN parameters p
    WHERE d.user_id = p.user_id
      AND d.account_current_balance > 0
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'deposits')
    
    UNION ALL
    
    -- Manual deposits
    SELECT 
        COALESCE(ua.data_json->>'name', 'Manual Cash') AS asset_name,
        COALESCE((ua.data_json->>'current_value')::numeric, (ua.data_json->>'value')::numeric, 0) AS value,
        'deposits' AS asset_class,
        'Cash/Bank' AS sector,
        'manual' AS source
    FROM user_assets ua
    JOIN asset_classes ac ON ua.asset_class_id = ac.id
    CROSS JOIN parameters p
    WHERE ua.user_id = p.user_id
      AND ua.is_manual_entry = true
      AND ua.deleted_at IS NULL
      AND ac.type = 'deposits'
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'deposits')
),

-- ============================================================================
-- 5. TERM DEPOSITS (System + Manual)
-- ============================================================================
term_assets AS (
    -- System term deposits
    SELECT 
        COALESCE(td.fip_name, td.masked_acc_number, 'Term Deposit') AS asset_name,
        td.account_current_balance AS value,
        'term' AS asset_class,
        'Term Deposits' AS sector,
        'system' AS source
    FROM term_deposits td
    CROSS JOIN parameters p
    WHERE td.user_id = p.user_id
      AND td.account_current_balance > 0
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'term')
    
    UNION ALL
    
    -- Manual term deposits
    SELECT 
        COALESCE(ua.data_json->>'name', 'Manual Term Deposit') AS asset_name,
        COALESCE((ua.data_json->>'current_value')::numeric, (ua.data_json->>'value')::numeric, 0) AS value,
        'term' AS asset_class,
        'Term Deposits' AS sector,
        'manual' AS source
    FROM user_assets ua
    JOIN asset_classes ac ON ua.asset_class_id = ac.id
    CROSS JOIN parameters p
    WHERE ua.user_id = p.user_id
      AND ua.is_manual_entry = true
      AND ua.deleted_at IS NULL
      AND ac.type = 'term'
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'term')
),

-- ============================================================================
-- 6. RECURRING DEPOSITS (System + Manual)
-- ============================================================================
recurring_assets AS (
    -- System recurring deposits
    SELECT 
        COALESCE(rd.fip_name, rd.masked_acc_number, 'Recurring Deposit') AS asset_name,
        rd.account_current_value AS value,
        'recurring' AS asset_class,
        'Recurring Deposits' AS sector,
        'system' AS source
    FROM recurring_deposits rd
    CROSS JOIN parameters p
    WHERE rd.user_id = p.user_id
      AND rd.account_current_value > 0
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'recurring')
    
    UNION ALL
    
    -- Manual recurring deposits
    SELECT 
        COALESCE(ua.data_json->>'name', 'Manual Recurring Deposit') AS asset_name,
        COALESCE((ua.data_json->>'current_value')::numeric, (ua.data_json->>'value')::numeric, 0) AS value,
        'recurring' AS asset_class,
        'Recurring Deposits' AS sector,
        'manual' AS source
    FROM user_assets ua
    JOIN asset_classes ac ON ua.asset_class_id = ac.id
    CROSS JOIN parameters p
    WHERE ua.user_id = p.user_id
      AND ua.is_manual_entry = true
      AND ua.deleted_at IS NULL
      AND ac.type = 'recurring'
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'recurring')
),

-- ============================================================================
-- 7. NPS (System + Manual)
-- ============================================================================
nps_assets AS (
    -- System NPS
    SELECT 
        'NPS Account' AS asset_name,
        COALESCE(n.current_value, 0) AS value,
        'nps' AS asset_class,
        'NPS' AS sector,
        'system' AS source
    FROM nps n
    CROSS JOIN parameters p
    WHERE n.user_id = p.user_id
      AND n.deleted_at IS NULL
      AND n.current_value > 0
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'nps')
    
    UNION ALL
    
    -- Manual NPS
    SELECT 
        COALESCE(ua.data_json->>'name', 'Manual NPS') AS asset_name,
        COALESCE((ua.data_json->>'current_value')::numeric, (ua.data_json->>'value')::numeric, 0) AS value,
        'nps' AS asset_class,
        'NPS' AS sector,
        'manual' AS source
    FROM user_assets ua
    JOIN asset_classes ac ON ua.asset_class_id = ac.id
    CROSS JOIN parameters p
    WHERE ua.user_id = p.user_id
      AND ua.is_manual_entry = true
      AND ua.deleted_at IS NULL
      AND ac.type = 'nps'
      AND (p.asset_class_filter IS NULL OR p.asset_class_filter = 'nps')
),

-- ============================================================================
-- 8. MANUAL ASSETS (Gold, Real Estate, Crypto)
-- ============================================================================
manual_assets AS (
    SELECT 
        COALESCE(ua.data_json->>'name', ac.name, 'Manual Asset') AS asset_name,
        COALESCE((ua.data_json->>'current_value')::numeric, (ua.data_json->>'value')::numeric, 0) AS value,
        ac.type AS asset_class,
        CASE 
            WHEN ac.type = 'gold' THEN 'Gold'
            WHEN ac.type = 'real_estate' THEN 'Real Estate'
            WHEN ac.type = 'crypto' THEN 'Crypto'
            ELSE 'Other'
        END AS sector,
        'manual' AS source
    FROM user_assets ua
    JOIN asset_classes ac ON ua.asset_class_id = ac.id
    CROSS JOIN parameters p
    WHERE ua.user_id = p.user_id
      AND ua.is_manual_entry = true
      AND ua.deleted_at IS NULL
      AND ac.type IN ('gold', 'real_estate', 'crypto')
      AND (p.asset_class_filter IS NULL OR ac.type = p.asset_class_filter)
),

-- ============================================================================
-- 9. COMBINE ALL ASSETS
-- ============================================================================
all_assets AS (
    SELECT asset_name, value, asset_class, sector, source FROM equity_assets
    UNION ALL
    SELECT asset_name, value, asset_class, sector, source FROM mf_assets
    UNION ALL
    SELECT asset_name, value, asset_class, sector, source FROM etf_assets
    UNION ALL
    SELECT asset_name, value, asset_class, sector, source FROM cash_assets
    UNION ALL
    SELECT asset_name, value, asset_class, sector, source FROM term_assets
    UNION ALL
    SELECT asset_name, value, asset_class, sector, source FROM recurring_assets
    UNION ALL
    SELECT asset_name, value, asset_class, sector, source FROM nps_assets
    UNION ALL
    SELECT asset_name, value, asset_class, sector, source FROM manual_assets
),

-- ============================================================================
-- 10. CALCULATE TOTAL PORTFOLIO VALUE
-- ============================================================================
total_portfolio AS (
    SELECT COALESCE(SUM(value), 0) AS total_value
    FROM all_assets
    CROSS JOIN parameters p
    WHERE value > p.min_value_filter
),

-- ============================================================================
-- 11. SECTOR TOTALS FOR ORDERING
-- ============================================================================
sector_totals_for_order AS (
    SELECT 
        sector,
        SUM(value) AS sector_total
    FROM all_assets
    CROSS JOIN parameters p
    WHERE value > p.min_value_filter
    GROUP BY sector
),

-- ============================================================================
-- FINAL RESULT: RISK CONCENTRATION BY SECTOR + ASSET (MIXED VIEW)
-- ============================================================================
sector_totals AS (
    SELECT 
        aa.sector,
        'TOTAL' AS asset_name,
        STRING_AGG(DISTINCT aa.asset_class, ', ') AS asset_classes,
        'sector' AS level,
        SUM(aa.value) AS value,
        CASE 
            WHEN tp.total_value > 0 THEN
                ROUND((SUM(aa.value)::numeric / tp.total_value::numeric) * 100, p.decimal_places)
            ELSE 0
        END AS portfolio_percentage,
        sto.sector_total,
        tp.total_value
    FROM all_assets aa
    CROSS JOIN total_portfolio tp
    CROSS JOIN parameters p
    JOIN sector_totals_for_order sto ON aa.sector = sto.sector
    WHERE aa.value > p.min_value_filter
    GROUP BY aa.sector, sto.sector_total, p.decimal_places, tp.total_value
),
asset_breakdown AS (
    SELECT 
        aa.sector,
        aa.asset_name,
        aa.asset_class,
        'asset' AS level,
        SUM(aa.value) AS value,
        CASE 
            WHEN tp.total_value > 0 THEN
                ROUND((SUM(aa.value)::numeric / tp.total_value::numeric) * 100, p.decimal_places)
            ELSE 0
        END AS portfolio_percentage,
        sto.sector_total,
        tp.total_value
    FROM all_assets aa
    CROSS JOIN total_portfolio tp
    CROSS JOIN parameters p
    JOIN sector_totals_for_order sto ON aa.sector = sto.sector
    WHERE aa.value > p.min_value_filter
    GROUP BY aa.sector, aa.asset_name, aa.asset_class, sto.sector_total, p.decimal_places, tp.total_value
),
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
    -- Priority 1: Sectors with > 20% concentration
    CASE WHEN level = 'sector' THEN 0 ELSE 1 END,
    -- Within priorities, sort by sector total, then level, then value
    portfolio_percentage desc
