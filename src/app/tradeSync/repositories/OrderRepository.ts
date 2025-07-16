import { PrismaClient } from '@prisma/client';
import { Order } from '@/interfaces/Order';

export class OrderRepository {
  constructor(private prisma: PrismaClient) {}

  async saveAll(orders: Order[], userId: string): Promise<Order[]> {
    if (orders.length === 0) return orders;

    await Promise.all(
      orders.map(async (order, index) => {
        if (!order || !order.ordertxid || !order.pair) {
          console.error('Invalid order:', order);
          return;
        }

        try {
          const created = await this.prisma.order.create({
            data: {
              id: order.id,
              ordertxid: order.ordertxid || '',
              time: BigInt(order.time),
              type: order.type,
              pair: order.pair,
              amount: order.amount,
              totalCost: order.totalCost,
              fee: order.fee,
              highestPrice: order.highestPrice,
              lowestPrice: order.lowestPrice,
              averagePrice: order.averagePrice,
              exchange: order.exchange ?? '',
              userId: userId,
              closedPnL: order.closedPnL,
            },
          });
          orders[index].id = created.id; // Update the order in the array with the new ID
        } catch (error) {
          console.error('Error inserting order:', {
            error,
            orderId: order.id,
            pair: order.pair,
            time: order.time,
          });
        }
      })
    );

    return orders;
  }
}
