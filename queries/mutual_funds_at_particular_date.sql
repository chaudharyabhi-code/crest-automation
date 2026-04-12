-- Mutual Funds at Particular Date SQL
-- Returns total MF value for a specific date
-- Format: total_value

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id,
    '{DATE}'::date AS target_date
)

-- MF value calculation for specific date
SELECT 
    COALESCE(SUM(mf.current_value), 0) AS mf_value
FROM mf mf
WHERE mf.user_id = (SELECT user_id FROM parameters)
  AND mf.current_value IS NOT NULL
  AND mf.date <= (SELECT target_date FROM parameters)
  AND (
    -- Get the latest value on or before the target date
    mf.date = (
        SELECT MAX(mf_inner.date)
        FROM mf mf_inner
        WHERE mf_inner.user_id = (SELECT user_id FROM parameters)
          AND mf_inner.current_value IS NOT NULL
          AND mf_inner.date <= (SELECT target_date FROM parameters)
    )
  );
