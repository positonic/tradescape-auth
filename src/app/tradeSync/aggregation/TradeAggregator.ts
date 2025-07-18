import { Order } from '../interfaces/Order';
import { Trade } from '../interfaces/Trade';

export default function tradeAggregator(trades: Trade[]): Order[] {
  const ordersMap: { [ordertxid: string]: Order } = {};

  trades.forEach((trade) => {
    const price = parseFloat(trade.price);
    const vol = trade.vol;

    //console.log('log> trade.closedPnL is ', trade.closedPnL);
    if (!ordersMap[trade.ordertxid]) {
      // Initialize a new order with the current trade
      ordersMap[trade.ordertxid] = {
        fee: Number(trade.fee),
        ordertxid: trade.ordertxid,
        time: trade.time,
        date: new Date(trade.time),
        type: trade.type as 'buy' | 'sell',
        direction: trade.direction, // Use direction from trade
        pair: trade.pair,
        amount: vol,
        highestPrice: price,
        lowestPrice: price,
        averagePrice: price,
        totalCost: price * vol, // Initialize total cost for average price calculation
        exchange: trade.exchange || 'unknown',
        trades: [trade], // Initialize with the current trade
        closedPnL: trade.closedPnL, // Initialize closedPnL with the first trade
      };
    } else {
      // Update existing order
      const order = ordersMap[trade.ordertxid];
      if (order) {
        order.trades.push(trade); // Add the current trade to the trades array
        order.amount += vol;
        order.highestPrice = Math.max(order.highestPrice, price);
        order.lowestPrice = Math.min(order.lowestPrice, price);

        // Update total cost and recalculate average price
        order.totalCost += price * vol;
        order.averagePrice = order.totalCost / order.amount;
        order.fee = Number(trade.fee) + order.fee;
        order.closedPnL += trade.closedPnL; // Add the closedPnL from each additional trade
      }
    }
  });

  // Return the aggregated orders, removing the totalCost from the final objects
  return Object.values(ordersMap).map((order) => {
    const { totalCost, ...rest } = order;
    return { totalCost, ...rest };
  });
}
