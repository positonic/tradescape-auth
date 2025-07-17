import { UserExchangeRepository } from '../repositories/UserExchangeRepository';
import Exchange from '../exchange/Exchange';

export class PairDiscoveryService {
  private userExchangeRepository: UserExchangeRepository;

  constructor(userExchangeRepository: UserExchangeRepository) {
    this.userExchangeRepository = userExchangeRepository;
  }

  /**
   * Comprehensive pair discovery for new users
   * Checks ALL symbols on ALL exchanges
   */
  async discoverAllPairs(
    userId: string,
    exchanges: Record<string, Exchange>
  ): Promise<Map<string, string[]>> {
    const allPairs = new Map<string, string[]>();
    
    for (const [exchangeName, exchange] of Object.entries(exchanges)) {
      console.log(`🔍 Discovering pairs for ${exchangeName}...`);
      
      const activePairs = await exchange.fetchTradePairs(exchangeName);
      allPairs.set(exchangeName, Array.from(activePairs));
      
      // Store discovered pairs in database
      await this.userExchangeRepository.updateUserPairs(
        userId,
        exchangeName,
        Array.from(activePairs)
      );
      
      console.log(`✅ Found ${activePairs.size} active pairs for ${exchangeName}`);
    }
    
    return allPairs;
  }

  /**
   * Incremental pair discovery for existing users
   * Still checks ALL symbols but builds on existing data
   */
  async checkForNewPairs(
    userId: string,
    exchanges: Record<string, Exchange>,
    since?: number
  ): Promise<Map<string, string[]>> {
    const newPairs = new Map<string, string[]>();
    
    for (const [exchangeName, exchange] of Object.entries(exchanges)) {
      console.log(`🔍 Checking for new pairs on ${exchangeName}...`);
      
      // Get existing pairs from database
      const existingPairs = await this.userExchangeRepository.findUserPairs(userId);
      const existingPairsForExchange = existingPairs[exchangeName]?.map(p => p.symbol) || [];
      
      // Check ALL symbols (requirement: must find all user trades)
      // This is still comprehensive but builds on existing data
      const allActivePairs = await exchange.fetchTradePairs(exchangeName, since);
      
      // Identify truly new pairs
      const newPairsForExchange = Array.from(allActivePairs).filter(
        pair => !existingPairsForExchange.includes(pair)
      );
      
      if (newPairsForExchange.length > 0) {
        console.log(`✅ Found ${newPairsForExchange.length} new pairs for ${exchangeName}`);
        newPairs.set(exchangeName, newPairsForExchange);
        
        // Update database with new pairs
        await this.userExchangeRepository.updateUserPairs(
          userId,
          exchangeName,
          Array.from(allActivePairs) // Store all active pairs
        );
      } else {
        console.log(`ℹ️ No new pairs found for ${exchangeName}`);
        newPairs.set(exchangeName, []);
      }
    }
    
    return newPairs;
  }

  /**
   * Batch check symbols for trade activity
   * Optimized for rate limiting and parallel processing
   */
  async batchCheckSymbols(
    exchange: Exchange,
    symbols: string[],
    batchSize: number = 10
  ): Promise<string[]> {
    const activePairs: string[] = [];
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        try {
          const trades = await exchange.fetchTrades(symbol, undefined);
          return Object.keys(trades).length > 0 ? symbol : null;
        } catch (error) {
          console.warn(`Error checking ${symbol}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      activePairs.push(...results.filter(Boolean) as string[]);
      
      // Rate limiting delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return activePairs;
  }
}