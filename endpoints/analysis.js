/**
 * Analysis API Endpoints
 * All analysis-related API calls defined here
 */

export const analysisEndpoints = {
  // Analysis Holdings Count - No filter (all assets)
  holdingsCount: (userId) => `/api/v1/analysis/holdings?member_user_id=${userId}`,

  // Analysis Holdings Count with Equity filter
  equityHoldingsCount: (userId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_EQUITY || '17';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Mutual Fund filter
  mfHoldingsCount: (userId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_MUTUAL_FUNDS || '21';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with ETF filter
  etfHoldingsCount: (userId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_ETF || '18';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Bank Balance filter
  bankBalanceHoldingsCount: (userId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_BANK_DEPOSITS || '22';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Recurring Deposits filter
  rdHoldingsCount: (userId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_RECURRING_DEPOSITS || '14';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Fixed Deposits filter
  fdHoldingsCount: (userId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_FIXED_DEPOSITS || '15';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with NPS filter
  npsHoldingsCount: (userId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_NPS || '16';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Recent Dividends
  recentDividends: (userId, fromDate, toDate) => {
    let url = `/api/v1/analysis/overview/dividends/?member_user_id=${userId}`;
    if (fromDate) url += `&from_date=${fromDate}`;
    if (toDate) url += `&to_date=${toDate}`;
    return url;
  },

  // Analysis Benchmark Comparison
  benchmarkComparison: (userId) => `/api/v1/analysis/performance/benchmark?member_user_id=${userId}`,

  // Analysis Risk Contributors - All Assets
  riskContributors: (userId) => `/api/v1/analysis/risk/contributors?member_user_id=${userId}`,

  // Analysis Risk Contributors - Equity Only
  equityRiskContributors: (userId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_EQUITY || '17';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/risk/contributors?asset_class_id=${assetClassId}&entity_type=${entityType}&member_user_id=${userId}`;
  },

  // Analysis Risk Contributors - Mutual Funds Only
  mfRiskContributors: (userId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_MUTUAL_FUNDS || '21';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/risk/contributors?asset_class_id=${assetClassId}&entity_type=${entityType}&member_user_id=${userId}`;
  },

  // Analysis Risk Contributors - ETF Only
  etfRiskContributors: (userId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_ETF || '18';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/risk/contributors?asset_class_id=${assetClassId}&entity_type=${entityType}&member_user_id=${userId}`;
  },

  // Analysis Asset Class Allocation
  assetClassAllocation: (userId) => `/api/v1/analysis/allocation?category=asset_class&member_user_id=${userId}`,

  // Analysis Geography Allocation
  geographyAllocation: (userId) => `/api/v1/analysis/allocation?category=geography&member_user_id=${userId}`,

  // Analysis Key Metrics (for Beta, Alpha, Sharpe, Max Drawdown)
 keyMetrics: (userId, fromDate = '', toDate = '') =>
   `/api/v1/analysis/overview/key-metrics?from_date=${fromDate}&to_date=${toDate}&member_user_id=${userId}`,

  // Analysis Risk Metrics (for Sortino, Volatility, etc.)
  riskMetrics: (userId, assetClassId = '64', entityType = 'asset') =>
    `/api/v1/analysis/risk/metrics?asset_class_id=${assetClassId}&entity_type=${entityType}&member_user_id=${userId}`,

};
