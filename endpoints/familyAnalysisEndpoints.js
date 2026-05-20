/**
 * Analysis API Endpoints
 * All analysis-related API calls defined here
 */

export const familyAnalysisEndpoints = {
  // Analysis Holdings Count - No filter (all assets)
  holdingsCount: (familyId) => `/api/v1/analysis/holdings?family_id=${familyId}`,

  // Analysis Holdings Count with Equity filter
  equityHoldingsCount: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_EQUITY || '17';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Mutual Fund filter
  mfHoldingsCount: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_MUTUAL_FUNDS || '21';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with ETF filter
  etfHoldingsCount: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_ETF || '18';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Bank Balance filter
  bankBalanceHoldingsCount: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_BANK_DEPOSITS || '22';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Recurring Deposits filter
  rdHoldingsCount: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_RECURRING_DEPOSITS || '14';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Fixed Deposits filter
  fdHoldingsCount: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_FIXED_DEPOSITS || '15';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with NPS filter
  npsHoldingsCount: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_NPS || '16';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Gold filter
  goldHoldingsCount: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_GOLD || '20';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Real Estate filter
  realEstateHoldingsCount: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_REAL_ESTATE || '13';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Holdings Count with Crypto filter
  cryptoHoldingsCount: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_CRYPTO || '19';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/holdings?family_id=${familyId}&asset_class_id=${assetClassId}&entity_type=${entityType}`;
  },

  // Analysis Recent Dividends
  recentDividends: (familyId, fromDate, toDate) => {
    let url = `/api/v1/analysis/overview/dividends/?family_id=${familyId}`;
    if (fromDate) url += `&from_date=${fromDate}`;
    if (toDate) url += `&to_date=${toDate}`;
    return url;
  },

  // Analysis Benchmark Comparison
  benchmarkComparison: (familyId) => `/api/v1/analysis/performance/benchmark?family_id=${familyId}`,

  // Analysis Risk Contributors - All Assets
  riskContributors: (familyId) => `/api/v1/analysis/risk/contributors?family_id=${familyId}`,

  // Analysis Risk Contributors - Equity Only
  equityRiskContributors: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_EQUITY || '17';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/risk/contributors?asset_class_id=${assetClassId}&entity_type=${entityType}&family_id=${familyId}`;
  },

  // Analysis Risk Contributors - Mutual Funds Only
  mfRiskContributors: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_MUTUAL_FUNDS || '21';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/risk/contributors?asset_class_id=${assetClassId}&entity_type=${entityType}&family_id=${familyId}`;
  },

  // Analysis Risk Contributors - ETF Only
  etfRiskContributors: (familyId) => {
    const assetClassId = process.env.ASSET_CLASS_ID_ETF || '18';
    const entityType = process.env.ENTITY_TYPE || 'asset';
    return `/api/v1/analysis/risk/contributors?asset_class_id=${assetClassId}&entity_type=${entityType}&family_id=${familyId}`;
  },

  // Analysis Asset Class Allocation
  assetClassAllocation: (familyId) => `/api/v1/analysis/allocation?category=asset_class&family_id=${familyId}`,

  // Analysis Geography Allocation
  geographyAllocation: (familyId) => `/api/v1/analysis/allocation?category=geography&family_id=${familyId}`,

  // Analysis Securities Overlap
  securitiesOverlap: (familyId) => `/api/v1/analysis/overlap/securities?family_id=${familyId}`,
};
