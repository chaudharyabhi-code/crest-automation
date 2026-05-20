-- Bank deposits for specific date
WITH lbs AS (
    SELECT DISTINCT ON(account_id) * 
    FROM bank_statements 
    WHERE user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true) 
      AND transaction_timestamp <= '{DATE}'::timestamp 
    ORDER BY account_id, transaction_timestamp DESC
),
bb AS (
    SELECT lbs.account_id, lbs.current_balance bal, d.fip_name 
    FROM lbs 
    LEFT JOIN deposits d ON lbs.account_id = d.account_ref_number 
    WHERE lbs.user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)
)
SELECT fip_name, ROUND(SUM(bal)::numeric, 2) total 
FROM bb 
GROUP BY fip_name 
ORDER BY total DESC;
