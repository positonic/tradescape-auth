export interface ExchangeFilterConfig {
  minTradeAmount: number;
  requireTimestamp: boolean;
  requireTradeId: boolean;
  customFilter?: (trade: any) => boolean;
}

export const EXCHANGE_FILTER_CONFIGS: Record<string, ExchangeFilterConfig> = {
  hyperliquid: {
    minTradeAmount: 0,
    requireTimestamp: true,
    requireTradeId: true,
    customFilter: (trade) => {
      // Hyperliquid-specific validation
      return trade.sz && parseFloat(trade.sz) > 0 && trade.coin && trade.px;
    }
  },
  
  binance: {
    minTradeAmount: 0.000001, // Filter out dust trades
    requireTimestamp: true,
    requireTradeId: true,
    customFilter: (trade) => {
      // Binance-specific validation
      return trade.symbol && trade.price && trade.qty;
    }
  },
  
  kraken: {
    minTradeAmount: 0.00000001,
    requireTimestamp: true,
    requireTradeId: true,
    customFilter: (trade) => {
      // Kraken-specific validation
      return trade.pair && trade.price && trade.vol;
    }
  },
  
  kucoin: {
    minTradeAmount: 0.000001,
    requireTimestamp: true,
    requireTradeId: true,
  },
  
  bybit: {
    minTradeAmount: 0.000001,
    requireTimestamp: true,
    requireTradeId: true,
  },
  
  okx: {
    minTradeAmount: 0.000001,
    requireTimestamp: true,
    requireTradeId: true,
  },
  
  // Default config for unknown exchanges
  default: {
    minTradeAmount: 0.000001,
    requireTimestamp: true,
    requireTradeId: true,
  }
};

export function getExchangeFilterConfig(exchangeId: string): ExchangeFilterConfig {
  return EXCHANGE_FILTER_CONFIGS[exchangeId] || EXCHANGE_FILTER_CONFIGS.default;
}