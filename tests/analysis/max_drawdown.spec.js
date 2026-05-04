import { test, expect } from '../../fixtures/fixtures.js';
import { dbClient } from '../../utils/db/dbClient.js';
import { analysisEndpoints } from '../../endpoints/index.js';

/**
 * Portfolio Max Drawdown Test — API vs locally-recomputed
 *
 * Mirrors app/utils/calculation_util.py :: calculate_max_drawdown:
 *   1. Filter to last (lookback_months × 30) days from the LAST date in series.
 *   2. cumulative   = cumprod(1 + r_t)
 *   3. running_max  = expanding max
 *   4. drawdown_t   = (cumulative_t − running_max_t) / running_max_t
 *   5. max_drawdown = min(drawdown)
 *
 * Required env: USER_ID
 * Optional env: MDD_LOOKBACK_DAYS (default 365)
 *               MDD_LOOKBACK_MONTHS (default 12)
 *               ONLY_POSITIONS_WITH_TRANSACTIONS (default true)
 */

const LOOKBACK_DAYS   = parseInt(process.env.MDD_LOOKBACK_DAYS || '365', 10);
const LOOKBACK_MONTHS = parseInt(process.env.MDD_LOOKBACK_MONTHS || '12', 10);
const COMPARISON_THRESHOLD_PCT = parseFloat(process.env.COMPARISON_THRESHOLD_PCT || '0.25');
const ONLY_POSITIONS_WITH_TRANSACTIONS =
  (process.env.ONLY_POSITIONS_WITH_TRANSACTIONS || 'true').toLowerCase() === 'true';

function bindNamedParams(sqlStr, params) {
  const order = [];
  const newSql = sqlStr.replace(/(::)|:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, dbl, name) => {
    if (dbl) return '::';
    if (!(name in params)) throw new Error(`Missing param :${name}`);
    let idx = order.indexOf(name);
    if (idx === -1) { order.push(name); idx = order.length - 1; }
    return `$${idx + 1}`;
  });
  return { sql: newSql, values: order.map(n => params[n]) };
}

async function resolveExcludes(userIds) {
  const exclude = {
    equity_demat_ids: [], equity_security_ids: [],
    mf_account_ids: [],
    etf_account_ids: [], etf_isins: [],
  };

  const eq = await dbClient.query(
    `SELECT DISTINCT dh.demat_account_id, dh.security_id
       FROM demat_holdings dh
      WHERE dh.user_id = ANY($1::int[])
        AND dh.demat_account_id IS NOT NULL
        AND dh.security_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM demat_account_transactions t
           WHERE t.account_id = dh.demat_account_id
             AND t.security_id = dh.security_id
             AND t.user_id = dh.user_id
        )`,
    [userIds]
  );
  for (const r of eq.rows) {
    if (r.demat_account_id != null && r.security_id != null) {
      exclude.equity_demat_ids.push(parseInt(r.demat_account_id, 10));
      exclude.equity_security_ids.push(parseInt(r.security_id, 10));
    }
  }

  const mf = await dbClient.query(
    `SELECT DISTINCT m.id
       FROM mf m
      WHERE m.user_id = ANY($1::int[])
        AND NOT EXISTS (
          SELECT 1 FROM mf_user_account_statements s
           WHERE s.mf_account_id = m.id AND s.user_id = m.user_id
        )`,
    [userIds]
  );
  exclude.mf_account_ids = mf.rows
    .map(r => r.id)
    .filter(id => id != null)
    .map(id => parseInt(id, 10));

  const etf = await dbClient.query(
    `SELECT DISTINCT eh.etf_account_id, eh.isin
       FROM etf_holdings eh
      WHERE eh.user_id = ANY($1::int[])
        AND eh.etf_account_id IS NOT NULL
        AND eh.isin IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM etf_user_account_statements s
           WHERE s.account_id = eh.etf_account_id
             AND s.isin = eh.isin
             AND s.user_id = eh.user_id
        )`,
    [userIds]
  );
  for (const r of etf.rows) {
    if (r.etf_account_id != null && r.isin != null) {
      exclude.etf_account_ids.push(parseInt(r.etf_account_id, 10));
      exclude.etf_isins.push(String(r.isin));
    }
  }

  return exclude;
}

async function fetchPortfolioReturns(userIds, startDate, endDate, opts = {}) {
  const onlyPositionsWithTx = opts.onlyPositionsWithTransactions !== false;

  let exclude = { equity_demat_ids: [], equity_security_ids: [],
                  mf_account_ids: [], etf_account_ids: [], etf_isins: [] };
  if (onlyPositionsWithTx) {
    exclude = await resolveExcludes(userIds);
  }

  const includeEquityExclude = onlyPositionsWithTx && exclude.equity_demat_ids.length > 0;
  const includeMfExclude     = onlyPositionsWithTx && exclude.mf_account_ids.length > 0;
  const includeEtfExclude    = onlyPositionsWithTx && exclude.etf_account_ids.length > 0;

  const PH_EQUITY = includeEquityExclude
    ? ` AND NOT ( (el.demat_id, el.security_id) IN (SELECT d, s FROM unnest(:exclude_equity_demat_ids::int[], :exclude_equity_security_ids::int[]) AS t(d, s)) )`
    : '';
  const PH_MF = includeMfExclude
    ? ` AND mfl.mf_account_id != ALL(:exclude_mf_account_ids::int[])`
    : '';
  const PH_ETF = includeEtfExclude
    ? ` AND NOT ( (el.etf_account_id, el.isin) IN (SELECT acc, isin FROM unnest(:exclude_etf_account_ids::int[], :exclude_etf_isins::text[]) AS t(acc, isin)) )`
    : '';

  let sqlStr = `
    WITH date_range AS (
        SELECT generate_series(:start_date, COALESCE(:end_date, CURRENT_DATE), '1 day')::date AS d
    ),
    user_equities AS (
        SELECT DISTINCT el.user_id, el.security_id, el.demat_id
        FROM equity_ledger el
        WHERE el.user_id = ANY(:user_ids)
          AND el.ledger_date >= DATE_TRUNC('month', :start_date)::date
          AND (:end_date IS NULL OR el.ledger_date <= :end_date)
          AND (:equity_account_ids::int[] IS NULL OR el.demat_id = ANY(:equity_account_ids::int[]))
          PLACEHOLDER_EQUITY
    ),
    initial_equity AS (
        SELECT DISTINCT ON (el.user_id, el.security_id, el.demat_id)
            el.user_id, el.security_id, el.demat_id, el.cumulative_units AS units
        FROM equity_ledger el
        WHERE el.user_id = ANY(:user_ids)
          AND el.ledger_date < :start_date
          AND (:equity_account_ids::int[] IS NULL OR el.demat_id = ANY(:equity_account_ids::int[]))
          PLACEHOLDER_EQUITY
        ORDER BY el.user_id, el.security_id, el.demat_id, el.ledger_date DESC
    ),
    initial_equity_prices AS (
        SELECT DISTINCT ON (ue.security_id)
            ue.security_id,
            eph.close_price
        FROM user_equities ue
        JOIN equity_price_history eph ON eph.security_id = ue.security_id
        WHERE eph.trade_date < :start_date
          AND eph.trade_date >= :start_date - INTERVAL '10 days'
          AND eph.close_price IS NOT NULL
        ORDER BY ue.security_id, eph.trade_date DESC
    ),
    equity_ledger_expanded AS (
        SELECT
            dr.d AS ledger_date,
            ue.user_id,
            ue.security_id,
            ue.demat_id,
            COALESCE(el.units, CASE WHEN dr.d = :start_date THEN ie.units END) AS units
        FROM date_range dr
        JOIN user_equities ue ON TRUE
        LEFT JOIN LATERAL (
            SELECT DISTINCT ON (el.user_id, el.security_id, el.demat_id, el.ledger_date)
                el.cumulative_units AS units
            FROM equity_ledger el
            WHERE el.user_id = ue.user_id
              AND el.security_id = ue.security_id
              AND el.demat_id = ue.demat_id
              AND el.ledger_date = dr.d
            ORDER BY el.user_id, el.security_id, el.demat_id, el.ledger_date DESC, el.id DESC
            LIMIT 1
        ) el ON TRUE
        LEFT JOIN initial_equity ie
            ON ie.user_id = ue.user_id
           AND ie.security_id = ue.security_id
           AND ie.demat_id = ue.demat_id
    ),
    daily_equity_partitions AS (
        SELECT
            ledger_date, user_id, security_id, demat_id, units,
            SUM(CASE WHEN units IS NOT NULL THEN 1 ELSE 0 END)
              OVER (PARTITION BY user_id, security_id, demat_id ORDER BY ledger_date, security_id) AS grp
        FROM equity_ledger_expanded
    ),
    daily_equity_units AS (
        SELECT
            ledger_date, user_id, security_id, demat_id,
            FIRST_VALUE(units) OVER (PARTITION BY user_id, security_id, demat_id, grp ORDER BY ledger_date, security_id) AS units
        FROM daily_equity_partitions
    ),
    equity_prices_joined AS (
        SELECT
            deu.ledger_date, deu.user_id, deu.security_id, deu.demat_id, deu.units,
            eph.close_price,
            eph.daily_change_percentage,
            iep.close_price AS initial_close_price
        FROM daily_equity_units deu
        LEFT JOIN equity_price_history eph
            ON eph.security_id = deu.security_id
           AND eph.trade_date = deu.ledger_date
        LEFT JOIN initial_equity_prices iep
            ON iep.security_id = deu.security_id
    ),
    equity_prices_filled AS (
        SELECT
            ledger_date, user_id, security_id, demat_id, units,
            daily_change_percentage,
            initial_close_price,
            FIRST_VALUE(close_price) OVER (PARTITION BY user_id, security_id, demat_id, price_grp ORDER BY ledger_date) AS filled_close_price
        FROM (
            SELECT *,
                SUM(CASE WHEN close_price IS NOT NULL THEN 1 ELSE 0 END)
                  OVER (PARTITION BY user_id, security_id, demat_id ORDER BY ledger_date) AS price_grp
            FROM equity_prices_joined
        ) sub
    ),
    daily_equity_state AS (
        SELECT
            ledger_date,
            'equity' AS asset_type,
            COALESCE(daily_change_percentage, 0) AS daily_return,
            (units * COALESCE(filled_close_price, initial_close_price, 0)) AS current_value
        FROM equity_prices_filled
        WHERE units > 0
          AND COALESCE(filled_close_price, initial_close_price) IS NOT NULL
    ),
    user_mfs AS (
        SELECT DISTINCT mfl.user_id, mfl.isin
        FROM mf_ledger mfl
        WHERE mfl.user_id = ANY(:user_ids)
          AND mfl.ledger_date >= DATE_TRUNC('month', :start_date)::date
          AND (:end_date IS NULL OR mfl.ledger_date <= :end_date)
          AND (:mf_account_ids::int[] IS NULL OR mfl.mf_account_id = ANY(:mf_account_ids::int[]))
          PLACEHOLDER_MF
    ),
    initial_mfs AS (
        SELECT DISTINCT ON (mfl.user_id, mfl.isin)
            mfl.user_id, mfl.isin, mfl.cumulative_units AS units, mfl.current_value
        FROM mf_ledger mfl
        WHERE mfl.user_id = ANY(:user_ids)
          AND mfl.isin IS NOT NULL
          AND mfl.ledger_date < :start_date
          AND (:mf_account_ids::int[] IS NULL OR mfl.mf_account_id = ANY(:mf_account_ids::int[]))
          PLACEHOLDER_MF
        ORDER BY mfl.user_id, mfl.isin, mfl.ledger_date DESC
    ),
    initial_mf_navs AS (
        SELECT DISTINCT ON (um.isin)
            um.isin, hn.nav
        FROM user_mfs um
        JOIN historic_nav hn ON hn.isin = um.isin
        WHERE hn.nav_date < :start_date
          AND hn.nav_date >= :start_date - INTERVAL '10 days'
          AND hn.nav IS NOT NULL
        ORDER BY um.isin, hn.nav_date DESC
    ),
    mf_ledger_expanded AS (
        SELECT
            dr.d AS ledger_date,
            um.user_id,
            um.isin,
            COALESCE(mfl.cumulative_units, CASE WHEN dr.d = :start_date THEN im.units END) AS units,
            COALESCE(mfl.current_value, CASE WHEN dr.d = :start_date THEN im.current_value END) AS current_value
        FROM date_range dr
        JOIN user_mfs um ON TRUE
        LEFT JOIN LATERAL (
            SELECT DISTINCT ON (mfl.user_id, mfl.isin, mfl.ledger_date)
                mfl.cumulative_units, mfl.current_value
            FROM mf_ledger mfl
            WHERE mfl.user_id = um.user_id
              AND mfl.isin = um.isin
              AND mfl.ledger_date = dr.d
            ORDER BY mfl.user_id, mfl.isin, mfl.ledger_date DESC, mfl.id DESC
            LIMIT 1
        ) mfl ON TRUE
        LEFT JOIN initial_mfs im
            ON im.user_id = um.user_id
           AND im.isin = um.isin
    ),
    daily_mf_partitions AS (
        SELECT
            ledger_date, user_id, isin, units, current_value,
            SUM(CASE WHEN units IS NOT NULL THEN 1 ELSE 0 END)
              OVER (PARTITION BY user_id, isin ORDER BY ledger_date, isin) AS grp
        FROM mf_ledger_expanded
    ),
    daily_mf_units AS (
        SELECT
            ledger_date, user_id, isin,
            FIRST_VALUE(units) OVER (PARTITION BY user_id, isin, grp ORDER BY ledger_date, isin) AS units,
            FIRST_VALUE(current_value) OVER (PARTITION BY user_id, isin, grp ORDER BY ledger_date, isin) AS current_value
        FROM daily_mf_partitions
    ),
    mf_navs_joined AS (
        SELECT
            dmu.ledger_date, dmu.user_id, dmu.isin, dmu.units,
            hn.nav,
            imn.nav AS initial_nav
        FROM daily_mf_units dmu
        LEFT JOIN historic_nav hn
            ON hn.isin = dmu.isin
           AND hn.nav_date = dmu.ledger_date
        LEFT JOIN initial_mf_navs imn
            ON imn.isin = dmu.isin
    ),
    mf_navs_filled AS (
        SELECT
            ledger_date, user_id, isin, units,
            nav, initial_nav,
            FIRST_VALUE(nav) OVER (PARTITION BY user_id, isin, nav_grp ORDER BY ledger_date) AS filled_nav
        FROM (
            SELECT *,
                SUM(CASE WHEN nav IS NOT NULL THEN 1 ELSE 0 END)
                  OVER (PARTITION BY user_id, isin ORDER BY ledger_date) AS nav_grp
            FROM mf_navs_joined
        ) sub
    ),
    daily_mf_state AS (
        SELECT
            ledger_date,
            'mf' AS asset_type,
            CASE
                WHEN nav IS NOT NULL
                     AND COALESCE(LAG(filled_nav) OVER (PARTITION BY user_id, isin ORDER BY ledger_date), initial_nav) > 0
                THEN (nav - COALESCE(LAG(filled_nav) OVER (PARTITION BY user_id, isin ORDER BY ledger_date), initial_nav)) /
                      COALESCE(LAG(filled_nav) OVER (PARTITION BY user_id, isin ORDER BY ledger_date), initial_nav) * 100
                ELSE 0
            END AS daily_return,
            (units * COALESCE(filled_nav, initial_nav, 0)) AS current_value
        FROM mf_navs_filled
        WHERE units > 0
          AND COALESCE(filled_nav, initial_nav) IS NOT NULL
    ),
    user_etfs AS (
        SELECT DISTINCT el.user_id, el.isin, el.etf_account_id
        FROM etf_ledger el
        WHERE el.user_id = ANY(:user_ids)
          AND el.ledger_date >= DATE_TRUNC('month', :start_date)::date
          AND (:end_date IS NULL OR el.ledger_date <= :end_date)
          AND (:etf_account_ids::int[] IS NULL OR el.etf_account_id = ANY(:etf_account_ids::int[]))
          PLACEHOLDER_ETF
    ),
    initial_etfs AS (
        SELECT DISTINCT ON (el.user_id, el.isin, el.etf_account_id)
            el.user_id, el.isin, el.etf_account_id, el.cumulative_units AS units
        FROM etf_ledger el
        WHERE el.user_id = ANY(:user_ids)
          AND el.ledger_date < :start_date
          AND (:etf_account_ids::int[] IS NULL OR el.etf_account_id = ANY(:etf_account_ids::int[]))
          PLACEHOLDER_ETF
        ORDER BY el.user_id, el.isin, el.etf_account_id, el.ledger_date DESC
    ),
    initial_etf_navs AS (
        SELECT DISTINCT ON (ue.isin)
            ue.isin, hn.nav
        FROM user_etfs ue
        JOIN historic_nav hn ON hn.isin = ue.isin
        WHERE hn.nav_date < :start_date
          AND hn.nav_date >= :start_date - INTERVAL '10 days'
          AND hn.nav IS NOT NULL
        ORDER BY ue.isin, hn.nav_date DESC
    ),
    etf_ledger_expanded AS (
        SELECT
            dr.d AS ledger_date,
            ue.user_id,
            ue.isin,
            ue.etf_account_id,
            COALESCE(el.units, CASE WHEN dr.d = :start_date THEN ie.units END) AS units
        FROM date_range dr
        JOIN user_etfs ue ON TRUE
        LEFT JOIN LATERAL (
            SELECT DISTINCT ON (el.user_id, el.isin, el.etf_account_id, el.ledger_date)
                el.cumulative_units AS units
            FROM etf_ledger el
            WHERE el.user_id = ue.user_id
              AND el.isin = ue.isin
              AND el.etf_account_id = ue.etf_account_id
              AND el.ledger_date = dr.d
            ORDER BY el.user_id, el.isin, el.etf_account_id, el.ledger_date DESC, el.id DESC
            LIMIT 1
        ) el ON TRUE
        LEFT JOIN initial_etfs ie
            ON ie.user_id = ue.user_id
           AND ie.isin = ue.isin
           AND ie.etf_account_id = ue.etf_account_id
    ),
    daily_etf_partitions AS (
        SELECT
            ledger_date, user_id, isin, etf_account_id, units,
            SUM(CASE WHEN units IS NOT NULL THEN 1 ELSE 0 END)
              OVER (PARTITION BY user_id, isin, etf_account_id ORDER BY ledger_date, isin) AS grp
        FROM etf_ledger_expanded
    ),
    daily_etf_units AS (
        SELECT
            ledger_date, user_id, isin, etf_account_id,
            FIRST_VALUE(units) OVER (PARTITION BY user_id, isin, etf_account_id, grp ORDER BY ledger_date, isin) AS units
        FROM daily_etf_partitions
    ),
    etf_navs_joined AS (
        SELECT
            deu.ledger_date, deu.user_id, deu.isin, deu.etf_account_id, deu.units,
            hn.nav,
            ien.nav AS initial_nav
        FROM daily_etf_units deu
        LEFT JOIN historic_nav hn
            ON hn.isin = deu.isin
           AND hn.nav_date = deu.ledger_date
        LEFT JOIN initial_etf_navs ien
            ON ien.isin = deu.isin
    ),
    etf_navs_filled AS (
        SELECT
            ledger_date, user_id, isin, etf_account_id, units,
            nav, initial_nav,
            FIRST_VALUE(nav) OVER (PARTITION BY user_id, isin, etf_account_id, nav_grp ORDER BY ledger_date) AS filled_nav
        FROM (
            SELECT *,
                SUM(CASE WHEN nav IS NOT NULL THEN 1 ELSE 0 END)
                  OVER (PARTITION BY user_id, isin, etf_account_id ORDER BY ledger_date) AS nav_grp
            FROM etf_navs_joined
        ) sub
    ),
    daily_etf_state AS (
        SELECT
            ledger_date,
            'etf' AS asset_type,
            CASE
                WHEN nav IS NOT NULL
                     AND COALESCE(LAG(filled_nav) OVER (PARTITION BY user_id, isin, etf_account_id ORDER BY ledger_date), initial_nav) > 0
                THEN (nav - COALESCE(LAG(filled_nav) OVER (PARTITION BY user_id, isin, etf_account_id ORDER BY ledger_date), initial_nav)) /
                      COALESCE(LAG(filled_nav) OVER (PARTITION BY user_id, isin, etf_account_id ORDER BY ledger_date), initial_nav) * 100
                ELSE 0
            END AS daily_return,
            (units * COALESCE(filled_nav, initial_nav, 0)) AS current_value
        FROM etf_navs_filled
        WHERE units > 0
          AND COALESCE(filled_nav, initial_nav) IS NOT NULL
    ),
    combined_state AS (
        SELECT ledger_date, asset_type, daily_return, current_value FROM daily_equity_state
        WHERE (:asset_class_type::text IS NULL OR :asset_class_type::text = 'equity')
        UNION ALL
        SELECT ledger_date, asset_type, daily_return, current_value FROM daily_mf_state
        WHERE (:asset_class_type::text IS NULL OR :asset_class_type::text = 'mf')
        UNION ALL
        SELECT ledger_date, asset_type, daily_return, current_value FROM daily_etf_state
        WHERE (:asset_class_type::text IS NULL OR :asset_class_type::text = 'etf')
    ),
    total_wealth_by_date AS (
        SELECT ledger_date, COALESCE(SUM(current_value), 0) AS total_wealth
        FROM combined_state
        GROUP BY ledger_date
    ),
    weighted_returns AS (
        SELECT
            cs.ledger_date,
            cs.asset_type,
            cs.daily_return,
            cs.current_value,
            tw.total_wealth,
            CASE WHEN tw.total_wealth > 0 THEN cs.current_value / tw.total_wealth ELSE 0 END AS portfolio_weight,
            CASE WHEN tw.total_wealth > 0 THEN (cs.current_value / tw.total_wealth) * cs.daily_return ELSE 0 END AS weighted_return
        FROM combined_state cs
        JOIN total_wealth_by_date tw ON tw.ledger_date = cs.ledger_date
    ),
    portfolio_returns_by_date AS (
        SELECT ledger_date AS date, SUM(weighted_return) AS portfolio_return
        FROM weighted_returns
        GROUP BY ledger_date
        ORDER BY ledger_date
    )
    SELECT
        to_char(dr.d, 'YYYY-MM-DD') AS date,
        COALESCE(pr.portfolio_return, 0) AS portfolio_return
    FROM date_range dr
    LEFT JOIN portfolio_returns_by_date pr ON pr.date = dr.d
    ORDER BY dr.d
  `;

  sqlStr = sqlStr
    .replace(/PLACEHOLDER_EQUITY/g, PH_EQUITY)
    .replace(/PLACEHOLDER_MF/g, PH_MF)
    .replace(/PLACEHOLDER_ETF/g, PH_ETF);

  const params = {
    user_ids: userIds,
    start_date: startDate,
    end_date: endDate,
    asset_class_type: null,
    equity_account_ids: null,
    mf_account_ids: null,
    etf_account_ids: null,
  };
  if (includeEquityExclude) {
    params.exclude_equity_demat_ids   = exclude.equity_demat_ids;
    params.exclude_equity_security_ids = exclude.equity_security_ids;
  }
  if (includeMfExclude) {
    params.exclude_mf_account_ids = exclude.mf_account_ids;
  }
  if (includeEtfExclude) {
    params.exclude_etf_account_ids = exclude.etf_account_ids;
    params.exclude_etf_isins       = exclude.etf_isins;
  }

  const { sql, values } = bindNamedParams(sqlStr, params);
  const { rows } = await dbClient.query(sql, values);

  const series = new Map();
  for (const r of rows) {
    if (r.portfolio_return == null) continue;
    const v = parseFloat(r.portfolio_return);
    if (!isFinite(v)) continue;
    series.set(String(r.date), v / 100.0);
  }
  return series;
}

function calculateMaxDrawdown(seriesMap, opts = {}) {
  const lookbackMonths = opts.lookbackMonths != null ? opts.lookbackMonths : 12;

  if (!seriesMap || seriesMap.size < 2) return null;

  const entries = [...seriesMap.entries()]
    .filter(([d, v]) => d != null && v != null && isFinite(v))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  if (entries.length < 2) return null;

  let filtered = entries;
  if (lookbackMonths > 0) {
    const lastDateStr = entries[entries.length - 1][0];
    const lastDate = new Date(`${lastDateStr}T00:00:00Z`);
    const cutoff = new Date(lastDate);
    cutoff.setUTCDate(cutoff.getUTCDate() - lookbackMonths * 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    filtered = entries.filter(([d]) => d >= cutoffStr);
  }

  if (filtered.length < 2) return null;

  let cumulative = 1.0;
  let runningMax = -Infinity;
  let maxDrawdown = 0;

  for (const [, r] of filtered) {
    cumulative *= (1 + r);
    if (cumulative > runningMax) runningMax = cumulative;

    if (runningMax > 0) {
      const drawdown = (cumulative - runningMax) / runningMax;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }
  }

  if (!isFinite(maxDrawdown)) return null;
  return maxDrawdown;
}

function extractApiMaxDrawdown(body) {
  const data = body?.data;
  if (!data) return { value: null, raw: null };

  let raw = null;
  if (data.max_drawdown != null) raw = data.max_drawdown;
  else if (data['Max Drawdown'] != null) raw = data['Max Drawdown'];
  else {
    const candidates = []
      .concat(Array.isArray(data) ? data : [])
      .concat(Array.isArray(data.metrics) ? data.metrics : [])
      .concat(Array.isArray(data.key_metrics) ? data.key_metrics : [])
      .concat(Array.isArray(data.keyMetrics) ? data.keyMetrics : []);

    const match = candidates.find(item => {
      const label = String(item?.key ?? item?.title ?? item?.name ?? '').toLowerCase();
      return label === 'max drawdown' || label === 'max_drawdown' || label === 'maxdrawdown';
    });

    if (match) raw = match.value ?? match.val ?? match.amount;
  }

  if (raw == null) return { value: null, raw: null };
  const rawStr = String(raw).trim();
  const cleaned = rawStr.replace(/[^0-9.\-+]/g, '');
  const parsed = parseFloat(cleaned);
  return { value: isFinite(parsed) ? parsed : null, raw: rawStr };
}

test.describe('Analysis Max Drawdown Tests', () => {

  test.beforeAll(async () => {
    await dbClient.init();
  });

  test.afterAll(async () => {
    await dbClient.close();
  });

  test('Max Drawdown - API vs SQL', async ({ apiClient }) => {
    const userId = parseInt(process.env.USER_ID, 10);
    if (!userId) throw new Error('USER_ID env var is required');

    console.log('\n=== Testing Max Drawdown Comparison ===');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - LOOKBACK_DAYS);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr   = endDate.toISOString().split('T')[0];

    const [portfolioMap, keyMetricsRes] = await Promise.all([
      fetchPortfolioReturns([userId], startStr, endStr, {
        onlyPositionsWithTransactions: ONLY_POSITIONS_WITH_TRANSACTIONS,
      }),
      apiClient.get(analysisEndpoints.keyMetrics(userId, endStr, endStr)),
    ]);

    console.log('\n=== API Response (Key Metrics) ===');
    console.log(JSON.stringify(keyMetricsRes.body, null, 2));

    const sqlMddDecimal = calculateMaxDrawdown(portfolioMap, {
      lookbackMonths: LOOKBACK_MONTHS,
    });
    if (sqlMddDecimal == null || !isFinite(sqlMddDecimal)) {
      throw new Error('SQL Max Drawdown calculation returned null/invalid');
    }
    const sqlMddPct = sqlMddDecimal * 100;

    const { value: apiMddPct, raw: apiMddRaw } = extractApiMaxDrawdown(keyMetricsRes.body);
    if (apiMddPct == null || !isFinite(apiMddPct)) {
      throw new Error(`Max Drawdown not available in key-metrics API response (got "${apiMddRaw ?? 'missing'}")`);
    }

    const diff = Math.abs(apiMddPct - sqlMddPct);
    const diffPct = Math.abs(apiMddPct) > 0
      ? (diff / Math.abs(apiMddPct)) * 100
      : (diff === 0 ? 0 : Infinity);
    const sameSign = (apiMddPct === 0 && sqlMddPct === 0) || Math.sign(apiMddPct) === Math.sign(sqlMddPct);
    const match = sameSign && diffPct <= COMPARISON_THRESHOLD_PCT;

    const formattedReport = `
=== Max Drawdown - API vs SQL ===
User ID            : ${userId}
Lookback Months    : ${LOOKBACK_MONTHS} (${LOOKBACK_MONTHS * 30} days)
Source Date Range  : ${startStr} → ${endStr}
Portfolio Rows     : ${portfolioMap.size}
API Max Drawdown   : ${apiMddPct.toFixed(1)}%
SQL Max Drawdown   : ${sqlMddPct.toFixed(1)}%
Raw Difference     : ${diff.toFixed(4)}%
Diff %             : ${diffPct.toFixed(2)}%
Threshold          : ${COMPARISON_THRESHOLD_PCT}%
Sign Match         : ${sameSign ? '✅' : '❌'}
Result             : ${match ? '✅ Within Threshold' : '❌ Mismatch'}
`;

    console.log(formattedReport);

    test.info().attach('max_drawdown.txt', {
      body: formattedReport,
      contentType: 'text/plain',
    });

    expect(match, `API Max Drawdown ${apiMddPct.toFixed(1)}% vs SQL ${sqlMddPct.toFixed(1)}% — diff ${diffPct.toFixed(2)}% (threshold ${COMPARISON_THRESHOLD_PCT}%, sign match: ${sameSign})`).toBe(true);
  });

});
