WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id
)
SELECT COUNT(*) as total_count
FROM user_dividends ud
CROSS JOIN parameters p
WHERE ud.user_id = p.user_id
  AND (
    (ud.payment_date IS NOT NULL
     AND ud.payment_date <= CURRENT_DATE
     AND ud.payment_date >= CURRENT_DATE - INTERVAL '1 year')
    OR
    (ud.payment_date IS NULL
     AND ud.record_date <= CURRENT_DATE - INTERVAL '15 days'
     AND ud.record_date >= CURRENT_DATE - INTERVAL '1 year' - INTERVAL '15 days')
  );