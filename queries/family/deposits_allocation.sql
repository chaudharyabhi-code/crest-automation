-- Deposits allocation by FIP name
SELECT fip_name, SUM(account_current_balance) val 
FROM deposits 
WHERE user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true) 
GROUP BY fip_name 
ORDER BY val DESC;
