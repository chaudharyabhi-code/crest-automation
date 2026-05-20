SELECT SUM(d.account_current_balance) AS idle_cash FROM deposits d WHERE d.user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)
