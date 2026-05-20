WITH

-- ── AUTOMATED ASSETS ──────────────────────────────────────────────

deposits_latest AS (
    SELECT DISTINCT ON (d.user_id, d.account_ref_number)
        d.id, d.user_id,
        COALESCE(d.fip_name, d.account_type, 'Deposit Account') AS name,
        'Cash Balance' AS type,
        d.account_current_balance AS balance
    FROM deposits d
    WHERE d.user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)
      AND d.account_current_balance > 0
    ORDER BY d.user_id, d.account_ref_number, d.last_fetch_date_time DESC
),
term_deposits_latest AS (
    SELECT DISTINCT ON (td.user_id, td.account_ref_number)
        td.id, td.user_id,
        COALESCE(td.fip_name, td.account_type, 'Term Deposit') AS name,
        'Term Deposits' AS type,
        td.account_current_balance AS balance
    FROM term_deposits td
    WHERE td.user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)
      AND td.account_current_balance > 0
    ORDER BY td.user_id, td.account_ref_number, td.last_fetch_date_time DESC
),
recurring_deposits_latest AS (
    SELECT DISTINCT ON (rd.user_id, rd.account_ref_number)
        rd.id, rd.user_id,
        COALESCE(rd.fip_name, rd.account_type, 'Recurring Deposit') AS name,
        'Recurring Deposits' AS type,
        rd.account_current_value AS balance
    FROM recurring_deposits rd
    WHERE rd.user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)
      AND rd.account_current_value > 0
    ORDER BY rd.user_id, rd.account_ref_number, rd.last_fetch_date_time DESC
),
nps_latest AS (
    SELECT DISTINCT ON (n.user_id)
        n.id, n.user_id,
        'NPS Account' AS name,
        'NPS' AS type,
        n.current_value AS balance
    FROM nps n
    WHERE n.user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)
      AND n.current_value > 0
    ORDER BY n.user_id, n.updated_at DESC, n.id DESC
),
equity_latest AS (
    SELECT DISTINCT ON (dh.user_id, dh.demat_account_id, dh.isin)
        dh.id, dh.user_id,
        COALESCE(NULLIF(dh.issuer_name,''), NULLIF(dh.isin_description,''),
                 NULLIF(dh.bse_symbol,''), NULLIF(dh.nse_symbol,''), 'Equity Holding') AS name,
        'Equity' AS type,
        COALESCE(dh.units, 0) * COALESCE(dh.last_traded_price, 0) AS balance
    FROM demat_holdings dh
    WHERE dh.user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)
      AND dh.units * dh.last_traded_price > 0
    ORDER BY dh.user_id, dh.demat_account_id, dh.isin,
             dh.last_fetch_time DESC NULLS LAST, dh.id DESC
),
mf_latest AS (
    SELECT DISTINCT ON (mf.user_id, mf.isin)
        mf.id, mf.user_id,
        COALESCE(mf.fund_name, 'MF Holding') AS name,
        'MF' AS type,
        mf.current_value AS balance
    FROM mf mf
    WHERE mf.user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)
      AND mf.current_value > 0
    ORDER BY mf.user_id, mf.isin, mf.updated_at DESC
),
etf_latest AS (
    SELECT DISTINCT ON (eh.user_id, eh.etf_account_id, eh.isin)
        eh.id, eh.user_id,
        COALESCE(NULLIF(eh.scheme_name,''), 'ETF Holding') AS name,
        'ETF' AS type,
        COALESCE(eh.current_value, 0) AS balance
    FROM etf_holdings eh
    WHERE eh.user_id IN (SELECT user_id FROM family_members WHERE family_id = {FAMILY_ID} AND is_invitation_accepted = true)
      AND eh.current_value > 0
    ORDER BY eh.user_id, eh.etf_account_id, eh.isin,
             eh.current_nav_date DESC NULLS LAST, eh.id DESC
),


-- ── COMBINE + RANK ────────────────────────────────────────────────

all_holdings AS (
    SELECT id, name, type, balance FROM deposits_latest
    UNION ALL
    SELECT id, name, type, balance FROM term_deposits_latest
    UNION ALL
    SELECT id, name, type, balance FROM recurring_deposits_latest
    UNION ALL
    SELECT id, name, type, balance FROM nps_latest
    UNION ALL
    SELECT id, name, type, balance FROM equity_latest
    UNION ALL
    SELECT id, name, type, balance FROM mf_latest
    UNION ALL
    SELECT id, name, type, balance FROM etf_latest
),
grand_total AS (
    SELECT SUM(balance) AS total FROM all_holdings
)

-- ── FINAL TOP 5 ───────────────────────────────────────────────────

SELECT
    ah.id,
    ah.name                                         AS holding_name,
    ah.type                                         AS holding_type,
    ROUND(ah.balance::numeric, 2)                   AS current_balance,
    ROUND((ah.balance / gt.total * 100)::numeric, 1) AS portfolio_percentage
FROM all_holdings ah
CROSS JOIN grand_total gt
ORDER BY ah.balance DESC
LIMIT 5;
