
WITH parameters AS (
    SELECT {USER_ID}::integer AS user_id
),
temp as (
SELECT
    ud.company_name AS name,
    ROUND(ud.dividend_rate::numeric, 2) AS rate,
    ROUND(SUM(ud.units_held)::numeric, 2) AS units,
    ROUND(SUM(ud.total_amount)::numeric, 2) AS amount,
    ud.payment_date AS "paymentDate",
    ud.currency
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
  )
GROUP BY ud.security_id, ud.record_date, ud.payment_date,
         ud.company_name, ud.dividend_rate, ud.currency
)
select count(*) as total_count from temp ;