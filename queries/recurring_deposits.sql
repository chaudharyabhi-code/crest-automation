-- Recurring deposits list
SELECT fip_name, account_current_value, account_maturity_date, account_maturity_amount 
FROM recurring_deposits 
WHERE user_id = {USER_ID} 
ORDER BY account_current_value DESC;
