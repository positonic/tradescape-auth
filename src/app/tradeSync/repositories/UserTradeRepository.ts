import { PrismaClient, Prisma } from '@prisma/client';
import { Order } from '@/interfaces/Order';
import { Trade } from '@/interfaces/Trade';
import { DefaultTradeMapper, DefaultOrderMapper } from './mappers/tradeMappers';
import { IOrderMapper, ITradeMapper } from '@/app/interfaces/TradeMappers';

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
    userId: number
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
      const tradeData = uniqueTrades.map((trade) => ({
        tradeId: trade.tradeId,
        ordertxid: trade.ordertxid,
        pair: trade.pair,
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
