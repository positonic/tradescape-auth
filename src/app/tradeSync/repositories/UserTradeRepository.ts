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

  async findUserTrades(userId: number, since: number): Promise<TradeData> {
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

  async saveAll(trades: Trade[], userId: number): Promise<void> {
    const uniqueTrades: Trade[] = await this.filterExistingTrades(trades);
    //console.log('uniqueTrade is ', uniqueTrades[0]);
    console.log('uniqueTrades.length is ', uniqueTrades.length);
    const tradeCreations = uniqueTrades.map((trade) =>
      this.prisma.userTrade.create({
        data: {
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
        },
      })
    );
    await this.prisma.$transaction(tradeCreations);
  }
  private async filterExistingTrades(trades: Trade[]): Promise<Trade[]> {
    const existingTrades = await this.prisma.userTrade.findMany({
      where: {
        OR: trades.map((trade) => ({
          ordertxid: trade.ordertxid,
        })),
      },
    });
    const existingTradeIds = new Set(
      existingTrades.map((trade) => trade.ordertxid)
    );
    return trades.filter((trade) => !existingTradeIds.has(trade.ordertxid));
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
