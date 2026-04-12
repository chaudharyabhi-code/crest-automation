-- Recurring Deposits Sector-wise Allocation SQL
-- Returns sector allocation for current recurring deposits holdings
-- Format: sector | total_value | percentage

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id
)

-- Simple Recurring Deposits total calculation
SELECT 
    'Recurring Deposits' AS sector,
    COALESCE(SUM(rd.account_current_value), 0) AS total_value,
    COUNT(*) AS number_of_holdings
FROM recurring_deposits rd
WHERE rd.user_id = (SELECT user_id FROM parameters);
