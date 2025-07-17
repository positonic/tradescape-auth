import { CCxtTrade } from './types';

export interface HyperliquidRawTrade {
  coin: string;
  px: string;
  sz: string;
  side: 'B' | 'A'; // Buy or Ask (Sell)
  time: string;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: string;
  crossed: boolean;
  fee: string;
  tid: string;
  feeToken: string;
}

export interface BinanceRawTrade {
  symbol: string;
  id: number;
  orderId: number;
  side: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch: boolean;
}

/**
 * Validate and normalize raw trade data based on exchange format
 */
export function validateRawTrade(exchangeId: string, rawTrade: any): boolean {
  try {
    switch (exchangeId) {
      case 'hyperliquid':
        return validateHyperliquidTrade(rawTrade);
      case 'binance':
        return validateBinanceTrade(rawTrade);
      case 'kraken':
        return validateKrakenTrade(rawTrade);
      default:
        return validateGenericTrade(rawTrade);
    }
  } catch (error) {
    console.warn(`Trade validation failed for ${exchangeId}:`, error);
    return false;
  }
}

function validateHyperliquidTrade(trade: HyperliquidRawTrade): boolean {
  return !!(
    trade.coin &&
    trade.px &&
    trade.sz &&
    trade.side &&
    trade.time &&
    trade.tid &&
    parseFloat(trade.sz) > 0 &&
    parseFloat(trade.px) > 0
  );
}

function validateBinanceTrade(trade: BinanceRawTrade): boolean {
  return !!(
    trade.symbol &&
    trade.id &&
    trade.price &&
    trade.quantity &&
    trade.time &&
    parseFloat(trade.quantity) > 0 &&
    parseFloat(trade.price) > 0
  );
}

function validateKrakenTrade(trade: any): boolean {
  return !!(
    trade.pair &&
    trade.price &&
    trade.vol &&
    trade.time &&
    parseFloat(trade.vol) > 0 &&
    parseFloat(trade.price) > 0
  );
}

function validateGenericTrade(trade: any): boolean {
  return !!(
    trade.symbol &&
    trade.price &&
    trade.amount &&
    trade.timestamp &&
    trade.id
  );
}

/**
 * Filter trades based on business logic (dust trades, minimum amounts, etc.)
 */
export function filterTradesByBusinessLogic(
  exchangeId: string,
  trades: CCxtTrade[],
  options: {
    minUsdValue?: number;
    excludeDustTrades?: boolean;
    onlyRecentTrades?: boolean;
    maxAgeHours?: number;
  } = {}
): CCxtTrade[] {
  let filteredTrades = trades;

  // Filter dust trades
  if (options.excludeDustTrades) {
    filteredTrades = filteredTrades.filter(trade => {
      const tradeValue = (trade.cost || 0);
      return tradeValue > (options.minUsdValue || 1.0);
    });
  }

  // Filter by trade age
  if (options.onlyRecentTrades && options.maxAgeHours) {
    const maxAge = options.maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    const cutoffTime = Date.now() - maxAge;
    
    filteredTrades = filteredTrades.filter(trade => {
      return (trade.timestamp || 0) > cutoffTime;
    });
  }

  return filteredTrades;
}

/**
 * Debug helper to log trade filtering statistics
 */
export function logFilteringStats(
  exchangeId: string,
  originalCount: number,
  filteredCount: number,
  filterType: string
) {
  const filteredOut = originalCount - filteredCount;
  const percentage = originalCount > 0 ? ((filteredOut / originalCount) * 100).toFixed(1) : '0';
  
  console.log(
    `📊 ${exchangeId} ${filterType} filtering: ${originalCount} → ${filteredCount} trades (${filteredOut} filtered out, ${percentage}%)`
  );
}