SELECT SUM(d.account_current_balance) AS idle_cash FROM deposits d WHERE d.user_id = {USER_ID}
