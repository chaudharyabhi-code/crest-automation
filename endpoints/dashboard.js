/**
 * Dashboard API Endpoints
 * All dashboard-related API calls defined here
 */

export const dashboardEndpoints = {
  // Portfolio Summary
  portfolioSummary: (userId) => `/api/v1/dashboard/portfolio-summary?member_user_id=${userId}`,

  // Portfolio Volatility
  volatility: (userId) => `/api/v1/dashboard/volatility?member_user_id=${userId}`,

  // Asset Allocation
  assetAllocation: (userId, options = {}) => {
    const { fromDate, toDate, assetClassId, entityType } = options;
    const from = fromDate || '';
    const to = toDate || from;
    const entity = entityType || 'asset';
    const dateParam = from ? `&from_date=${from}&to_date=${to}` : '';
    const assetParam = assetClassId ? `&asset_class_id=${assetClassId}&entity_type=${entity}` : '';
    return `/api/v1/dashboard/asset-allocation?member_user_id=${userId}${assetParam}${dateParam}`;
  },

  // Performance Chart
  performanceChart: (userId, options = {}) => {
    const { fromDate, toDate, assetClassId, entityType } = options;
    const entity = entityType || 'asset';
    const dateParam = fromDate ? `&from_date=${fromDate}&to_date=${toDate || fromDate}` : '';
    const assetParam = assetClassId ? `&asset_class_id=${assetClassId}&entity_type=${entity}` : '';
    return `/api/v1/dashboard/performance-chart?member_user_id=${userId}${assetParam}${dateParam}`;
  },

  // Potential Savings
  potentialSavings: (userId) => `/api/v1/dashboard/potential-savings?member_user_id=${userId}`,

  // Benchmark Comparison - Trailing Returns
  // POST endpoint that requires body with benchmarks, from_date, and ranges
  benchmarkComparison: () => `/api/v1/pulse-lab/benchmark/comparision/trailing`,

  // Top Holdings
  topHoldings: (userId) => `/api/v1/dashboard/top-holdings?member_user_id=${userId}`,

  // Historical Data Endpoints
  // Historical Asset Allocation for a specific date
  historicalAssetAllocation: (userId, date) => {
    // For historical data, we use the same date for both start_date and end_date
    return `/api/v1/dashboard/asset-allocation?member_user_id=${userId}&from_date=${date}&to_date=${date}`;
  },

  // Historical Performance Chart for a specific date
  historicalPerformanceChart: (userId, date) => {
    // For historical data, we use the same date for both start_date and end_date
    return `/api/v1/dashboard/performance-chart?member_user_id=${userId}&from_date=${date}&to_date=${date}`;
  },

  // Equity Filter Endpoints
  // Asset Allocation with Equity filter for a specific date
  equityAssetAllocation: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_EQUITY || '17';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with Equity filter for a specific date
  equityPerformanceChart: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_EQUITY || '17';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Mutual Fund Filter Endpoints
  // Asset Allocation with MF filter for a specific date
  mfAssetAllocation: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_MUTUAL_FUNDS || '21';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with MF filter for a specific date
  mfPerformanceChart: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_MUTUAL_FUNDS || '21';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // ETF Filter Endpoints
  // Asset Allocation with ETF filter for a specific date
  etfAssetAllocation: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_ETF || '18';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with ETF filter for a specific date
  etfPerformanceChart: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_ETF || '18';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Bank Deposits Filter Endpoints
  // Asset Allocation with Bank Deposits filter for a specific date
  bankDepositsAssetAllocation: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_BANK_DEPOSITS || '22';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with Bank Deposits filter for a specific date
  bankDepositsPerformanceChart: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_BANK_DEPOSITS || '22';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Recurring Deposits Filter Endpoints
  // Asset Allocation with Recurring Deposits filter for a specific date
  rdAssetAllocation: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_RECURRING_DEPOSITS || '14';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with Recurring Deposits filter for a specific date
  rdPerformanceChart: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_RECURRING_DEPOSITS || '14';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Fixed Deposits Filter Endpoints
  // Asset Allocation with Fixed Deposits filter for a specific date
  fdAssetAllocation: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_FIXED_DEPOSITS || '15';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with Fixed Deposits filter for a specific date
  fdPerformanceChart: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_FIXED_DEPOSITS || '15';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // NPS Filter Endpoints
  // Asset Allocation with NPS filter for a specific date
  npsAssetAllocation: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_NPS || '16';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with NPS filter for a specific date
  npsPerformanceChart: (userId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_NPS || '16';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?member_user_id=${userId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Add more dashboard endpoints here as needed
  // portfolioDetails: (userId) => `/api/v1/dashboard/portfolio-details?member_user_id=${userId}`,
  // holdings: (userId) => `/api/v1/dashboard/holdings?member_user_id=${userId}`,
};
