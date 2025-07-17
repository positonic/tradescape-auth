import {
  Exchange as CCXTExchange,
  //Trade as CCxtLibTrade,
  Position as CCxtPosition,
  Order as CCxtOrder,
  Balances,
} from 'ccxt';
import { Trade } from '../interfaces/Trade';
import { Order } from '../interfaces/Order';
import { ApiKey } from '../interfaces/ApiKeys';
import { CCxtTrade, FetchTradesReturnType } from './types';
import { mapCCxtOrdersToOrders, mapToOrders } from './ orderMapper';
import { createPositionsFromOrders } from './ PositionService';
import { getExchangeFetchConfig } from '../exchange-config';
import { ExchangeData } from '../interfaces/ExchangeData';
import { getExchangeFilterConfig } from './filterConfig';
import { validateRawTrade, filterTradesByBusinessLogic, logFilteringStats } from './tradeValidation';
import { getExchangeCapabilities, supportsBulkFetch, logExchangeCapabilities } from './exchangeCapabilities';

/**
 * Check if a symbol is a futures symbol
 * Fetching trades from binane for symbols like 1000000MOG/USDT:USDT is giving and authenitcation error
 * Perhaps because futures isn't enabled, it's not clear right now.
 * It's also not clear how resilient this approach will prove to be.
 * @param symbol
 * @returns
 */
function isFuturesSymbol(symbol: string): boolean {
  return symbol.includes(':');
}

// TODO: Replace with from database
export type ExchangeName = 'kraken' | 'binance' | 'bybit' | 'hyperliquid';

// Replace this with code that goes to the database
export function isExchangeName(value: string): value is ExchangeName {
  return ['binance', 'kraken', 'bybit', 'hyperliquid'].includes(value);
}

export default class Exchange {
  protected client: CCXTExchange;
  fetchConfig: Record<string, any>;
  id: string;
  
  // Cache for bulk trade fetching
  private cachedTradesBySymbol: Map<string, CCxtTrade[]> | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (increased from 5 minutes)

  constructor(
    ccxtInstance: any, // Accepting ccxt instance or class dynamically
    apiKey: string,
    apiSecret: string,
    exchangeId: string, // exchangeId is 'binance' or 'okx' for example
    walletAddress: string,
    password: string
  ) {
    const exchangeClass = ccxtInstance[exchangeId];
    if (!exchangeClass)
      throw new Error(`Exchange ${exchangeId} is not supported`);
    this.fetchConfig = getExchangeFetchConfig(exchangeId);

    const config: ApiKey = {
      exchange: exchangeId,
      apiKey,
      apiSecret,
      ...(walletAddress && { walletAddress }),
      ...(password && { password }),
    };

    this.client = new exchangeClass({
      apiKey: config.apiKey,
      secret: config.apiSecret,
      ...(config.walletAddress && { walletAddress: config.walletAddress }),
      ...(config.password && { password: config.password }),
    });

    this.id = exchangeId;
    
    // Log exchange capabilities for debugging
    logExchangeCapabilities(this.id);
  }

  /**
   * Clear the trade cache
   */
  private clearTradeCache(): void {
    this.cachedTradesBySymbol = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Check if cache is valid and not expired
   */
  private isCacheValid(): boolean {
    const hasCache = this.cachedTradesBySymbol !== null;
    const timeSinceCache = Date.now() - this.cacheTimestamp;
    const withinDuration = timeSinceCache < this.CACHE_DURATION;
    const isValid = hasCache && withinDuration;
    
    if (!isValid) {
      console.log(`🔍 [${this.id}] Cache validation: hasCache=${hasCache}, age=${Math.round(timeSinceCache/1000)}s, maxAge=${this.CACHE_DURATION/1000}s`);
    }
    
    return isValid;
  }

  /**
   * Fetch all trades at once and group by symbol (for exchanges like Hyperliquid)
   */
  private async fetchAllTradesAndGroupBySymbol(since?: number): Promise<Set<string>> {
    const startTime = Date.now();
    console.log(`🚀 [${this.id}] Starting BULK FETCH optimization (1 API call instead of 500+)`);
    
    try {
      // Single API call to get ALL trades
      const allTrades = await this.client.fetchMyTrades(
        undefined, // No symbol filter - get all trades
        since ? since : undefined,
        undefined // No limit - get all trades
      );

      const fetchTime = Date.now() - startTime;
      
      // Only log if we found trades
      if (allTrades.length > 0) {
        console.log(`📊 [${this.id}] BULK FETCH SUCCESS: ${allTrades.length} trades fetched in ${fetchTime}ms`);
      }

      // Apply filtering to all trades
      const filteredTrades = this.filterTradesByExchange(allTrades, since);
      
      // Group trades by symbol
      const tradesGroupedBySymbol = new Map<string, CCxtTrade[]>();
      const activePairs = new Set<string>();
      const pairTradeCount = new Map<string, number>();
      
      for (const trade of filteredTrades) {
        const symbol = trade.symbol;
        if (symbol) {
          if (!tradesGroupedBySymbol.has(symbol)) {
            tradesGroupedBySymbol.set(symbol, []);
            activePairs.add(symbol);
            pairTradeCount.set(symbol, 0);
          }
          tradesGroupedBySymbol.get(symbol)!.push(trade);
          pairTradeCount.set(symbol, pairTradeCount.get(symbol)! + 1);
        }
      }

      // Cache the grouped trades
      this.cachedTradesBySymbol = tradesGroupedBySymbol;
      this.cacheTimestamp = Date.now();

      // Only log if we found active pairs
      if (activePairs.size > 0) {
        const totalTime = Date.now() - startTime;
        console.log(`✅ [${this.id}] BULK OPTIMIZATION COMPLETE: ${activePairs.size} active pairs found in ${totalTime}ms`);
        console.log(`📈 [${this.id}] Performance: ~${Math.round(500 / (totalTime / 1000))}x faster than per-symbol calls`);
        
        // Show top traded pairs
        const topPairs = Array.from(pairTradeCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        console.log(`💰 [${this.id}] Top traded pairs:`, topPairs.map(([symbol, count]) => `${symbol}(${count})`).join(', '));
        console.log(`🔍 [${this.id}] All cached symbols:`, Array.from(activePairs).slice(0, 20).join(', '));
      }

      return activePairs;
      
    } catch (error) {
      console.error(`❌ [${this.id}] BULK FETCH FAILED:`, error);
      // Clear cache on error
      this.clearTradeCache();
      throw error;
    }
  }

  /**
   * Traditional per-symbol trade fetching (for exchanges like Binance)
   */
  private async fetchTradesPerSymbol(since?: number): Promise<Set<string>> {
    const startTime = Date.now();
    console.log(`🔄 [${this.id}] Starting PER-SYMBOL fetch (traditional method)`);
    
    // Load all markets first
    await this.client.loadMarkets();
    const activePairs = new Set<string>();

    // Get all symbols from the exchange
    const symbols = this.loadSymbols();
    if (!symbols) {
      throw new Error('No symbols found for exchange');
    }

    console.log(`📊 [${this.id}] Checking ${symbols.length} symbols individually`);

    const capabilities = getExchangeCapabilities(this.id);
    let checkedCount = 0;
    let skippedCount = 0;
    
    for (const symbol of symbols) {
      try {
        // Wait for rate limit BEFORE making the API call
        if (capabilities.rateLimit) {
          await new Promise((resolve) =>
            setTimeout(resolve, capabilities.rateLimit)
          );
        }

        if (isFuturesSymbol(symbol)) {
          skippedCount++;
          continue;
        }

        const trades = await this.fetchTradesDirectly(symbol, since);
        checkedCount++;
        
        if (trades && Object.values(trades).length > 0) {
          activePairs.add(symbol);
          console.log(`✅ [${this.id}] FOUND trades for ${symbol} (${Object.values(trades).length} trades)`);
        }
      } catch (error) {
        console.error(`❌ [${this.id}] Error fetching trades for ${symbol}:`, error);
        continue;
      }
    }

    // Only log completion if we found active pairs
    if (activePairs.size > 0) {
      const totalTime = Date.now() - startTime;
      console.log(`✅ [${this.id}] PER-SYMBOL COMPLETE: ${activePairs.size} active pairs found`);
      console.log(`📊 [${this.id}] Stats: ${checkedCount} checked, ${skippedCount} skipped, ${totalTime}ms total`);
      console.log(`📈 [${this.id}] Active pairs: ${Array.from(activePairs).slice(0, 10).join(', ')}${activePairs.size > 10 ? '...' : ''}`);
    }

    return activePairs;
  }

  public loadMarkets() {
    return this.client.loadMarkets();
  }
  public loadSymbols() {
    return this.client.symbols;
  }
  // Trying to move this into UserExchange
  public async getBalances(): Promise<ExchangeData> {
    console.log(`5. Fetching balance for ${this.id}:`);
    console.log(`   - Fetch config:`, this.fetchConfig);

    const fetchedBalances = await this.client.fetchBalance(this.fetchConfig);

    if (!fetchedBalances) {
      throw new Error(`No balance data received for ${this.id}`);
    }

    console.log(`   - Raw balance received for ${this.id}`);
    console.log(
      `   - Raw balance obj! received for ${JSON.stringify(fetchedBalances)}`
    );
    const { balances, totalUsdValue } = await this.calculateUsdValues(
      fetchedBalances
    );
    //console.log('balances!', balances);
    //console.log(`   - Calculated USD value: ${totalUsdValue}`);

    // Transform the raw balance data into our structured format
    const exchangeInfo: ExchangeData = {
      exchange: this.id,
      timestamp: balances.timestamp,
      datetime: balances.datetime,
      positions: [],
      balances: {},
      totalUsdValue,
    };

    // Add margin summary if available
    if (balances.info?.marginSummary) {
      console.log(`   - Found margin summary for ${this.id}`);
      exchangeInfo.marginSummary = {
        accountValue: parseFloat(balances.info.marginSummary.accountValue),
        totalNotionalPosition: parseFloat(
          balances.info.marginSummary.totalNtlPos
        ),
        totalRawUsd: parseFloat(balances.info.marginSummary.totalRawUsd),
        totalMarginUsed: parseFloat(
          balances.info.marginSummary.totalMarginUsed
        ),
      };
    }

    // Add cross margin summary if available
    if (balances.info?.crossMarginSummary) {
      console.log(`   - Found cross margin summary for ${this.id}`);
      exchangeInfo.crossMarginSummary = {
        accountValue: parseFloat(balances.info.crossMarginSummary.accountValue),
        totalNotionalPosition: parseFloat(
          balances.info.crossMarginSummary.totalNtlPos
        ),
        totalRawUsd: parseFloat(balances.info.crossMarginSummary.totalRawUsd),
        totalMarginUsed: parseFloat(
          balances.info.crossMarginSummary.totalMarginUsed
        ),
      };
    }

    // Add cross maintenance margin and withdrawable if available
    if (balances.info?.crossMaintenanceMarginUsed) {
      exchangeInfo.crossMaintenanceMarginUsed = parseFloat(
        balances.info.crossMaintenanceMarginUsed
      );
    }
    if (balances.info?.withdrawable) {
      exchangeInfo.withdrawable = parseFloat(balances.info.withdrawable);
    }

    // Transform positions
    if (balances.info?.assetPositions) {
      console.log(
        `   - Found ${balances.info.assetPositions.length} positions for ${this.id}`
      );
      exchangeInfo.positions = balances.info.assetPositions
        .filter((pos: any) => pos.type === 'oneWay')
        .map((pos: any) => ({
          coin: pos.position.coin,
          size: parseFloat(pos.position.szi),
          leverage: pos.position.leverage,
          entryPrice: parseFloat(pos.position.entryPx),
          positionValue: parseFloat(pos.position.positionValue),
          unrealizedPnl: parseFloat(pos.position.unrealizedPnl),
          returnOnEquity: parseFloat(pos.position.returnOnEquity),
          liquidationPrice: pos.position.liquidationPx
            ? parseFloat(pos.position.liquidationPx)
            : null,
          marginUsed: parseFloat(pos.position.marginUsed),
          maxLeverage: pos.position.maxLeverage,
          cumulativeFunding: pos.position.cumFunding,
        }));
    }

    // Transform token balancess
    const tokenCount = Object.keys(balances.total).length;
    console.log(`   - Processing ${tokenCount} tokens for ${this.id}`);
    Object.entries(balances.total).forEach(([token, total]) => {
      exchangeInfo.balances[token] = {
        total: parseFloat(String(total)),
        free: parseFloat(String((balances.free as any)[token] || 0)),
        used: parseFloat(String((balances.used as any)[token] || 0)),
        usdValue: parseFloat(String((balances.usdValue as any)?.[token] || 0)),
      };
    });

    console.log(`   - Successfully processed ${this.id}`);
    //console.log('exchangeInfo returned', exchangeInfo);
    return exchangeInfo;
  }
  /**
   * Fetch open margin positions
   * @param markets
   * @returns
   */
  async fetchOpenPositions(markets?: string[]): Promise<any> {
    try {
      const positions: CCxtPosition[] = await this.client.fetchPositions(
        markets,
        {}
      );
      console.log('fetchOpenPositions: positions', positions);
      return positions;
    } catch (error) {
      console.warn(`Error fetching trades from ${this.client.name}:`, error);
      return {} as FetchTradesReturnType; // Return an empty Record<string, Trade>
    }
  }

  /**
   *  Fetch open orders
   * @param market for which market? / undefined for all markets
   * @returns
   */
  async fetchOpenOrders(exchange: string, pair?: string): Promise<Order[]> {
    try {
      console.log(pair);
      const orders: CCxtOrder[] = await this.client.fetchOpenOrders(pair);
      console.log('fetchOpenPositions: orders', orders);
      return mapCCxtOrdersToOrders(exchange, orders);
    } catch (error) {
      console.warn(`Error fetching trades from ${this.client.name}:`, error);
      return [] as Order[]; // Return an empty Record<string, Trade>
    }
  }

  /**
   * Fetch orders and create positions from them
   * @param market
   * @param exchangeName
   * @param since
   * @param limit
   * @returns
   */
  async fetchPositions(
    market: string,
    exchangeName: string,
    since: number | undefined = undefined,
    limit: number = 1000
  ): Promise<any> {
    try {
      const orders = await this.fetchOrders(
        market,
        since ? since : undefined,
        limit
      );
      const positions = createPositionsFromOrders(orders, exchangeName);

      return positions;
    } catch (error) {
      console.warn(`Error fetching trades from ${this.client.name}:`, error);
      return {} as FetchTradesReturnType; // Return an empty Record<string, Trade>
    }
  }

  async fetchOrders(
    market: string,
    since: number | undefined = undefined,
    limit: number = 1000
  ): Promise<Order[]> {
    try {
      if (since) console.log('Call fetchTrades since ', new Date(since));
      const rawOrders = await this.client.fetchOrders(
        market,
        since ? since : undefined,
        limit
      );

      /**
       * value Statuses = {
            'NEW': 'open',
            'PARTIALLY_FILLED': 'open',
            'ACCEPTED': 'open',
            'FILLED': 'closed',
            'CANCELED': 'canceled',
            'CANCELLED': 'canceled',
            'PENDING_CANCEL': 'canceling',
            'REJECTED': 'rejected',
            'EXPIRED': 'expired',
            'EXPIRED_IN_MATCH': 'expired',
        };
       */
      //console.log("rawTrades", rawOrders);
      //Only allow closed orders for now
      const orders = mapToOrders(rawOrders).filter(
        (order) => order.status === 'closed'
      );
      return orders;
    } catch (error) {
      console.warn(`Error fetching trades from ${this.client.name}:`, error);
      const orders: Order[] = [];
      return orders;
    }
  }
  /**
   * Filter trades based on exchange-specific criteria
   */
  private filterTradesByExchange(trades: CCxtTrade[], since?: number): CCxtTrade[] {
    let filteredTrades = trades;
    const originalCount = trades.length;

    // Step 1: Apply time-based filtering if 'since' is provided
    if (since !== undefined) {
      filteredTrades = filteredTrades.filter(trade => {
        const tradeTime = Number(trade.timestamp);
        return tradeTime > since;
      });
      logFilteringStats(this.id, originalCount, filteredTrades.length, 'time-based');
    }

    // Step 2: Validate raw trade data structure
    const validatedTrades = filteredTrades.filter(trade => {
      return validateRawTrade(this.id, trade.info || trade);
    });
    if (validatedTrades.length !== filteredTrades.length) {
      logFilteringStats(this.id, filteredTrades.length, validatedTrades.length, 'validation');
    }
    filteredTrades = validatedTrades;

    // Step 3: Apply exchange-specific configuration filters
    const filterConfig = getExchangeFilterConfig(this.id);
    const configFilteredTrades = filteredTrades.filter(trade => {
      // Check minimum trade amount
      if (trade.amount < filterConfig.minTradeAmount) {
        return false;
      }

      // Check required timestamp
      if (filterConfig.requireTimestamp && !trade.timestamp) {
        return false;
      }

      // Check required trade ID
      if (filterConfig.requireTradeId && !trade.id) {
        return false;
      }

      // Apply custom filter if provided
      if (filterConfig.customFilter && !filterConfig.customFilter(trade.info || trade)) {
        return false;
      }

      return true;
    });

    if (configFilteredTrades.length !== filteredTrades.length) {
      logFilteringStats(this.id, filteredTrades.length, configFilteredTrades.length, 'config-based');
    }
    filteredTrades = configFilteredTrades;

    // Step 4: Apply business logic filtering (dust trades, etc.)
    const businessFilteredTrades = filterTradesByBusinessLogic(this.id, filteredTrades, {
      excludeDustTrades: true,
      minUsdValue: 0.10, // Filter out trades worth less than $0.10
      onlyRecentTrades: false, // Don't filter by age during sync
    });

    if (businessFilteredTrades.length !== filteredTrades.length) {
      logFilteringStats(this.id, filteredTrades.length, businessFilteredTrades.length, 'business-logic');
    }

    // Final summary - only log if significant filtering occurred
    const filteredCount = originalCount - businessFilteredTrades.length;
    if (filteredCount > 0) {
      const percentage = ((filteredCount / originalCount) * 100).toFixed(1);
      console.log(`🔍 [${this.id}] FILTERING: ${originalCount} → ${businessFilteredTrades.length} trades (${percentage}% filtered)`);
    }

    return businessFilteredTrades;
  }

  async fetchTrades(
    market: string | undefined,
    since: number | undefined = undefined
    //  limit: number = 1000
  ): Promise<FetchTradesReturnType> {
    // Debug logging for cache state
    if (supportsBulkFetch(this.id)) {
      const cacheStats = this.getCacheStats();
      console.log(`🔍 [${this.id}] Cache check for ${market}: valid=${cacheStats.isValid}, symbols=${cacheStats.symbolCount}, trades=${cacheStats.totalTrades}, age=${cacheStats.ageMinutes}min`);
    }
    
    // Check if we can use cached data from bulk fetch
    if (supportsBulkFetch(this.id) && this.isCacheValid() && market) {
      const result = await this.processTradesFromCache(market, since);
      // Only log if we found trades in cache
      if (Object.keys(result).length > 0) {
        console.log(`🎯 [${this.id}] CACHE HIT: ${Object.keys(result).length} trades for ${market} (instant)`);
      } else {
        console.log(`🔍 [${this.id}] CACHE MISS: No trades found for ${market} in cache`);
      }
      return result;
    }
    
    // For bulk fetch exchanges, if cache is invalid but we need trades, repopulate cache
    if (supportsBulkFetch(this.id) && !this.isCacheValid() && market) {
      console.log(`🔄 [${this.id}] Cache invalid for bulk fetch exchange, repopulating...`);
      try {
        await this.fetchAllTradesAndGroupBySymbol(since);
        // Try cache again after repopulation
        if (this.isCacheValid()) {
          const result = await this.processTradesFromCache(market, since);
          if (Object.keys(result).length > 0) {
            console.log(`🎯 [${this.id}] CACHE REPOPULATED: ${Object.keys(result).length} trades for ${market}`);
          } else {
            console.log(`⚠️ [${this.id}] CACHE REPOPULATED but no trades found for ${market}`);
            console.log(`🔍 [${this.id}] Available symbols after repopulation:`, Array.from(this.cachedTradesBySymbol?.keys() || []).slice(0, 10));
          }
          return result;
        } else {
          console.error(`❌ [${this.id}] Cache still invalid after repopulation`);
        }
      } catch (error) {
        console.error(`❌ [${this.id}] Cache repopulation failed:`, error);
      }
    }
    
    // Fall back to direct API call
    console.log(`🌐 [${this.id}] Falling back to direct API call for ${market}`);
    return await this.fetchTradesDirectly(market, since);
  }

  /**
   * Process trades from cache (for bulk fetch exchanges)
   */
  private async processTradesFromCache(
    market: string,
    since?: number
  ): Promise<FetchTradesReturnType> {
    if (!this.cachedTradesBySymbol) {
      throw new Error('Cache is not available');
    }

    const cachedTrades = this.cachedTradesBySymbol.get(market) || [];
    console.log(`📊 [${this.id}] Cache lookup for '${market}': ${cachedTrades.length} trades found`);
    
    if (cachedTrades.length === 0) {
      const availableSymbols = Array.from(this.cachedTradesBySymbol.keys());
      console.log(`🔍 [${this.id}] Available symbols in cache (${availableSymbols.length}):`, availableSymbols.slice(0, 10));
      
      // Check for partial matches
      const partialMatches = availableSymbols.filter(symbol => 
        symbol.includes(market) || market.includes(symbol.split('/')[0]) || market.includes(symbol.split(':')[0])
      );
      if (partialMatches.length > 0) {
        console.log(`🔍 [${this.id}] Potential symbol matches for '${market}':`, partialMatches);
      }
    }

    // Apply additional time filtering if needed (cache might have broader time range)
    let filteredTrades = cachedTrades;
    if (since !== undefined) {
      filteredTrades = cachedTrades.filter(trade => {
        const tradeTime = Number(trade.timestamp);
        return tradeTime > since;
      });
      // Only log if time filtering made a difference
      if (filteredTrades.length !== cachedTrades.length) {
        console.log(`⏰ [${this.id}] Time filtered ${cachedTrades.length} → ${filteredTrades.length} trades for ${market}`);
      }
    }

    return this.convertTradesToReturnFormat(filteredTrades);
  }

  /**
   * Direct API call to fetch trades (for traditional exchanges or cache miss)
   */
  private async fetchTradesDirectly(
    market: string | undefined,
    since: number | undefined = undefined
  ): Promise<FetchTradesReturnType> {
    try {
      const rawTrades = await this.client.fetchMyTrades(
        market,
        since ? since : undefined,
        undefined
      );

      // Only log if we found trades
      if (rawTrades.length > 0) {
        console.log(`🌐 [${this.id}] DIRECT API: ${rawTrades.length} trades for ${market || 'all'}`);
        
        if (this.id === 'hyperliquid' && rawTrades.length > 0) {
          console.log(`🔍 [${this.id}] Sample trade:`, rawTrades[0]);
        }
      }
      
      // Apply comprehensive filtering (time-based + exchange-specific)
      const filteredTrades = this.filterTradesByExchange(rawTrades, since);

      return this.convertTradesToReturnFormat(filteredTrades);
      
    } catch (error) {
      console.warn(`❌ [${this.id}] Direct API error for ${market}:`, error);
      return {} as FetchTradesReturnType;
    }
  }

  /**
   * Convert CCxtTrade[] to FetchTradesReturnType format
   */
  private convertTradesToReturnFormat(trades: CCxtTrade[]): FetchTradesReturnType {
    const sortedTrades = trades.sort(
      (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
    );
    
    const Trades = sortedTrades.map(
      (ccxtTrade: CCxtTrade): [string, Trade] => {
        const trade: Trade = {
          id: ccxtTrade.id?.toString() ?? '',
          tradeId: ccxtTrade.id?.toString() ?? '',
          ordertxid: ccxtTrade.order?.toString() ?? '',
          pair: ccxtTrade.symbol ?? '',
          time: Number(ccxtTrade.timestamp),
          type: ccxtTrade.side,
          ordertype: String(ccxtTrade.type),
          price: ccxtTrade.price.toString(),
          cost: (ccxtTrade.cost ?? 0).toString(),
          fee: ccxtTrade.fee?.cost?.toString() ?? '0',
          vol: Number(ccxtTrade.amount),
          margin: ccxtTrade.margin ?? '',
          leverage: ccxtTrade.leverage ?? '',
          misc: ccxtTrade.misc ?? '',
          exchange: this.client.name?.toString() ?? '',
          date: new Date(Number(ccxtTrade.timestamp)),
          closedPnL: Number(ccxtTrade.info.closedPnl) ?? 0,
        };
        
        if (this.id === 'hyperliquid') {
          // console.log('log> ccxtTrade.info.closedPnL is ', ccxtTrade.info.closedPnl);
          // console.log('log> Number(ccxtTrade.info.closedPnL) ?? 0 ', Number(ccxtTrade.info.closedPnL) ?? 0);
          // console.log('log> trade.closedPnL is ', trade.closedPnL);
          // console.log('log> ccxtTrade.info is ', ccxtTrade.info);
        }

        return [trade.tradeId, trade];
      }
    );
    
    return Object.fromEntries(Trades);
  }

  /**
   * Clear the trade cache (useful for testing or when cache becomes stale)
   */
  public clearCache(): void {
    console.log(`🧹 Clearing trade cache for ${this.id}`);
    this.clearTradeCache();
  }

  /**
   * Get cache statistics for debugging
   */
  public getCacheStats(): {
    isValid: boolean;
    symbolCount: number;
    totalTrades: number;
    ageMinutes: number;
  } {
    const isValid = this.isCacheValid();
    const symbolCount = this.cachedTradesBySymbol?.size || 0;
    const totalTrades = this.cachedTradesBySymbol 
      ? Array.from(this.cachedTradesBySymbol.values()).reduce((sum, trades) => sum + trades.length, 0)
      : 0;
    const ageMinutes = this.cacheTimestamp ? (Date.now() - this.cacheTimestamp) / (1000 * 60) : 0;

    return {
      isValid,
      symbolCount,
      totalTrades,
      ageMinutes: Math.round(ageMinutes * 10) / 10,
    };
  }

  async fetchTradePairs(
    exchangeName: string,
    since?: number
  ): Promise<Set<string>> {
    // Check exchange capabilities and use appropriate strategy
    if (supportsBulkFetch(this.id)) {
      console.log(`📦 [${this.id}] Using BULK FETCH strategy (performance optimization)`);
      return await this.fetchAllTradesAndGroupBySymbol(since);
    } else {
      console.log(`🔁 [${this.id}] Using PER-SYMBOL fetch strategy (traditional)`);
      return await this.fetchTradesPerSymbol(since);
    }
  }
  async fetchAllTrades(
    market: string,
    since: number | undefined
  ): Promise<FetchTradesReturnType> {
    const allTrades: FetchTradesReturnType = {};
    // let since: number | undefined = undefined;
    const limit: number = 100; // Adjust as needed

    let hasMoreTrades = true;
    while (hasMoreTrades) {
      const sinceDate = since ? since * 1000 : undefined;
      console.log('Calling fetchAllTrades', { market, sinceDate, limit });
      const trades = await this.fetchTrades(market, since);
      console.log('Called fetchAllTrades', { trades, since, limit });
      Object.keys(trades).length;
      if (Object.keys(trades).length === 0) {
        hasMoreTrades = false;
        break;
      }
      for (const trade of Object.values(trades)) {
        // Assuming each trade has a unique ID and can be normalized to the Trade structure
        allTrades[trade.tradeId] = trade;
      }
      const lastTrade: Trade | undefined =
        Object.values(trades)[Object.values(trades).length - 1];
      since = lastTrade ? lastTrade.time + 1 : undefined;
    }
    console.log('allTrades', allTrades);
    return allTrades;
  }

  async fetchAllMarketsTrades(
    limit: number = 50
  ): Promise<FetchTradesReturnType> {
    try {
      // Fetch all available markets for the exchange
      const markets = await this.client.loadMarkets();
      const marketSymbols = Object.keys(markets);

      const allTradesPromises = marketSymbols.map((market) =>
        this.fetchTrades(market, undefined)
      );

      console.log('allTradesPromises.length', allTradesPromises.length);
      const allTradesResults = await Promise.all(allTradesPromises);

      // Combine all trades into one structure or handle them as you see fit
      const combinedTrades: FetchTradesReturnType = {}; // Update the type to Record<string, FetchTradesReturnType>

      allTradesResults.forEach((trades) => {
        for (const [id, trade] of Object.entries(trades)) {
          combinedTrades[id] = trade; // Flatten the structure by directly assigning trades
        }
      });

      return combinedTrades;
    } catch (error) {
      console.error(
        `Error fetching all trades from ${this.client.name}:`,
        error
      );
      return {};
    }
  }
  async calculateUsdValues(balances: Balances): Promise<{
    totalUsdValue: number;
    balances: Balances;
  }> {
    const markets = await this.client.loadMarkets();
    let totalUsdValue = 0;

    if (!balances.usdValue) {
      balances.usdValue = {
        free: undefined,
        used: undefined,
        total: undefined,
      };
    }

    for (const [currency, totalAmount] of Object.entries(balances.total)) {
      console.log(`currency1 is ${currency}`);
      console.log(`totalAmount is ${totalAmount}`);
      //console.log(`balances now is ${JSON.stringify(balances)}`);
      if (currency === 'USD' || currency === 'USDT' || currency === 'USDC') {
        if (balances.usdValue) {
          balances.usdValue.total = totalAmount;
          (balances.usdValue as any)[currency] = totalAmount;
          totalUsdValue += totalAmount;
          console.log(`balances.usdValue.total is ${balances.usdValue.total}`);
        }
        continue;
      }

      if (totalAmount <= 0) continue;

      const usdMarketSymbol = `${currency}/USD`;
      const usdtMarketSymbol = `${currency}/USDT`;

      const usdMarketExists = usdMarketSymbol in markets;
      const usdtMarketExists = usdtMarketSymbol in markets;

      //console.log("markets are:", markets);
      const marketExists = usdMarketExists
        ? usdMarketExists
        : usdtMarketExists
        ? usdtMarketExists
        : false;
      const marketSymbol = usdMarketExists
        ? usdMarketSymbol
        : usdtMarketExists
        ? usdtMarketSymbol
        : '';
      //if (marketSymbol !== "BEAM/USDT") continue;
      // console.log("marketSymbol", marketSymbol);
      // console.log(`Market exists: ${marketExists}`);
      // console.log(`Market usdtMarketExists exists: ${usdtMarketExists}`);

      if (marketExists) {
        try {
          const ticker = await this.client.fetchTicker(marketSymbol);
          if (ticker.last !== undefined) {
            const currencyValue = totalAmount * ticker.last; // Calculate USD value
            if (currencyValue > 3 && balances.usdValue) {
              balances.usdValue.total = currencyValue; // Assign USD value
              totalUsdValue += currencyValue; // Add to total
            }
          }
        } catch (error) {
          console.error(`Error fetching ticker for ${marketSymbol}:`, error);
        }
      }
    }

    return { balances, totalUsdValue }; // Return the modified balance and total USD value
  }
}
export function aggregateTrades(trades: Trade[]): Order[] {
  const ordersMap: { [ordertxid: string]: Order } = {};

  trades.forEach((trade) => {
    const price = parseFloat(trade.price);
    const vol = trade.vol;

    if (!ordersMap[trade.ordertxid]) {
      // Initialize a new order with the current trade
      ordersMap[trade.ordertxid] = {
        fee: Number(trade.fee),
        ordertxid: trade.ordertxid,
        time: trade.time,
        date: new Date(trade.time),
        type: trade.type as 'buy' | 'sell',
        pair: trade.pair,
        amount: vol,
        highestPrice: price,
        lowestPrice: price,
        averagePrice: price,
        totalCost: price * vol,
        exchange: trade.exchange || 'unknown',
        trades: [trade],
        closedPnL: trade.closedPnL || 0,
      };
    } else {
      // Update existing order
      const order = ordersMap[trade.ordertxid];
      order.trades.push(trade);
      order.amount += vol;
      order.highestPrice = Math.max(order.highestPrice, price);
      order.lowestPrice = Math.min(order.lowestPrice, price);
      order.totalCost += price * vol;
      order.averagePrice = order.totalCost / order.amount;
      order.fee = Number(trade.fee) + order.fee;
      order.closedPnL = (order.closedPnL || 0) + (trade.closedPnL || 0);
    }
  });

  // Return the aggregated orders, removing the totalCost from the final objects
  return Object.values(ordersMap).map((order) => {
    const { totalCost, ...rest } = order;
    return { totalCost, ...rest };
  });
}
