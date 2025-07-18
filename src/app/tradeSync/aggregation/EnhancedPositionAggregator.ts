import { Order } from "../interfaces/Order";
import { Position } from "../exchange/types";

interface AggregationConfig {
  volumeThresholdPercent: number;
  minOrdersForPosition: number;
  allowPartialPositions: boolean;
}

interface PositionState {
  orders: Order[];
  totalBuyVolume: number;
  totalSellVolume: number;
  totalBuyCost: number;
  totalSellCost: number;
  firstOrderTime: number;
  lastOrderTime: number;
  isOpen: boolean;
}

export class EnhancedPositionAggregator {
  private config: AggregationConfig;

  constructor(config: Partial<AggregationConfig> = {}) {
    this.config = {
      // timeWindowMinutes: 60, // Removed time-based grouping
      volumeThresholdPercent: 5, // 5% volume difference tolerance
      minOrdersForPosition: 1, // Minimum orders to create a position
      allowPartialPositions: true, // Allow partial/DCA positions
      ...config
    };
  }

  aggregate(orders: Order[]): Position[] {
    const positions: Position[] = [];
    
    // Group orders by pair first
    const ordersByPair = this.groupOrdersByPair(orders);
    
    for (const [pair, pairOrders] of Object.entries(ordersByPair)) {
      const pairPositions = this.aggregatePositionsForPair(pairOrders);
      positions.push(...pairPositions);
    }

    return positions;
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

  private aggregatePositionsForPair(orders: Order[]): Position[] {
    const positions: Position[] = [];
    
    // Sort orders by time
    const sortedOrders = [...orders].sort((a, b) => Number(a.time) - Number(b.time));
    
    // Use volume-based matching instead of time windows
    const positionGroups = this.groupOrdersByVolumeMatching(sortedOrders);
    
    for (const orderGroup of positionGroups) {
      const groupPositions = this.createPositionsFromOrderGroup(orderGroup);
      positions.push(...groupPositions);
    }

    return positions;
  }

  private groupOrdersByVolumeMatching(orders: Order[]): Order[][] {
    const groups: Order[][] = [];
    let currentGroup: Order[] = [];
    let runningBuyVolume = 0;
    let runningSellVolume = 0;

    for (const order of orders) {
      const orderVolume = Number(order.amount);
      currentGroup.push(order);
      
      // Update running totals
      if (order.type === 'buy') {
        runningBuyVolume += orderVolume;
      } else {
        runningSellVolume += orderVolume;
      }

      // Check if we have a position boundary
      const isPositionComplete = this.isPositionComplete(
        runningBuyVolume, 
        runningSellVolume, 
        currentGroup
      );

      if (isPositionComplete) {
        // Complete position found - start new group
        groups.push([...currentGroup]);
        currentGroup = [];
        runningBuyVolume = 0;
        runningSellVolume = 0;
      }
    }

    // Add any remaining orders as final group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  private isPositionComplete(
    buyVolume: number, 
    sellVolume: number, 
    orders: Order[]
  ): boolean {
    // Don't create tiny positions
    if (orders.length < this.config.minOrdersForPosition) {
      return false;
    }

    // Check if volumes are balanced (within tolerance)
    const volumeDifference = Math.abs(buyVolume - sellVolume);
    const totalVolume = buyVolume + sellVolume;
    
    if (totalVolume === 0) return false;
    
    const volumeDifferencePercent = (volumeDifference / totalVolume) * 100;
    const isBalanced = volumeDifferencePercent <= this.config.volumeThresholdPercent;

    // Position is complete if volumes are balanced
    if (isBalanced && buyVolume > 0 && sellVolume > 0) {
      return true;
    }

    // Also check for directional changes (position boundary detection)
    if (orders.length >= 2) {
      const lastOrder = orders[orders.length - 1];
      const secondLastOrder = orders[orders.length - 2];
      
      // If we switch from net long to net short or vice versa, that's a boundary
      const wasNetLong = buyVolume - Number(lastOrder.amount) > sellVolume;
      const isNowNetShort = buyVolume < sellVolume;
      
      if (wasNetLong && isNowNetShort) {
        return true; // Boundary: went from long to short
      }
    }

    return false;
  }

  private createPositionsFromOrderGroup(orders: Order[]): Position[] {
    const positions: Position[] = [];
    
    if (orders.length < this.config.minOrdersForPosition) {
      return positions;
    }

    // Analyze the order pattern
    const analysis = this.analyzeOrderPattern(orders);
    
    // Create positions based on the detected pattern
    if (analysis.isBalanced) {
      // Complete position (buy + sell)
      const position = this.createCompletePosition(orders, analysis);
      if (position) positions.push(position);
    } else if (this.config.allowPartialPositions) {
      // Partial position (only buys or only sells, or unbalanced)
      const position = this.createPartialPosition(orders, analysis);
      if (position) positions.push(position);
    }

    return positions;
  }

  private analyzeOrderPattern(orders: Order[]): {
    totalBuyVolume: number;
    totalSellVolume: number;
    totalBuyCost: number;
    totalSellCost: number;
    buyOrders: Order[];
    sellOrders: Order[];
    isBalanced: boolean;
    strategyType: 'simple' | 'dca' | 'scaling' | 'mixed';
  } {
    const buyOrders = orders.filter(o => o.type === 'buy');
    const sellOrders = orders.filter(o => o.type === 'sell');
    
    const totalBuyVolume = buyOrders.reduce((sum, order) => sum + Number(order.amount), 0);
    const totalSellVolume = sellOrders.reduce((sum, order) => sum + Number(order.amount), 0);
    const totalBuyCost = buyOrders.reduce((sum, order) => sum + Number(order.totalCost), 0);
    const totalSellCost = sellOrders.reduce((sum, order) => sum + Number(order.totalCost), 0);

    // Check if volumes are balanced within threshold
    const volumeDifference = Math.abs(totalBuyVolume - totalSellVolume);
    const averageVolume = (totalBuyVolume + totalSellVolume) / 2;
    const volumeDifferencePercent = averageVolume > 0 ? (volumeDifference / averageVolume) * 100 : 0;
    const isBalanced = volumeDifferencePercent <= this.config.volumeThresholdPercent;

    // Detect strategy type
    let strategyType: 'simple' | 'dca' | 'scaling' | 'mixed' = 'simple';
    
    if (buyOrders.length > 1 && sellOrders.length > 1) {
      strategyType = 'mixed';
    } else if (buyOrders.length > 1) {
      strategyType = 'dca'; // Multiple buys = DCA
    } else if (sellOrders.length > 1) {
      strategyType = 'scaling'; // Multiple sells = scaling out
    }

    return {
      totalBuyVolume,
      totalSellVolume,
      totalBuyCost,
      totalSellCost,
      buyOrders,
      sellOrders,
      isBalanced,
      strategyType
    };
  }

  private createCompletePosition(orders: Order[], analysis: any): Position | null {
    const firstOrder = orders[0];
    const lastOrder = orders[orders.length - 1];
    
    if (!firstOrder || !lastOrder) return null;

    const duration = Number(lastOrder.time) - Number(firstOrder.time);
    const profitLoss = analysis.totalSellCost - analysis.totalBuyCost;
    
    // Calculate weighted average prices
    const avgBuyPrice = analysis.totalBuyVolume > 0 ? analysis.totalBuyCost / analysis.totalBuyVolume : 0;
    const avgSellPrice = analysis.totalSellVolume > 0 ? analysis.totalSellCost / analysis.totalSellVolume : 0;

    return {
      time: firstOrder.time,
      date: new Date(Number(firstOrder.time)),
      price: avgBuyPrice,
      type: firstOrder.type === 'buy' ? 'long' : 'short', // Determine based on opening order
      buyCost: analysis.totalBuyCost,
      sellCost: analysis.totalSellCost,
      profitLoss,
      exchange: firstOrder.exchange || orders[0]?.exchange || '',
      orders: [...orders],
      pair: firstOrder.pair,
      quantity: Math.min(analysis.totalBuyVolume, analysis.totalSellVolume),
      duration,
      lastTime: lastOrder.time,
    };
  }

  private createPartialPosition(orders: Order[], analysis: any): Position | null {
    const firstOrder = orders[0];
    const lastOrder = orders[orders.length - 1];
    
    if (!firstOrder || !lastOrder) return null;

    const duration = Number(lastOrder.time) - Number(firstOrder.time);
    
    // Determine position direction based on first order (opening position)
    const isLong = firstOrder.type === 'buy';
    
    // For partial positions, P&L might be unrealized
    const profitLoss = analysis.totalSellCost - analysis.totalBuyCost;
    
    return {
      time: firstOrder.time,
      date: new Date(Number(firstOrder.time)),
      price: isLong ? 
        (analysis.totalBuyVolume > 0 ? analysis.totalBuyCost / analysis.totalBuyVolume : 0) :
        (analysis.totalSellVolume > 0 ? analysis.totalSellCost / analysis.totalSellVolume : 0),
      type: isLong ? 'long' : 'short',
      buyCost: analysis.totalBuyCost,
      sellCost: analysis.totalSellCost,
      profitLoss,
      exchange: firstOrder.exchange || orders[0]?.exchange || '',
      orders: [...orders],
      pair: firstOrder.pair,
      quantity: Math.max(analysis.totalBuyVolume, analysis.totalSellVolume),
      duration,
      lastTime: lastOrder.time,
    };
  }

  // Factory method for different aggregation strategies
  static createForStrategy(strategy: 'conservative' | 'aggressive' | 'dca'): EnhancedPositionAggregator {
    switch (strategy) {
      case 'conservative':
        return new EnhancedPositionAggregator({
          volumeThresholdPercent: 2,
          minOrdersForPosition: 2,
          allowPartialPositions: false
        });
      
      case 'aggressive':
        return new EnhancedPositionAggregator({
          volumeThresholdPercent: 10,
          minOrdersForPosition: 1,
          allowPartialPositions: true
        });
      
      case 'dca':
        return new EnhancedPositionAggregator({
          volumeThresholdPercent: 15,
          minOrdersForPosition: 3,
          allowPartialPositions: true
        });
      
      default:
        return new EnhancedPositionAggregator();
    }
  }
}