-- NPS (National Pension System) Sector-wise Allocation SQL
-- Returns sector allocation for current NPS holdings
-- Format: sector | total_value | percentage

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id
)

-- Simple NPS total calculation
SELECT 
    'NPS' AS sector,
    COALESCE(SUM(n.current_value), 0) AS total_value,
    COUNT(*) AS number_of_holdings
FROM nps n
WHERE n.user_id = (SELECT user_id FROM parameters);
