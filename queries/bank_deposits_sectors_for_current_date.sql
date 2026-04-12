-- Bank Deposits Sector-wise Allocation SQL
-- Returns sector allocation for current bank deposit holdings
-- Format: sector | total_value | percentage

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id  -- Change this to your user ID
)

-- Simple Bank Deposits total calculation
SELECT 
    'Bank Deposits' AS sector,
    COALESCE(SUM(d.account_current_balance), 0) AS total_value,
    COUNT(*) AS number_of_holdings
FROM deposits d
WHERE d.user_id = (SELECT user_id FROM parameters);
