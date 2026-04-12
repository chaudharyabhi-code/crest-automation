-- Fixed Deposits (Term Deposits) Sector-wise Allocation SQL
-- Returns sector allocation for current fixed deposits holdings
-- Format: sector | total_value | percentage

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id
)

-- Simple Fixed Deposits total calculation
SELECT 
    'Fixed Deposits' AS sector,
    COALESCE(SUM(td.account_current_balance), 0) AS total_value,
    COUNT(*) AS number_of_holdings
FROM term_deposits td
WHERE td.user_id = (SELECT user_id FROM parameters);
