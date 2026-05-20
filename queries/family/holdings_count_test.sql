-- Holdings Count (Dashboard - Equity, MF, ETF) - automated only

SELECT
    (SELECT COUNT(*) FROM demat_holdings WHERE user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)) AS equity_count,
    (SELECT COUNT(*) FROM etf_holdings   WHERE user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)) AS etf_count,
    (SELECT COUNT(*) FROM mf             WHERE user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true) AND current_value != 0) AS mf_count;
