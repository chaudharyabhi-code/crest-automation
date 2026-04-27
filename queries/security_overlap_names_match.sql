-- Security Overlap Analysis
-- Identifies common securities held across Equity, Mutual Funds, and ETFs
-- Shows total exposure and overlap percentage

WITH parameters AS (
    SELECT 
        {USER_ID}::integer AS user_id,
        2::integer AS decimal_places
),

equity_securities AS (
    SELECT 
        COALESCE(sm.company_name, dh.issuer_name, dh.isin_description, dh.isin) AS security_name,
        dh.isin AS isin_code,
        COALESCE(sm.sector, 'Others') AS sector,
        (dh.units * COALESCE(dh.last_traded_price, 0)) AS equity_value,
        0::numeric AS mf_value,
        0::numeric AS etf_value
    FROM demat_holdings dh
    LEFT JOIN securities_master sm ON dh.security_id = sm.id
    CROSS JOIN parameters p
    WHERE dh.user_id = p.user_id
      AND dh.units > 0
      AND dh.deleted_at IS NULL
      AND dh.last_traded_price > 0
),

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

mf_securities AS (
    SELECT 
        COALESCE(h.holding_name, h.holding_isin) AS security_name,
        COALESCE(h.holding_isin, 'Unknown') AS isin_code,
        COALESCE(h.sector, 'Others') AS sector,
        0::numeric AS equity_value,
        SUM(um.current_value * COALESCE(h.weighting, 0) / 100) AS mf_value,
        0::numeric AS etf_value
    FROM user_mf um
    JOIN mf_fund_holdings h ON um.fund_isin = h.fund_isin
    WHERE h.holding_isin IS NOT NULL OR h.holding_name IS NOT NULL
      AND COALESCE(h.weighting, 0) > 0
    GROUP BY COALESCE(h.holding_name, h.holding_isin), COALESCE(h.holding_isin, 'Unknown'), h.sector
),

user_etf AS (
    SELECT DISTINCT ON (eh.user_id, eh.etf_account_id, eh.isin)
        eh.isin AS etf_isin,
        eh.current_value
    FROM etf_holdings eh
    CROSS JOIN parameters p
    WHERE eh.user_id = p.user_id
      AND eh.deleted_at IS NULL
      AND eh.current_value > 0
    ORDER BY eh.user_id, eh.etf_account_id, eh.isin, eh.current_nav_date DESC NULLS LAST
),

etf_securities AS (
    SELECT 
        COALESCE(h.holding_name, h.holding_isin) AS security_name,
        COALESCE(h.holding_isin, 'Unknown') AS isin_code,
        COALESCE(h.sector, 'Others') AS sector,
        0::numeric AS equity_value,
        0::numeric AS mf_value,
        SUM(ue.current_value * COALESCE(h.weighting, 0) / 100) AS etf_value
    FROM user_etf ue
    JOIN etf_holdings_fund h ON ue.etf_isin = h.etf_isin
    WHERE h.holding_isin IS NOT NULL OR h.holding_name IS NOT NULL
      AND COALESCE(h.weighting, 0) > 0
    GROUP BY COALESCE(h.holding_name, h.holding_isin), COALESCE(h.holding_isin, 'Unknown'), h.sector
),

all_securities AS (
    SELECT security_name, isin_code, sector, equity_value, mf_value, etf_value FROM equity_securities
    UNION ALL
    SELECT security_name, isin_code, sector, equity_value, mf_value, etf_value FROM mf_securities
    UNION ALL
    SELECT security_name, isin_code, sector, equity_value, mf_value, etf_value FROM etf_securities
),

security_totals AS (
    SELECT 
        security_name,
        isin_code,
        sector,
        SUM(equity_value) AS equity_value,
        SUM(mf_value) AS mf_value,
        SUM(etf_value) AS etf_value,
        SUM(equity_value + mf_value + etf_value) AS total_security_value,
        CASE 
            WHEN SUM(equity_value) > 0 AND SUM(mf_value) > 0 AND SUM(etf_value) > 0 THEN 'Equity + MF + ETF'
            WHEN SUM(equity_value) > 0 AND SUM(mf_value) > 0 THEN 'Equity + MF'
            WHEN SUM(equity_value) > 0 AND SUM(etf_value) > 0 THEN 'Equity + ETF'
            WHEN SUM(mf_value) > 0 AND SUM(etf_value) > 0 THEN 'MF + ETF'
            WHEN SUM(equity_value) > 0 THEN 'Equity Only'
            WHEN SUM(mf_value) > 0 THEN 'MF Only'
            WHEN SUM(etf_value) > 0 THEN 'ETF Only'
        END AS overlap_type,
        (CASE WHEN SUM(equity_value) > 0 THEN 1 ELSE 0 END +
         CASE WHEN SUM(mf_value) > 0 THEN 1 ELSE 0 END +
         CASE WHEN SUM(etf_value) > 0 THEN 1 ELSE 0 END) AS overlap_count
    FROM all_securities
    GROUP BY security_name, isin_code, sector
),

total_portfolio AS (
    SELECT COALESCE(SUM(total_security_value), 0) AS total_value
    FROM security_totals
),

final_results AS (
    SELECT 
        st.security_name,
        st.isin_code,
        st.sector,
        ROUND(st.equity_value::numeric, p.decimal_places) AS equity_value,
        ROUND(st.mf_value::numeric, p.decimal_places) AS mf_value,
        ROUND(st.etf_value::numeric, p.decimal_places) AS etf_value,
        ROUND(st.total_security_value::numeric, p.decimal_places) AS total_value,
        st.overlap_type,
        st.overlap_count,
        CASE 
            WHEN tp.total_value > 0 THEN
                ROUND((st.total_security_value::numeric / tp.total_value::numeric) * 100, p.decimal_places)
            ELSE 0
        END AS portfolio_percentage,
        ROUND(tp.total_value::numeric, p.decimal_places) AS total_portfolio_value
    FROM security_totals st
    CROSS JOIN total_portfolio tp
    CROSS JOIN parameters p
    WHERE st.total_security_value > 0
    ORDER BY st.overlap_count DESC, st.total_security_value DESC
    LIMIT 50
)

select * from final_results;
