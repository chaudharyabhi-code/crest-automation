-- MF Sector-wise Allocation SQL
-- Returns sector allocation for current mutual fund holdings
-- Format: sector | total_value | percentage

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id  -- Change this to your user ID
)

-- Simple MF total calculation
SELECT 
    'Mutual Funds' AS sector,
    COALESCE(SUM(mf.current_value), 0) AS total_value,
    COUNT(*) AS number_of_holdings
FROM mf mf
WHERE mf.user_id = (SELECT user_id FROM parameters);
