-- ETF at Particular Date SQL
-- Returns total ETF value for a specific date
-- Format: total_value

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id,
    '{DATE}'::date AS target_date
)

-- ETF value calculation for specific date
SELECT 
    COALESCE(SUM(ea.current_value), 0) AS etf_value
FROM etf_accounts ea
WHERE ea.user_id = (SELECT user_id FROM parameters)
  AND ea.current_value IS NOT NULL
  AND ea.date <= (SELECT target_date FROM parameters)
  AND (
    -- Get the latest value on or before the target date
    ea.date = (
        SELECT MAX(ea_inner.date)
        FROM etf_accounts ea_inner
        WHERE ea_inner.user_id = (SELECT user_id FROM parameters)
          AND ea_inner.current_value IS NOT NULL
          AND ea_inner.date <= (SELECT target_date FROM parameters)
    )
  );
