export interface Trade {
  id: string;
  ordertxid: string;
  pair: string;
  time: number;
  type: 'buy' | 'sell' | string | undefined; // Have to allow undefined due to ccxt
  ordertype: string;
  price: string;
  cost: string;
  fee: string;
  vol: number;
  margin: string;
  leverage: string;
  misc: string;
  exchange: string | undefined; // Have to allow undefined due to ccxt
  tradeId: string; //Exhange trade Id
  date?: Date;
  closedPnL: number;
  orderId?: number;
}
