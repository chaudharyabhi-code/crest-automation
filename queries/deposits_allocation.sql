-- Deposits allocation by FIP name
SELECT fip_name, SUM(account_current_balance) val 
FROM deposits 
WHERE user_id={USER_ID} 
GROUP BY fip_name 
ORDER BY val DESC;
