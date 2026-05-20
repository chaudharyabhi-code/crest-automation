/**
 * Dashboard API Endpoints
 * All dashboard-related API calls defined here
 */

export const familyDashboardEndpoints = {
  // Portfolio Summary
  portfolioSummary: (familyId) => `/api/v1/dashboard/portfolio-summary?family_id=${familyId}`,

  // Portfolio Volatility
  volatility: (familyId) => `/api/v1/dashboard/volatility?family_id=${familyId}`,

  // Asset Allocation
  assetAllocation: (familyId, options = {}) => {
    const { fromDate, toDate, assetClassId, entityType } = options;
    const from = fromDate || '';
    const to = toDate || from;
    const entity = entityType || 'asset';
    const dateParam = from ? `&from_date=${from}&to_date=${to}` : '';
    const assetParam = assetClassId ? `&asset_class_id=${assetClassId}&entity_type=${entity}` : '';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}${assetParam}${dateParam}`;
  },

  // Performance Chart
  performanceChart: (familyId, options = {}) => {
    const { fromDate, toDate, assetClassId, entityType } = options;
    const entity = entityType || 'asset';
    const dateParam = fromDate ? `&from_date=${fromDate}&to_date=${toDate || fromDate}` : '';
    const assetParam = assetClassId ? `&asset_class_id=${assetClassId}&entity_type=${entity}` : '';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}${assetParam}${dateParam}`;
  },

  // Potential Savings
  potentialSavings: (familyId) => `/api/v1/dashboard/potential-savings?family_id=${familyId}`,

  // Benchmark Comparison - Trailing Returns
  // POST endpoint that requires body with benchmarks, from_date, and ranges
  benchmarkComparison: () => `/api/v1/pulse-lab/benchmark/comparision/trailing`,

  // Top Holdings
  topHoldings: (familyId) => `/api/v1/dashboard/top-holdings?family_id=${familyId}`,

  // Historical Data Endpoints
  // Historical Asset Allocation for a specific date
  historicalAssetAllocation: (familyId, date) => {
    // For historical data, we use the same date for both start_date and end_date
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&from_date=${date}&to_date=${date}`;
  },

  // Historical Performance Chart for a specific date
  historicalPerformanceChart: (familyId, date) => {
    // For historical data, we use the same date for both start_date and end_date
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&from_date=${date}&to_date=${date}`;
  },

  // Equity Filter Endpoints
  // Asset Allocation with Equity filter for a specific date
  equityAssetAllocation: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_EQUITY || '17';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with Equity filter for a specific date
  equityPerformanceChart: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_EQUITY || '17';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Mutual Fund Filter Endpoints
  // Asset Allocation with MF filter for a specific date
  mfAssetAllocation: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_MUTUAL_FUNDS || '21';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with MF filter for a specific date
  mfPerformanceChart: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_MUTUAL_FUNDS || '21';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // ETF Filter Endpoints
  // Asset Allocation with ETF filter for a specific date
  etfAssetAllocation: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_ETF || '18';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with ETF filter for a specific date
  etfPerformanceChart: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_ETF || '18';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Bank Deposits Filter Endpoints
  // Asset Allocation with Bank Deposits filter for a specific date
  bankDepositsAssetAllocation: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_BANK_DEPOSITS || '22';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with Bank Deposits filter for a specific date
  bankDepositsPerformanceChart: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_BANK_DEPOSITS || '22';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Recurring Deposits Filter Endpoints
  // Asset Allocation with Recurring Deposits filter for a specific date
  rdAssetAllocation: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_RECURRING_DEPOSITS || '14';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with Recurring Deposits filter for a specific date
  rdPerformanceChart: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_RECURRING_DEPOSITS || '14';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Fixed Deposits Filter Endpoints
  // Asset Allocation with Fixed Deposits filter for a specific date
  fdAssetAllocation: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_FIXED_DEPOSITS || '15';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with Fixed Deposits filter for a specific date
  fdPerformanceChart: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_FIXED_DEPOSITS || '15';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // NPS Filter Endpoints
  // Asset Allocation with NPS filter for a specific date
  npsAssetAllocation: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_NPS || '16';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Performance Chart with NPS filter for a specific date
  npsPerformanceChart: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_NPS || '16';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Crypto Filter Endpoints
  cryptoAssetAllocation: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_CRYPTO || '19';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },
  cryptoPerformanceChart: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_CRYPTO || '19';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Gold Filter Endpoints
  goldAssetAllocation: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_GOLD || '20';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },
  goldPerformanceChart: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_GOLD || '20';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Real Estate Filter Endpoints
  realEstateAssetAllocation: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_REAL_ESTATE || '13';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/asset-allocation?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },
  realEstatePerformanceChart: (familyId, date) => {
    const assetClassId = process.env.ASSET_CLASS_ID_REAL_ESTATE || '13';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/dashboard/performance-chart?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}&from_date=${date}&to_date=${date}`;
  },

  // Add more dashboard endpoints here as needed
  // portfolioDetails: (familyId) => `/api/v1/dashboard/portfolio-details?family_id=${familyId}`,
  // holdings: (familyId) => `/api/v1/dashboard/holdings?family_id=${familyId}`,
};
