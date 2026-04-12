-- Recurring Deposits at Particular Date SQL
-- Returns total Recurring Deposits value for a specific date
-- Format: total_value

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id,
    '{DATE}'::date AS target_date
)

-- Recurring Deposits value calculation for specific date
SELECT 
    COALESCE(SUM(rd.account_current_value), 0) AS recurring_deposits_value
FROM recurring_deposits rd
WHERE rd.user_id = (SELECT user_id FROM parameters);
