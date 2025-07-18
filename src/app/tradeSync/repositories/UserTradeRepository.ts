import { PrismaClient, Prisma } from '@prisma/client';
import { Order } from '../interfaces/Order';
import { Trade } from '../interfaces/Trade';
import { DefaultTradeMapper, DefaultOrderMapper } from './mappers/tradeMappers';
import { IOrderMapper, ITradeMapper } from '../interfaces/TradeMappers';

export interface TradeData {
  trades: Trade[];
  orders: Order[];
  positions: any[];
}

export class UserTradeRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tradeMapper: ITradeMapper = new DefaultTradeMapper(),
    private readonly orderMapper: IOrderMapper = new DefaultOrderMapper()
  ) {
    // Remove this line as it overwrites the singleton
    // this.prisma = prisma;
  }

  async findUserTrades(userId: string, since: number): Promise<TradeData> {
    const dbTrades = await this.prisma.userTrade.findMany({
      where: {
        userId,
        time: {
          gte: since,
        },
      },
      orderBy: {
        time: 'desc',
      },
    });

    const trades = dbTrades.map((trade) =>
      this.tradeMapper.mapDbTradeToTrade(trade)
    );

    const dbOrders = await this.prisma.order.findMany({
      where: {
        userId,
        time: {
          gte: since,
        },
      },
      orderBy: {
        time: 'desc',
      },
    });

    const orders = dbOrders.map((order) =>
      this.orderMapper.mapDbOrderToOrder(order)
    );
    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        time: {
          gte: since,
        },
      },
      orderBy: {
        time: 'desc',
      },
    });

    return {
      trades,
      orders,
      positions,
    };
  }

  async getUserOrdersByOrderId(
    orderIds: string[],
    userId: string
  ): Promise<Order[]> {
    const dbOrders = await this.prisma.order.findMany({
      where: {
        id: { in: orderIds.map((id) => Number(id)) },
        userId: userId,
      },
    });

    return dbOrders.map((order) => this.orderMapper.mapDbOrderToOrder(order));
  }

  async saveAll(trades: Trade[], userId: string): Promise<void> {
    if (trades.length === 0) {
      console.log('ℹ️ [UserTradeRepository] No trades to save, skipping');
      return;
    }
    
    const uniqueTrades: Trade[] = await this.filterExistingTrades(trades);
    console.log('uniqueTrades.length is ', uniqueTrades.length);
    
    if (uniqueTrades.length === 0) {
      console.log('ℹ️ [UserTradeRepository] All trades already exist, skipping database save');
      return;
    }
    
    try {
      // Get unique pair symbols from trades
      const uniquePairSymbols = [...new Set(uniqueTrades.map(trade => trade.pair))];
      
      // Look up existing Pairs and create missing ones
      const pairMap = new Map<string, number>();
      
      for (const symbol of uniquePairSymbols) {
        let pairRecord = await this.prisma.pair.findUnique({
          where: { symbol }
        });
        
        if (!pairRecord) {
          // Create new Pair record if it doesn't exist
          pairRecord = await this.prisma.pair.create({
            data: {
              symbol,
              baseCoinId: 1,  // Default base coin
              quoteCoinId: 1, // Default quote coin
            }
          });
          console.log(`📝 [UserTradeRepository] Created new Pair record for ${symbol}`);
        }
        
        pairMap.set(symbol, pairRecord.id);
      }
      
      const tradeData = uniqueTrades.map((trade) => ({
        tradeId: trade.tradeId,
        ordertxid: trade.ordertxid,
        pair: trade.pair,
        pairId: pairMap.get(trade.pair),
        time: trade.time, // Use this instead of date
        type: trade.type || '',
        ordertype: trade.ordertype,
        price: trade.price,
        cost: trade.cost,
        fee: trade.fee,
        vol: trade.vol,
        margin: trade.margin,
        leverage: trade.leverage,
        misc: trade.misc,
        exchange: trade.exchange || '',
        userId: userId,
        closedPnL: trade.closedPnL
          ? new Prisma.Decimal(trade.closedPnL)
          : null,
        direction: trade.direction,
        transactionId: trade.transactionId,
      }));
      
      // Use createMany with skipDuplicates as a fallback for any remaining duplicates
      const result = await this.prisma.userTrade.createMany({
        data: tradeData,
        skipDuplicates: true,
      });
      
      console.log(`✅ [UserTradeRepository] Successfully saved ${result.count} trades to database`);
      
    } catch (error) {
      console.error(`❌ [UserTradeRepository] Failed to save trades:`, error);
      throw error;
    }
  }
  private async filterExistingTrades(trades: Trade[]): Promise<Trade[]> {
    // Check for existing trades by both tradeId and ordertxid to prevent duplicates
    const existingTrades = await this.prisma.userTrade.findMany({
      where: {
        OR: trades.map((trade) => ({
          tradeId: trade.tradeId,
        })),
      },
    });
    
    // Create a Set of existing tradeIds for fast lookup
    const existingTradeIds = new Set(
      existingTrades.map((trade) => trade.tradeId)
    );
    
    console.log(`🔍 [UserTradeRepository] Filtering: ${trades.length} total trades, ${existingTradeIds.size} existing trades`);
    
    const filteredTrades = trades.filter((trade) => !existingTradeIds.has(trade.tradeId));
    
    console.log(`✨ [UserTradeRepository] After filtering: ${filteredTrades.length} unique trades to save`);
    
    return filteredTrades;
  }

  async updateTradeOrderRelations(orders: Order[]) {
    for (const order of orders) {
      await this.prisma.userTrade.updateMany({
        where: {
          ordertxid: order.ordertxid,
        },
        data: {
          orderId: order.id,
        },
      });
    }
  }
}
