import { Order } from '@/interfaces/Order';
import { Order as CCxtOrder } from 'ccxt';

// TODO: 2nd version below copied from ./Exchange before deleting looks better?
// export function mapToOrders(data: any[]): Order[] {
//   return data.map((order: any) => ({
//     orderId: order.id,
//     id: order.id,
//     totalCost: order.totalCost,
//     fee: order.fee,
//     time: order.timestamp,
//     date: new Date(order.datetime),
//     type: order.side === 'sell' ? 'sell' : 'buy',
//     pair: order.symbol,
//     highestPrice: parseFloat(order.price),
//     lowestPrice: parseFloat(order.price),
//     averagePrice: parseFloat(order.average),
//     exchange: order.symbol.split('/')[1],
//     amount: parseFloat(order.amount),
//     trades: [],
//     status: order.status,
//   }));
// }
export function mapToOrders(data: any) {
  const Orders: Order[] = [];
  console.log('mapToOrders - data is ', data[0].symbol.split('/')[1]);
  data.forEach((order: any) => {
    const Order: Order = {
      orderId: order.id,
      id: order.id,
      totalCost: order.totalCost,
      fee: order.fee,
      time: order.timestamp,
      date: new Date(order.datetime),
      type: order.side === 'sell' ? 'sell' : 'buy',
      pair: order.symbol,
      highestPrice: parseFloat(order.price),
      lowestPrice: parseFloat(order.price),
      averagePrice: parseFloat(order.average),
      exchange: order.symbol.split('/')[1],
      amount: parseFloat(order.amount),
      trades:
        order.trades?.map((trade: Trade) => ({
          id: trade.id || '',
          tradeId: trade.id || '',
          ordertxid: trade.ordertxid || '',
          pair: trade.pair || '',
          time: trade.time || 0,
          type: trade.type,
          ordertype: trade.ordertype || '',
          price: trade.price || '0',
          cost: trade.cost || '0',
          fee: trade.fee || '0',
          vol: trade.vol || 0,
          margin: trade.margin || '0',
          leverage: trade.leverage || '0',
          misc: trade.misc || '',
          exchange: order.symbol.split('/')[1],
          date: trade.date || new Date(0),
        })) || [],
      status: order.status,
      closedPnL: order.closedPnL,
    };

    Orders.push(Order);
  });

  return Orders;
}
export function mapCCxtOrdersToOrders(
  exchange: string,
  orders: CCxtOrder[]
): Order[] {
  return orders.map((order) => ({
    id: Number(order.id),
    ordertxid: order.clientOrderId,
    time: order.timestamp,
    date: new Date(order.datetime),
    type: order.side as 'buy' | 'sell',
    pair: order.symbol,
    amount: order.amount,
    highestPrice: order.price,
    lowestPrice: order.price,
    averagePrice: order.price,
    exchange,
    trades:
      order.trades?.map((trade: any) => ({
        tradeId: trade.id || '',
        id: trade.id || '',
        ordertxid: trade.order || '',
        pair: trade.symbol || '',
        time: Number(trade.timestamp) || 0,
        type: trade.side as 'buy' | 'sell',
        ordertype: trade.type || '',
        price: trade.price?.toString() || '0',
        cost: trade.cost?.toString() || '0',
        fee: trade.fee?.cost?.toString() || '0',
        vol: trade.amount || 0,
        margin: '0',
        leverage: '0',
        misc: '',
        exchange: exchange,
        date: new Date(Number(trade.timestamp) || 0),
        closedPnL: trade.info.closedPnL,
      })) || [],
    orderId: order.id,
    status: order.status,
    totalCost: parseFloat(order.info.cost),
    fee: order.fee && order.fee.cost ? order.fee.cost : 0,
    closedPnL: order.info.closedPnL,
  }));
}
