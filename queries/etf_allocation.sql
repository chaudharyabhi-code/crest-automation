-- ETF allocation by scheme
SELECT scheme_name, isin, SUM(current_value) val 
FROM etf_holdings 
WHERE user_id={USER_ID} 
GROUP BY scheme_name, isin 
ORDER BY val DESC;
