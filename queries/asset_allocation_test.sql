-- Asset Allocation Breakdown Test Case
-- Shows current asset allocation as percentages of total portfolio value

WITH user_ids AS (
    SELECT unnest(ARRAY[{USER_ID}]) AS user_id
),

-- Calculate individual asset totals
asset_values AS (
    SELECT 
        'Deposits' as asset_type,
        COALESCE((
            SELECT SUM(d.account_current_balance)
            FROM deposits d
            JOIN user_ids u ON u.user_id = d.user_id
        ), 0) as total_value
    UNION ALL
    SELECT 
        'Equity' as asset_type,
        COALESCE((
            SELECT SUM(da.current_value)
            FROM demat_accounts da
            JOIN user_ids u ON u.user_id = da.user_id
        ), 0) as total_value
    UNION ALL
    SELECT 
        'ETF' as asset_type,
        COALESCE((
            SELECT SUM(ea.current_value)
            FROM etf_accounts ea
            JOIN user_ids u ON u.user_id = ea.user_id
        ), 0) as total_value
    UNION ALL
    SELECT 
        'Mutual Funds' as asset_type,
        COALESCE((
            SELECT SUM(m.current_value)
            FROM mf m
            JOIN user_ids u ON u.user_id = m.user_id
        ), 0) as total_value
    UNION ALL
    SELECT 
        'NPS' as asset_type,
        COALESCE((
            SELECT SUM(n.current_value)
            FROM nps n
            JOIN user_ids u ON u.user_id = n.user_id
        ), 0) as total_value
    UNION ALL
    SELECT 
        'Recurring Deposits' as asset_type,
        COALESCE((
            SELECT SUM(rd.account_current_value)
            FROM recurring_deposits rd
            JOIN user_ids u ON u.user_id = rd.user_id
        ), 0) as total_value
    UNION ALL
    SELECT 
        'Term Deposits' as asset_type,
        COALESCE((
            SELECT SUM(td.account_current_balance)
            FROM term_deposits td
            JOIN user_ids u ON u.user_id = td.user_id
        ), 0) as total_value
),

-- Calculate grand total and percentages
allocation_breakdown AS (
    SELECT 
        av.asset_type,
        av.total_value,
        SUM(av.total_value) OVER () as grand_total,
        CASE 
            WHEN SUM(av.total_value) OVER () > 0 
            THEN ROUND((av.total_value::numeric / SUM(av.total_value) OVER ()) * 100)
            ELSE 0 
        END as allocation_percentage,
        CASE 
            WHEN av.total_value > 0 THEN 'Active'
            ELSE 'Inactive'
        END as status
    FROM asset_values av
    WHERE av.total_value > 0 OR (SELECT COUNT(*) FROM asset_values WHERE total_value > 0) = 0
)

-- Final Results with Allocation Categories
SELECT 
    asset_type,
    total_value as current_value,
    allocation_percentage,
    status,
    CASE 
        WHEN allocation_percentage >= 40 THEN 'Major Holding'
        WHEN allocation_percentage >= 20 THEN 'Significant'
        WHEN allocation_percentage >= 10 THEN 'Moderate'
        WHEN allocation_percentage > 0 THEN 'Minor'
        ELSE 'None'
    END as allocation_category,
    CASE 
        WHEN asset_type IN ('Equity', 'ETF', 'Mutual Funds') THEN 'Growth Assets'
        WHEN asset_type IN ('Deposits', 'Recurring Deposits', 'Term Deposits') THEN 'Debt Assets'
        WHEN asset_type = 'NPS' THEN 'Retirement Assets'
        ELSE 'Other'
    END as asset_class,
    (SELECT user_id FROM user_ids) as user_id,
    CURRENT_DATE as analysis_date

FROM allocation_breakdown ab
ORDER BY 
    CASE WHEN ab.total_value > 0 THEN 0 ELSE 1 END,
    ab.total_value DESC;
