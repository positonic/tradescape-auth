import { Trade } from './Trade';
import { Order } from './Order';

export interface ITradeMapper {
  mapDbTradeToTrade(dbTrade: any): Trade;
}

export interface IOrderMapper {
  mapDbOrderToOrder(dbOrder: any): Order;
}