-- ETF allocation by scheme
SELECT scheme_name, isin, SUM(current_value) val 
FROM etf_holdings 
WHERE user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true) 
GROUP BY scheme_name, isin 
ORDER BY val DESC;
