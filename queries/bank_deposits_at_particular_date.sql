-- Bank Deposits at Particular Date SQL
-- Returns total Bank Deposits value for a specific date
-- Format: total_value

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id,
    '{DATE}'::date AS target_date
)

-- Bank Deposits value calculation for specific date
SELECT 
    COALESCE(SUM(d.account_current_balance), 0) AS bank_value
FROM deposits d
WHERE d.user_id = (SELECT user_id FROM parameters)
  AND d.account_current_balance IS NOT NULL
  AND d.date <= (SELECT target_date FROM parameters)
  AND (
    -- Get the latest value on or before the target date
    d.date = (
        SELECT MAX(d_inner.date)
        FROM deposits d_inner
        WHERE d_inner.user_id = (SELECT user_id FROM parameters)
          AND d_inner.account_current_balance IS NOT NULL
          AND d_inner.date <= (SELECT target_date FROM parameters)
    )
  );
