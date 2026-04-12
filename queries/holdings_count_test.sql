-- Holdings Count Test Case
-- Counts the number of holdings across different asset types for specified user

SELECT 
    (SELECT COUNT(*) FROM demat_holdings dh WHERE dh.user_id = {USER_ID}) as equity_count,
    (SELECT COUNT(*) FROM etf_holdings eh WHERE eh.user_id = {USER_ID}) as etf_count,
    (SELECT COUNT(*) FROM mf mh WHERE mh.user_id = {USER_ID}) as mf_count;
