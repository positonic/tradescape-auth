import Exchange from '../exchange/Exchange';
import { Trade } from '../interfaces/Trade';

export class TradeService {
  /**
   * Fetch all historical trades for discovered pairs
   */
  async fetchAllTrades(
    exchanges: Record<string, Exchange>,
    pairs: Map<string, string[]>
  ): Promise<Trade[]> {
    const allTrades: Trade[] = [];
    
    for (const [exchangeName, exchange] of Object.entries(exchanges)) {
      const exchangePairs = pairs.get(exchangeName) || [];
      
      for (const pair of exchangePairs) {
        try {
          const trades = await exchange.fetchTrades(pair);
          allTrades.push(...Object.values(trades));
        } catch (error) {
          console.error(`Error fetching trades for ${pair} on ${exchangeName}:`, error);
        }
      }
    }
    
    return allTrades;
  }

  /**
   * Fetch recent trades for known pairs
   */
  async fetchRecentTrades(
    exchanges: Record<string, Exchange>,
    pairs: Map<string, string[]>,
    since?: number
  ): Promise<Trade[]> {
    const recentTrades: Trade[] = [];
    
    for (const [exchangeName, exchange] of Object.entries(exchanges)) {
      const exchangePairs = pairs.get(exchangeName) || [];
      
      for (const pair of exchangePairs) {
        try {
          const trades = await exchange.fetchTrades(pair, since);
          recentTrades.push(...Object.values(trades));
        } catch (error) {
          console.error(`Error fetching recent trades for ${pair} on ${exchangeName}:`, error);
        }
      }
    }
    
    return recentTrades;
  }

  /**
   * Lightweight check if a symbol has any trade activity
   */
  async hasTradeActivity(
    exchange: Exchange,
    symbol: string,
    since?: number
  ): Promise<boolean> {
    try {
      const trades = await exchange.fetchTrades(symbol, since);
      return Object.keys(trades).length > 0;
    } catch (error) {
      console.warn(`Error checking trade activity for ${symbol}:`, error);
      return false;
    }
  }
}