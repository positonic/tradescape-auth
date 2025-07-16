import { Trade } from './Trade';

export interface Order {
  id?: number; //Optional as the database will generate this
  ordertxid?: string;
  time: number; // The time the trade position was opened
  date: Date;
  type: 'buy' | 'sell';
  pair: string;
  amount: number;
  highestPrice: number;
  lowestPrice: number;
  averagePrice: number;
  exchange: string; // Required exchange identifier
  trades: Trade[]; // Add an array of trades
  orderId?: string;
  status?: string;
  totalCost: number;
  fee: number;
  closedPnL: number;

  positionId?: number | null;
}
