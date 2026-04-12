-- Fixed Deposits (Term Deposits) at Particular Date SQL
-- Returns total Fixed Deposits value for a specific date
-- Format: total_value

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id,
    '{DATE}'::date AS target_date
)

-- Fixed Deposits value calculation for specific date
SELECT 
    COALESCE(SUM(td.account_current_balance), 0) AS fixed_deposits_value
FROM term_deposits td
WHERE td.user_id = (SELECT user_id FROM parameters);
