import { PrismaClient, UserTrade } from '@prisma/client';
import { UserPair } from '../types';
export type LastSyncTimes = {
  [exchangeName: string]: number | undefined;
};

export class UserExchangeRepository {
  constructor(private prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getLastSyncTimes(userId: string): Promise<LastSyncTimes> {
    const exchangeUsers = await this.prisma.exchangeUser.findMany({
      where: { userId },
      include: { exchange: true },
    });

    return exchangeUsers.reduce((acc, { exchange, lastTradesSyncTime }) => {
      acc[exchange.name] = lastTradesSyncTime
        ? lastTradesSyncTime.getTime()
        : undefined;
      return acc;
    }, {} as LastSyncTimes);
  }

  async updateLastSyncTimes(
    userId: string,
    exchanges: string[]
  ): Promise<void> {
    const now = new Date();

    // Get existing ExchangeUser records for this user
    const existingRecords = await this.prisma.exchangeUser.findMany({
      where: {
        userId,
        exchange: {
          name: {
            in: exchanges,
          },
        },
      },
      include: { exchange: true },
    });

    // Create a map of existing records by exchange name
    const existingByExchange = existingRecords.reduce((acc, record) => {
      acc[record.exchange.name] = record;
      return acc;
    }, {} as Record<string, (typeof existingRecords)[0]>);

    // For each exchange, update or create the record
    for (const exchangeName of exchanges) {
      if (existingByExchange[exchangeName]) {
        // Update existing record
        await this.prisma.exchangeUser.update({
          where: {
            id: existingByExchange[exchangeName].id,
          },
          data: {
            lastTradesSyncTime: now,
          },
        });
      } else {
        // Create new record
        const exchange = await this.prisma.exchange.findUnique({
          where: { name: exchangeName },
        });

        if (exchange) {
          await this.prisma.exchangeUser.create({
            data: {
              userId,
              exchangeId: exchange.id,
              lastTradesSyncTime: now,
            },
          });
        }
      }
    }
  }

  async findUserPairs(userId: string): Promise<Record<string, UserPair[]>> {
    console.log('findUserPairs called with userId:', userId, 'type:', typeof userId);
    
    if (!userId) {
      console.error('userId is undefined or null in findUserPairs');
      return {};
    }

    const userPairs = await this.prisma.userPair.findMany({
      where: { userId },
      include: { pair: true, exchange: true },
    });
    return userPairs.reduce((acc, { exchange, pair, lastTradesSyncTime }) => {
      if (exchange && pair) {
        const exchangeName = exchange.name;
        const pairSymbol: UserPair = {
          symbol: pair.symbol,
        };

        if (!acc[exchangeName]) {
          acc[exchangeName] = [];
        }

        acc[exchangeName].push(pairSymbol);
      }
      return acc;
    }, {} as Record<string, UserPair[]>);
  }

  async getMostRecentTrade(
    userId: string,
    symbol: string
  ): Promise<UserTrade | null> {
    return this.prisma.userTrade.findFirst({
      where: { userId, pair: symbol },
      orderBy: { time: 'desc' },
    });
  }

  async updateUserPairs(
    userId: string,
    exchangeName: string,
    pairs: string[]
  ): Promise<void> {
    // First, ensure the exchange exists (create if missing)
    const exchange = await this.prisma.exchange.upsert({
      where: { name: exchangeName },
      update: {},
      create: { name: exchangeName },
    });

    console.log(`📊 Using exchange: ${exchange.name} (ID: ${exchange.id})`);
    
    if (pairs.length > 0) {
      console.log(`💱 Processing ${pairs.length} pairs for ${exchangeName}`);
    }

    // For each pair
    let processedCount = 0;
    let newPairsCount = 0;
    
    for (const pairSymbol of pairs) {
      // Find or create the pair
      const pair = await this.prisma.pair.upsert({
        where: { symbol: pairSymbol },
        update: {},
        create: { symbol: pairSymbol },
      });

      // Create or update the userPair association
      const result = await this.prisma.userPair.upsert({
        where: {
          userId_pairId_exchangeId: {
            userId,
            exchangeId: exchange.id,
            pairId: pair.id,
          },
        },
        update: {},
        create: {
          userId,
          exchangeId: exchange.id,
          pairId: pair.id,
        },
      });

      processedCount++;
      
      // Note: UserPair model doesn't have createdAt/updatedAt timestamps
      // We'll count all processed pairs as potentially new for now
      newPairsCount++;
    }

    // Log summary only if we processed pairs
    if (processedCount > 0) {
      console.log(`✅ [${exchangeName}] Processed ${processedCount} pairs (${newPairsCount} new)`);
    }
  }
}
