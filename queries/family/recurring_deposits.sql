-- Recurring deposits list
SELECT fip_name, account_current_value, account_maturity_date, account_maturity_amount 
FROM recurring_deposits 
WHERE user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true) 
ORDER BY account_current_value DESC;
