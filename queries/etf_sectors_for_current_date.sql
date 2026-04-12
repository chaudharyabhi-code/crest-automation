-- ETF Sector-wise Allocation SQL
-- Returns sector allocation for current ETF holdings
-- Format: sector | total_value | percentage

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id  -- Change this to your user ID
)

-- Simple ETF total calculation
SELECT 
    'ETF' AS sector,
    COALESCE(SUM(ea.current_value), 0) AS total_value,
    COUNT(*) AS number_of_holdings
FROM etf_accounts ea
WHERE ea.user_id = (SELECT user_id FROM parameters);
