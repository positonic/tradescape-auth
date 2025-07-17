export interface ExchangeCapabilities {
  /** Whether the exchange returns all trades when fetchMyTrades is called without a symbol */
  fetchesAllTradesAtOnce: boolean;
  
  /** Whether the exchange supports filtering trades by symbol parameter */
  supportsSymbolFiltering: boolean;
  
  /** Whether the exchange requires symbol-specific API calls to get trades */
  requiresSymbolSpecificCalls: boolean;
  
  /** Whether the exchange supports time-based filtering with 'since' parameter */
  supportsTimeFiltering: boolean;
  
  /** Whether the exchange supports pagination for large trade datasets */
  supportsPagination: boolean;
  
  /** Typical rate limit in milliseconds between API calls */
  rateLimit: number;
  
  /** Maximum number of trades returned in a single API call */
  maxTradesPerCall?: number;
}

export const EXCHANGE_CAPABILITIES: Record<string, ExchangeCapabilities> = {
  hyperliquid: {
    fetchesAllTradesAtOnce: true,
    supportsSymbolFiltering: false,
    requiresSymbolSpecificCalls: false,
    supportsTimeFiltering: true,
    supportsPagination: false,
    rateLimit: 100,
    maxTradesPerCall: undefined, // Returns all trades
  },
  
  binance: {
    fetchesAllTradesAtOnce: false,
    supportsSymbolFiltering: true,
    requiresSymbolSpecificCalls: true,
    supportsTimeFiltering: true,
    supportsPagination: true,
    rateLimit: 100,
    maxTradesPerCall: 1000,
  },
  
  kraken: {
    fetchesAllTradesAtOnce: false,
    supportsSymbolFiltering: true,
    requiresSymbolSpecificCalls: true,
    supportsTimeFiltering: true,
    supportsPagination: true,
    rateLimit: 1000,
    maxTradesPerCall: 50,
  },
  
  kucoin: {
    fetchesAllTradesAtOnce: false,
    supportsSymbolFiltering: true,
    requiresSymbolSpecificCalls: true,
    supportsTimeFiltering: true,
    supportsPagination: true,
    rateLimit: 200,
    maxTradesPerCall: 500,
  },
  
  bybit: {
    fetchesAllTradesAtOnce: false,
    supportsSymbolFiltering: true,
    requiresSymbolSpecificCalls: true,
    supportsTimeFiltering: true,
    supportsPagination: true,
    rateLimit: 120,
    maxTradesPerCall: 200,
  },
  
  okx: {
    fetchesAllTradesAtOnce: false,
    supportsSymbolFiltering: true,
    requiresSymbolSpecificCalls: true,
    supportsTimeFiltering: true,
    supportsPagination: true,
    rateLimit: 100,
    maxTradesPerCall: 100,
  },
};

// Default capabilities for unknown exchanges
export const DEFAULT_EXCHANGE_CAPABILITIES: ExchangeCapabilities = {
  fetchesAllTradesAtOnce: false,
  supportsSymbolFiltering: true,
  requiresSymbolSpecificCalls: true,
  supportsTimeFiltering: true,
  supportsPagination: true,
  rateLimit: 1000,
  maxTradesPerCall: 100,
};

/**
 * Get capabilities for a specific exchange
 */
export function getExchangeCapabilities(exchangeId: string): ExchangeCapabilities {
  return EXCHANGE_CAPABILITIES[exchangeId] || DEFAULT_EXCHANGE_CAPABILITIES;
}

/**
 * Check if an exchange supports bulk trade fetching
 */
export function supportsBulkFetch(exchangeId: string): boolean {
  const capabilities = getExchangeCapabilities(exchangeId);
  return capabilities.fetchesAllTradesAtOnce;
}

/**
 * Get list of exchanges that support bulk fetching
 */
export function getBulkFetchExchanges(): string[] {
  return Object.keys(EXCHANGE_CAPABILITIES).filter(supportsBulkFetch);
}

/**
 * Check if an exchange requires symbol-specific calls
 */
export function requiresSymbolSpecificCalls(exchangeId: string): boolean {
  const capabilities = getExchangeCapabilities(exchangeId);
  return capabilities.requiresSymbolSpecificCalls;
}

/**
 * Get optimal rate limit for an exchange
 */
export function getOptimalRateLimit(exchangeId: string): number {
  const capabilities = getExchangeCapabilities(exchangeId);
  return capabilities.rateLimit;
}

/**
 * Log exchange capabilities for debugging
 */
export function logExchangeCapabilities(exchangeId: string): void {
  const capabilities = getExchangeCapabilities(exchangeId);
  console.log(`📊 Exchange capabilities for ${exchangeId}:`, {
    bulkFetch: capabilities.fetchesAllTradesAtOnce,
    symbolFiltering: capabilities.supportsSymbolFiltering,
    timeFiltering: capabilities.supportsTimeFiltering,
    rateLimit: capabilities.rateLimit,
    maxTrades: capabilities.maxTradesPerCall,
  });
}