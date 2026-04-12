-- NPS (National Pension System) at Particular Date SQL
-- Returns total NPS value for a specific date
-- Format: total_value

-- Parameters
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id,
    '{DATE}'::date AS target_date
)

-- NPS value calculation for specific date
SELECT 
    COALESCE(SUM(n.current_value), 0) AS nps_value
FROM nps n
WHERE n.user_id = (SELECT user_id FROM parameters);
