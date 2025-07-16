import { ITradeMapper, IOrderMapper } from '@/app/interfaces/TradeMappers';
import { Trade } from '@/interfaces/Trade';
import { Order } from '@/interfaces/Order';

export class DefaultTradeMapper implements ITradeMapper {
  mapDbTradeToTrade(dbTrade: any): Trade {
    return {
      ...dbTrade,
      id: dbTrade.id.toString(),
      time: Number(dbTrade.time),
      exchange: dbTrade.exchange || 'unknown',
      cost: dbTrade.cost.toString(),
      totalCost: Number(dbTrade.cost),
      closedPnL: dbTrade.closedPnL ? Number(dbTrade.closedPnL) : 0,
    };
  }
}

export class DefaultOrderMapper implements IOrderMapper {
  mapDbOrderToOrder(dbOrder: any): Order {
    return {
      ...dbOrder,
      time: Number(dbOrder.time),
      date: new Date(Number(dbOrder.time)),
      trades: [], // Initialize empty trades array
      type: dbOrder.type.toLowerCase() as 'buy' | 'sell',
      amount: Number(dbOrder.amount),
      highestPrice: Number(dbOrder.highestPrice),
      lowestPrice: Number(dbOrder.lowestPrice),
      averagePrice: Number(dbOrder.averagePrice),
      totalCost: Number(dbOrder.totalCost),
      fee: Number(dbOrder.fee),
    };
  }
}
