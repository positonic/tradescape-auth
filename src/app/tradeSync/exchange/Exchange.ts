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
  async fetchTrades(
    market: string | undefined,
    since: number | undefined = undefined
    //  limit: number = 1000
  ): Promise<FetchTradesReturnType> {
    try {
      console.log(
        'Exchange class > fetchTrades! -- market is ',
        market,
        since,
        new Date(since ?? 0),
        { defaultType: ['swap', 'option', 'spot', 'futures'] }
      );
      const rawTrades = await this.client.fetchMyTrades(
        market,
        since ? since : undefined,
        undefined
      );

      console.log(
        'In exchange/Exchange > fetchTrades -- rawTrades.length is ',
        rawTrades.length
      );
      if (this.id === 'hyperliquid') {
        console.log('Hyperliquid raw trades: ', rawTrades[0]);
      }
      const sortedTrades = rawTrades.sort(
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
            console.log(
              'log> ccxtTrade.info.closedPnL is ',
              ccxtTrade.info.closedPnl
            );
            console.log(
              'log> Number(ccxtTrade.info.closedPnL) ?? 0 ',
              Number(ccxtTrade.info.closedPnL) ?? 0
            );
            console.log('log> trade.closedPnL is ', trade.closedPnL);

            console.log('log> ccxtTrade.info is ', ccxtTrade.info);
          }

          return [trade.tradeId, trade];
        }
      );
      return Object.fromEntries(Trades);
    } catch (error) {
      console.warn(`Error fetching trades from ${this.client.name}:`, error);
      return {} as FetchTradesReturnType; // Return an empty Record<string, Trade>
    }
  }
  async fetchTradePairs(
    exchangeName: string,
    since?: number
  ): Promise<Set<string>> {
    // const exchange = this.exchanges[exchangeName];
    // if (!exchange) throw new Error(`Exchange ${exchangeName} not found`);

    // Load all markets first
    await this.client.loadMarkets();
    const activePairs = new Set<string>();

    // Get all symbols from the exchange
    const symbols = this.loadSymbols();
    // works const symbols = ['BTC/USDT', 'ETH/USDT', 'XRP/USDT'];
    if (!symbols) {
      throw new Error('No symbols found for exchange');
    }
    console.log('debug: fetchTradePairs: symbols is ', symbols);
    for (const symbol of symbols) {
      try {
        // Wait for rate limit BEFORE making the API call
        if (this.client.rateLimit) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.client.rateLimit)
          );
        }
        console.log(
          `debug: fetchTradePairs: seeking trades for ${symbol} on ${exchangeName}`
        );

        if (isFuturesSymbol(symbol)) {
          console.log(
            `debug: fetchTradePairs: skipping ${symbol} on ${exchangeName} since=${since}`
          );
          continue;
        }
        const trades = await this.fetchTrades(symbol, since);
        //changing below for linting, will it break?
        if (trades && Object.values(trades).length > 0) {
          activePairs.add(symbol);
          console.log(
            '\x1b[32m%s\x1b[0m',
            `Found trades for ${symbol} on ${exchangeName}`
          );
        }
      } catch (error) {
        console.error(`Error fetching trades for ${symbol}:`, error);
        continue;
      }
    }

    return activePairs;
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
