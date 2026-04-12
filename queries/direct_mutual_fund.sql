WITH UserRegularMF AS (
    -- Step 1: Get all regular mutual funds for the user with their current value and scheme code
    SELECT
        mf.isin AS regular_isin,
        mf.current_value,
        mf.amfi_code AS regular_scheme_code,
        mf.scheme_option,
        mf.distribution_status
    FROM
        mf
    WHERE
        mf.user_id = {USER_ID}
        AND mf.deleted_at IS NULL
        AND LOWER(mf.scheme_option) = 'regular'
),
MFMappings AS (
    SELECT
        urm.regular_isin,
        urm.current_value,
        urm.regular_scheme_code,
        rdmm.direct_scheme_code
    FROM
        UserRegularMF urm
    JOIN
        regular_direct_mf_mapping rdmm ON urm.regular_isin = rdmm.regular_isin
    WHERE
        rdmm.deleted_at IS NULL
),
ExpenseRatios AS (
    SELECT
        mfm.regular_isin,
        mfm.current_value,
        mfm.regular_scheme_code,
        mfm.direct_scheme_code,
        mfer_reg.expense_ratio AS regular_expense_ratio,
        mfer_dir.expense_ratio AS direct_expense_ratio
    FROM
        MFMappings mfm
    LEFT JOIN
        mf_etf_master mfer_reg ON mfm.regular_scheme_code = mfer_reg.scheme_code
    LEFT JOIN
        mf_etf_master mfer_dir ON mfm.direct_scheme_code = mfer_dir.scheme_code
    WHERE
        mfer_reg.expense_ratio IS NOT NULL
        AND mfer_dir.expense_ratio IS NOT NULL
),
FundSavings AS (
    SELECT
        er.regular_isin,
        er.regular_scheme_code,
        er.direct_scheme_code,
        (er.regular_expense_ratio - er.direct_expense_ratio) AS expense_ratio_difference,
        er.current_value,
        (
            CASE
                WHEN er.regular_expense_ratio > er.direct_expense_ratio THEN
                    er.current_value * ((er.regular_expense_ratio - er.direct_expense_ratio) / 100.0)
                ELSE
                    0
            END
        ) AS potential_savings_per_fund
    FROM
        ExpenseRatios er
    WHERE
        er.regular_expense_ratio > er.direct_expense_ratio
)
SELECT 
    SUM(potential_savings_per_fund) AS total_potential_savings
FROM 
    FundSavings;