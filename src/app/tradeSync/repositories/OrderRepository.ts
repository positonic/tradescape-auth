import { PrismaClient } from '@prisma/client';
import { Order } from '../interfaces/Order';

export class OrderRepository {
  constructor(private prisma: PrismaClient) {}

  private normalizeSymbol(symbol: string): string {
    // Convert "SOL/USDC:USDC" to "SOL/USDC"
    return symbol.split(':')[0] || symbol;
  }

  async saveAll(orders: Order[], userId: string): Promise<Order[]> {
    if (orders.length === 0) return orders;

    // Get unique pair symbols from orders
    const uniquePairSymbols = [...new Set(orders.map(order => this.normalizeSymbol(order.pair)))];
    
    // Look up existing Pairs and create missing ones
    const pairMap = new Map<string, number>();
    
    for (const symbol of uniquePairSymbols) {
      let pairRecord = await this.prisma.pair.findUnique({
        where: { symbol }
      });
      
      if (!pairRecord) {
        // Try to find by base symbol (e.g., "SOL" for "SOL/USDC")
        const baseSymbol = symbol.split('/')[0];
        if (baseSymbol && baseSymbol !== symbol) {
          pairRecord = await this.prisma.pair.findUnique({
            where: { symbol: baseSymbol }
          });
        }
      }
      
      if (!pairRecord) {
        // Create new Pair record if it doesn't exist
        try {
          pairRecord = await this.prisma.pair.create({
            data: {
              symbol,
              baseCoinId: 1,  // Default base coin
              quoteCoinId: 1, // Default quote coin
            }
          });
          console.log(`📝 [OrderRepository] Created new Pair record for ${symbol}`);
        } catch (error) {
          console.log(`❌ [OrderRepository] Could not create Pair for ${symbol}:`, error);
        }
      }
      
      if (pairRecord) {
        pairMap.set(symbol, pairRecord.id);
        // Also map any orders with the original symbol format
        orders.forEach(o => {
          if (this.normalizeSymbol(o.pair) === symbol) {
            pairMap.set(o.pair, pairRecord.id);
          }
        });
      }
    }

    await Promise.all(
      orders.map(async (order, index) => {
        if (!order || !order.ordertxid || !order.pair) {
          console.error('Invalid order:', order);
          return;
        }

        const normalizedPair = this.normalizeSymbol(order.pair);
        const pairId = pairMap.get(normalizedPair) ?? null;

        try {
          const created = await this.prisma.order.create({
            data: {
              id: order.id,
              ordertxid: order.ordertxid || '',
              time: BigInt(order.time),
              type: order.type,
              direction: order.direction,
              pair: order.pair,
              pairId: pairId,
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
          if (orders[index]) {
            orders[index].id = created.id; // Update the order in the array with the new ID
          }
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
