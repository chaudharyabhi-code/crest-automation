-- Cash Deposits Balance SQL
-- Returns the total cash deposits balance for a user

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id
)

-- Final Result: Total cash deposits balance
SELECT 
    SUM(d.account_current_balance) AS cash_balance
FROM deposits d
WHERE d.user_id = (SELECT user_id FROM parameters);
