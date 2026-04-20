-- ============================================================================
-- GEOGRAPHY-WISE ALLOCATION (as used for the Geography graph)
-- ============================================================================
-- Mirrors backend logic in `AnalysisAllocationService.get_geography_allocation()`:
-- 1) Build MF+ETF holdings by ISIN (current_value)
-- 2) Classify each ISIN using `mf_etf_master`:
--    - If asset_category contains 'Global' AND asset_sub_category like 'Country Specific - X' => geography = X
--    - Else if asset_category contains 'Global' => geography = 'Global'
--    - Else (or missing master) => geography = 'India'
-- 3) Compute total portfolio wealth (all assets)
-- 4) Add (total_wealth - mf_etf_total) to India (assumption used in backend)
-- 5) Output value + percentage
--
-- NOTE:
-- - This is written for PostgreSQL.
-- - If your schema differs (e.g. table names), adjust the CTEs accordingly.
-- ============================================================================
-- PARAMETERS (edit here)
-- ============================================================================
WITH params AS (
  SELECT
    ARRAY[{USER_ID}]::int[]      AS user_ids,        -- <-- replace with real user ids
    2::int                    AS decimal_places,  -- rounding
    0::numeric                AS min_value         -- filter tiny buckets (0 = include all)
),

-- ============================================================================
-- 1) MF + ETF holdings by ISIN
-- ============================================================================
mf_holdings AS (
  SELECT
    ma.isin,
    SUM(ma.current_value)::numeric AS value
  FROM mf ma
  CROSS JOIN params p
  WHERE ma.user_id = ANY(p.user_ids)
    AND ma.current_value > 0
    AND ma.deleted_at IS NULL
    AND ma.isin IS NOT NULL
  GROUP BY ma.isin
),
etf_holdings AS (
  SELECT
    eh.isin,
    SUM(eh.current_value)::numeric AS value
  FROM etf_holdings eh
  CROSS JOIN params p
  WHERE eh.user_id = ANY(p.user_ids)
    AND eh.current_value > 0
    AND eh.deleted_at IS NULL
    AND eh.isin IS NOT NULL
  GROUP BY eh.isin
),
isin_values AS (
  SELECT isin, value FROM mf_holdings
  UNION ALL
  SELECT isin, value FROM etf_holdings
),
isin_agg AS (
  SELECT isin, SUM(value)::numeric AS value
  FROM isin_values
  GROUP BY isin
),

-- ============================================================================
-- 2) Classify each ISIN into a geography bucket (India / Global / Country)
-- ============================================================================
classified_isins AS (
  SELECT
    ia.isin,
    ia.value,
    CASE
      WHEN mm.asset_category ILIKE '%Global%'
       AND mm.asset_sub_category ILIKE '%Country Specific%'
       AND split_part(mm.asset_sub_category, '-', 2) IS NOT NULL
       AND btrim(split_part(mm.asset_sub_category, '-', 2)) <> ''
        THEN btrim(split_part(mm.asset_sub_category, '-', 2)) -- e.g. "USA"
      WHEN mm.asset_category ILIKE '%Global%' THEN 'Global'
      ELSE 'India'
    END AS geography
  FROM isin_agg ia
  LEFT JOIN mf_etf_master mm
    ON mm.isin = ia.isin
),
geo_mf_etf_totals AS (
  SELECT
    geography,
    SUM(value)::numeric AS mf_etf_value
  FROM classified_isins
  GROUP BY geography
),
mf_etf_total AS (
  SELECT COALESCE(SUM(mf_etf_value), 0)::numeric AS total
  FROM geo_mf_etf_totals
),

-- ============================================================================
-- 3) Total portfolio wealth (all assets) – used to compute “remaining -> India”
--    This is a SQL equivalent of the dashboard current balances aggregation.
-- ============================================================================
deposits_latest AS (
  SELECT DISTINCT ON (d.user_id, d.account_ref_number)
    d.user_id,
    d.account_current_balance::numeric AS balance
  FROM deposits d
  CROSS JOIN params p
  WHERE d.user_id = ANY(p.user_ids)
    AND d.account_current_balance IS NOT NULL
  ORDER BY d.user_id, d.account_ref_number, d.last_fetch_date_time DESC
),
recurring_latest AS (
  SELECT DISTINCT ON (rd.user_id, rd.account_ref_number)
    rd.user_id,
    rd.account_current_value::numeric AS balance
  FROM recurring_deposits rd
  CROSS JOIN params p
  WHERE rd.user_id = ANY(p.user_ids)
    AND rd.account_current_value IS NOT NULL
  ORDER BY rd.user_id, rd.account_ref_number, rd.last_fetch_date_time DESC
),
term_latest AS (
  SELECT DISTINCT ON (td.user_id, td.account_ref_number)
    td.user_id,
    td.account_current_balance::numeric AS balance
  FROM term_deposits td
  CROSS JOIN params p
  WHERE td.user_id = ANY(p.user_ids)
    AND td.account_current_balance IS NOT NULL
  ORDER BY td.user_id, td.account_ref_number, td.last_fetch_date_time DESC
),
nps_latest AS (
  SELECT DISTINCT ON (n.user_id)
    n.user_id,
    n.current_value::numeric AS balance
  FROM nps n
  CROSS JOIN params p
  WHERE n.user_id = ANY(p.user_ids)
    AND n.current_value IS NOT NULL
  ORDER BY n.user_id, n.updated_at DESC, n.id DESC
),
equity_latest AS (
  SELECT
    da.user_id,
    da.current_value::numeric AS balance
  FROM demat_accounts da
  CROSS JOIN params p
  WHERE da.user_id = ANY(p.user_ids)
    AND da.current_value IS NOT NULL
),
etf_accounts_latest AS (
  SELECT DISTINCT ON (ea.user_id, ea.demat_id)
    ea.user_id,
    COALESCE(ea.current_value, 0)::numeric AS balance
  FROM etf_accounts ea
  CROSS JOIN params p
  WHERE ea.user_id = ANY(p.user_ids)
  ORDER BY ea.user_id, ea.demat_id, ea.updated_at DESC NULLS LAST, ea.id DESC
),
mf_latest AS (
  SELECT
    m.user_id,
    m.current_value::numeric AS balance
  FROM mf m
  CROSS JOIN params p
  WHERE m.user_id = ANY(p.user_ids)
    AND m.current_value IS NOT NULL
),
manual_assets_latest AS (
  SELECT
    ua.user_id,
    ac.type,
    SUM(
      COALESCE(
        NULLIF(ua.data_json->>'current_value', '')::numeric,
        NULLIF(ua.data_json->>'value', '')::numeric,
        0
      )
    )::numeric AS balance
  FROM user_assets ua
  JOIN asset_classes ac ON ua.asset_class_id = ac.id
  CROSS JOIN params p
  WHERE ua.user_id = ANY(p.user_ids)
    AND ua.is_manual_entry = true
    AND ua.deleted_at IS NULL
  GROUP BY ua.user_id, ac.type
),
total_wealth AS (
  SELECT
    COALESCE((SELECT SUM(balance) FROM deposits_latest), 0) +
    COALESCE((SELECT SUM(balance) FROM recurring_latest), 0) +
    COALESCE((SELECT SUM(balance) FROM term_latest), 0) +
    COALESCE((SELECT SUM(balance) FROM nps_latest), 0) +
    COALESCE((SELECT SUM(balance) FROM equity_latest), 0) +
    COALESCE((SELECT SUM(balance) FROM etf_accounts_latest), 0) +
    COALESCE((SELECT SUM(balance) FROM mf_latest), 0) +
    COALESCE((SELECT SUM(balance) FROM manual_assets_latest), 0)
    AS total
),

-- ============================================================================
-- 4) Remaining -> India (backend assumption)
-- ============================================================================
remaining_to_india AS (
  SELECT GREATEST((tw.total - met.total), 0)::numeric AS remaining
  FROM total_wealth tw
  CROSS JOIN mf_etf_total met
),
geo_with_india_remaining AS (
  -- existing geography buckets (MF/ETF)
  SELECT
    g.geography,
    g.mf_etf_value::numeric AS value
  FROM geo_mf_etf_totals g

  UNION ALL

  -- add the remaining to India
  SELECT
    'India' AS geography,
    r.remaining::numeric AS value
  FROM remaining_to_india r
),
geo_final AS (
  SELECT
    geography,
    SUM(value)::numeric AS value
  FROM geo_with_india_remaining
  GROUP BY geography
),

-- ============================================================================
-- 5) Percentages
-- ============================================================================
final_total AS (
  SELECT COALESCE(total, 0)::numeric AS total
  FROM total_wealth
)
SELECT
  gf.geography,
  ROUND(gf.value, p.decimal_places) AS value,
  ROUND(
    CASE WHEN ft.total > 0 THEN (gf.value / ft.total) * 100 ELSE 0 END,
    p.decimal_places
  ) AS percentage
FROM geo_final gf
CROSS JOIN final_total ft
CROSS JOIN params p
WHERE gf.value > p.min_value
ORDER BY gf.value DESC;

------------------------------------------------------

