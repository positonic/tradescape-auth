import ccxt from 'ccxt';
import tradeAggregator from './aggregation/TradeAggregator';
import { PositionAggregator } from './aggregation/PositionAggregator';
import { Trade } from '@/interfaces/Trade';
import Exchange from './exchange/Exchange';
import { FetchTradesReturnType } from './exchange/types';
import {
  LastSyncTimes,
  UserExchangeRepository,
} from './repositories/UserExchangeRepository';
import { ApiKey } from '@/interfaces/ApiKeys';
import { ExchangeData } from '@/interfaces/ExchangeData';
import { Order } from '@/interfaces/Order';
import { UserPair } from './types';
interface ExchangeConfig {
  exchange: string;
  pairs: string[];
  since?: number;
}

class UserExchange {
  userId: string;
  exchanges: Record<string, Exchange>;
  pairs: Record<string, UserPair[]>;
  apiKeys: ApiKey[];

  private readonly positionAggregator: PositionAggregator;
  private readonly userExchangeRepository: UserExchangeRepository;

  constructor(
    userId: string,
    apiKeys: ApiKey[],
    userPairs: Record<string, UserPair[]>,
    userExchangeRepository: UserExchangeRepository
  ) {
    this.positionAggregator = new PositionAggregator();
    this.userId = userId;
    this.apiKeys = apiKeys;
    this.exchanges = {};
    this.pairs = userPairs;
    this.userExchangeRepository = userExchangeRepository;

    this.exchanges = this.apiKeys.reduce(
      (acc, { exchange, apiKey, apiSecret, walletAddress, password }) => {
        acc[exchange] = new Exchange(
          ccxt,
          apiKey,
          apiSecret,
          exchange,
          walletAddress || '',
          password || ''
        );
        return acc;
      },
      {} as Record<string, Exchange>
    );
  }
  async getBalancesForExchange(exchangeId: string): Promise<ExchangeData> {
    if (!this.exchanges[exchangeId]) {
      throw new Error(`Exchange ${exchangeId} not found on UserExchange`);
    }

    const exchange = this.exchanges[exchangeId];

    return await exchange.getBalances();
  }

  async getBalancesForAllExchanges(): Promise<ExchangeData[]> {
    const balances: ExchangeData[] = [];
    for (const exchange of Object.values(this.exchanges)) {
      try {
        const exchangeBalance = await this.getBalancesForExchange(exchange.id);
        balances.push(exchangeBalance);
      } catch (error) {
        console.error(`Error processing ${exchange.id}:`, error);
      }
    }
    return balances;
  }

  async getLastSyncTimes() {
    return this.userExchangeRepository.getLastSyncTimes(this.userId);
  }

  async updateLastSyncTimes(exchanges: string[]) {
    return this.userExchangeRepository.updateLastSyncTimes(
      this.userId,
      exchanges
    );
  }

  getOrders(trades: Trade[]) {
    if (!trades) throw new Error('trades is required');
    if (trades.length === 0) return [];
    return tradeAggregator(trades);
  }

  // getPositions(orders: Order[]) {
  //   if(!orders) throw new Error("orders is required");
  //   if(orders.length === 0) return [];
  //   return this.positionAggregator.aggregatePositions(orders);
  // }

  // TODO: Get rid of lastSyncTimes, we check for trades of the pair instead
  async getTrades(): Promise<{
    allTrades: Trade[];
    positions: any[];
  }> {
    let allTrades: Trade[] = [];

    // Iterate through each exchange the user has configured
    for (const exchangeName in this.exchanges) {
      const exchange = this.exchanges[exchangeName];
      const pairs = this.pairs[exchangeName];
      // todo: remove this. If we don't have trades for the pair, fetch since 0
      //const since = lastSyncTimes?.[exchangeName];

      if (!exchange || !pairs) continue;
      console.log('tradeSynch > UserExchange - exchangeName is ', exchangeName);
      console.log('tradeSynch > UserExchange - pairs is ', pairs);
      // For each trading pair on the current exchange
      for (const { symbol } of pairs) {
        try {
          const mostRecentTrade =
            await this.userExchangeRepository.getMostRecentTrade(
              this.userId,
              symbol
            );
          const lastTradesSyncTime = mostRecentTrade?.time;

          const since = lastTradesSyncTime ? Number(lastTradesSyncTime) : 0;
          console.log(
            'tradeSynch > UserExchange - fetchSince for symbol ',
            symbol,
            ' is ',
            since
          );
          console.log(
            lastTradesSyncTime
              ? `We have trades for ${symbol}, and the last one was ${lastTradesSyncTime}`
              : `We have not trades for ${symbol}, setting since to ${0}`
          );
          // Fetch trades for the current pair from the exchange
          const exchangeTrades = await exchange.fetchTrades(symbol, since);
          const trades = Object.values(exchangeTrades);
          console.log(
            `tradeSynch > UserExchange - trades.length for ${symbol} since ${since} is `,
            trades.length
          );
          if (exchangeName === 'hyperliquid') {
            console.log('Hyperliquid trades: ', trades[0]);
          }
          console.log('_________________________\n');
          allTrades = allTrades.concat(trades);
        } catch (error) {
          console.error(
            `Error fetching trades from ${exchangeName} for ${symbol}:`,
            error
          );
        }
      }
    }
    console.log(
      'tradeSynch > UserExchange - allTrades.length is ',
      allTrades.length
    );
    // Aggregate individual trades into orders (combines related trades)
    const aggregatedOrders = tradeAggregator(allTrades);
    console.log(`Aggregated into ${aggregatedOrders.length} orders in total`);
    // Further aggregate orders into positions (combines related orders)
    // const positions = this.positionAggregator.aggregate(aggregatedOrders);
    // console.log("positions!", positions);
    // console.log(`Aggregated into ${positions.length} positions in total`);
    const positions: any[] = [];
    return { allTrades, positions };
  }

  async getAndSavePositions(config: ExchangeConfig[]) {
    let allPositions: FetchTradesReturnType[] = [];

    for (const { exchange: exchangeName, pairs } of config) {
      const exchange = this.exchanges[exchangeName];
      if (!exchange) continue;

      for (const pair of pairs) {
        try {
          const positions = await exchange.fetchPositions(pair, exchangeName);
          console.log(
            `${exchangeName} - ${pair}: Built ${positions.length} positions`
          );
          allPositions = allPositions.concat(positions);
        } catch (error) {
          console.error(
            `Error fetching trades from ${exchangeName} for ${pair}:`,
            error
          );
        }
      }
    }

    console.log(`Built ${allPositions.length} allPositions in total`);
    // uncomment if and when the time comes await insertPositionsToNotion(allPositions);

    return allPositions;
  }
  async updateUserPairs(since?: number) {
    let activePairs: Set<string> = new Set();
    for (const exchangeName in this.exchanges) {
      activePairs = await this.updateUserPairsForExchange(exchangeName, since);
    }
    return activePairs;
  }

  async updateUserPairsForExchange(
    exchangeName: string,
    since?: number
  ): Promise<Set<string>> {
    const exchange = this.exchanges[exchangeName];

    const activePairs = await exchange.fetchTradePairs(exchangeName, since);
    await this.userExchangeRepository.updateUserPairs(
      this.userId,
      exchangeName,
      Array.from(activePairs)
    );

    return activePairs;
  }

  async loadUserPairs(): Promise<Record<string, string[]>> {
    this.pairs = await this.userExchangeRepository.findUserPairs(this.userId);
    // Convert UserPair[] to string[] by mapping to the symbol property
    return Object.fromEntries(
      Object.entries(this.pairs).map(([exchange, pairs]) => [
        exchange,
        pairs.map((pair) => pair.symbol),
      ])
    );
  }

  async fetchOpenOrders(exchangeId: string, pair?: string): Promise<Order[]> {
    const exchange = this.exchanges[exchangeId];
    const orders = await exchange.fetchOpenOrders(exchangeId, pair);
    // Ensure type is always a string
    return orders.map((order) => ({
      ...order,
      trades: order.trades.map((trade) => ({
        ...trade,
        type: trade.type || 'unknown',
        exchange: trade.exchange || exchangeId,
      })),
    }));
  }

  async fetchOpenPositions(pairs: string[]): Promise<Position[]> {
    const positions = await this.fetchOpenPositions(pairs);
    return positions;
  }
}

export default UserExchange;
