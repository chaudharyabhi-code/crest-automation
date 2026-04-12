-- Equities at Particular Date SQL
-- Returns total equity value for a specific date
-- Format: total_value

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id,
    '{DATE}'::date AS target_date
)

-- Equity value calculation for specific date
SELECT 
    COALESCE(SUM(dh.current_value), 0) AS equity_value
FROM demat_holdings dh
WHERE dh.user_id = (SELECT user_id FROM parameters)
  AND dh.current_value IS NOT NULL
  AND dh.date <= (SELECT target_date FROM parameters)
  AND (
    -- Get the latest value on or before the target date
    dh.date = (
        SELECT MAX(dh_inner.date)
        FROM demat_holdings dh_inner
        WHERE dh_inner.user_id = (SELECT user_id FROM parameters)
          AND dh_inner.current_value IS NOT NULL
          AND dh_inner.date <= (SELECT target_date FROM parameters)
    )
  );
