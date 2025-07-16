// PositionAggregator.ts
export class PositionAggregator {
  private readonly volumeThresholdPercent: number;

  constructor(volumeThresholdPercent = 3) {
    this.volumeThresholdPercent = volumeThresholdPercent;
  }

  aggregate(orders: Order[]): Position[] {
    const ordersByPair = this.groupOrdersByPair(orders);
    return this.calculatePositions(ordersByPair);
  }

  private groupOrdersByPair(orders: Order[]): Record<string, Order[]> {
    return orders.reduce((groups: Record<string, Order[]>, order) => {
      const pair = order.pair;
      if (!groups[pair]) {
        groups[pair] = [];
      }
      groups[pair].push(order);
      return groups;
    }, {});
  }

  private calculatePositions(
    ordersByPair: Record<string, Order[]>
  ): Position[] {
    const positions: Position[] = [];

    for (const [, orders] of Object.entries(ordersByPair)) {
      let currentPosition: Position | null = null;

      for (const order of orders) {
        if (!currentPosition) {
          currentPosition = {
            Date: new Date(order.time).toISOString(),
            ProfitLoss: 0,
            Duration: '',
            PositionType: order.type === 'buy' ? 'long' : 'short',
            AverageEntryPrice: order.averagePrice,
            AverageExitPrice: 0,
            TotalCostBuy: order.type === 'buy' ? order.totalCost : 0,
            TotalCostSell: order.type === 'sell' ? order.totalCost : 0,
            Orders: [order],
            amount: order.amount,
          };
        } else {
          currentPosition.Orders.push(order);
          if (order.type === 'buy') {
            currentPosition.TotalCostBuy += order.totalCost;
          } else {
            currentPosition.TotalCostSell += order.totalCost;
          }
        }

        // If position is closed, add it to positions array and reset
        if (currentPosition && Math.abs(currentPosition.amount) < 0.00001) {
          positions.push(currentPosition);
          currentPosition = null;
        }
      }

      // Add any remaining open position
      if (currentPosition) {
        positions.push(currentPosition);
      }
    }

    return positions;
  }
}
