import { Trade } from '../interfaces/Trade';
import { Order } from '../interfaces/Order';
import { Trade as CCxtLibTrade } from 'ccxt';
export type FetchTradesReturnType = Record<string, Trade>;
export type FetchOrdersReturnType = Record<string, Order>;

export interface Position {
  time: number;
  date: Date;
  type: 'long' | 'short';
  buyCost: number;
  sellCost: number;
  profitLoss: number;
  orders: Order[];
  pair: string;
  exchange: string | undefined;
  price: number;
  quantity: number;
  duration: number;
  lastTime?: number;
}

export type ExchangeName = 'kraken' | 'binance' | 'bybit';

export interface CCxtTrade extends CCxtLibTrade {
  margin?: string;
  leverage?: string;
  misc?: string;
}
