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
  direction?: string; // From Hyperliquid: "Close Long", "Open Long", etc.
  transactionId?: string; // From Hyperliquid: hash
  info?: {
    dir?: string; // Hyperliquid direction: "Close Long", "Open Long", etc.
    hash?: string; // Hyperliquid transaction hash
    [key: string]: any; // Allow other exchange-specific fields
  };
}
