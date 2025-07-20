import { Order } from "../interfaces/Order";
import { Position } from "../exchange/types";

interface AggregationConfig {
  volumeThresholdPercent: number;
  minOrdersForPosition: number;
  allowPartialPositions: boolean;
  strategy?: string;
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
    // Use direction-based strategy if specified
    if (this.config.strategy === 'positionByDirection') {
      return this.aggregateByDirection(orders);
    }
    
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

  // Direction-based position aggregation strategy
  aggregateByDirection(orders: Order[]): Position[] {
    const positions: Position[] = [];
    
    // Group orders by pair first
    const ordersByPair = this.groupOrdersByPair(orders);
    
    for (const [pair, pairOrders] of Object.entries(ordersByPair)) {
      const pairPositions = this.aggregatePositionsByDirection(pairOrders);
      positions.push(...pairPositions);
    }

    return positions;
  }

  private aggregatePositionsByDirection(orders: Order[]): Position[] {
    const positions: Position[] = [];
    
    // Sort orders by time (oldest first)
    const sortedOrders = [...orders].sort((a, b) => Number(a.time) - Number(b.time));
    
    let currentLongPosition: Order[] | null = null;
    let currentShortPosition: Order[] | null = null;
    
    for (const order of sortedOrders) {
      const direction = order.direction?.toLowerCase() || '';
      
      // Check for OPEN commands
      if (direction.includes('open long')) {
        // If we have an existing long position, close it first
        if (currentLongPosition && currentLongPosition.length > 0) {
          const position = this.createPositionFromDirectionOrders(currentLongPosition);
          if (position) positions.push(position);
        }
        // Start new long position
        currentLongPosition = [order];
        
      } else if (direction.includes('open short')) {
        // If we have an existing short position, close it first
        if (currentShortPosition && currentShortPosition.length > 0) {
          const position = this.createPositionFromDirectionOrders(currentShortPosition);
          if (position) positions.push(position);
        }
        // Start new short position
        currentShortPosition = [order];
        
      } else if (direction.includes('close long')) {
        // Add to current long position if one exists
        if (currentLongPosition) {
          currentLongPosition.push(order);
          // Check if position should be completed (could add logic here for partial closes)
          const position = this.createPositionFromDirectionOrders(currentLongPosition);
          if (position) positions.push(position);
          currentLongPosition = null; // Position closed
        }
        // If no open long position, skip this close order
        
      } else if (direction.includes('close short')) {
        // Add to current short position if one exists
        if (currentShortPosition) {
          currentShortPosition.push(order);
          // Check if position should be completed
          const position = this.createPositionFromDirectionOrders(currentShortPosition);
          if (position) positions.push(position);
          currentShortPosition = null; // Position closed
        }
        // If no open short position, skip this close order
        
      } else if (direction.includes('add long') && currentLongPosition) {
        // Add to existing long position
        currentLongPosition.push(order);
        
      } else if (direction.includes('add short') && currentShortPosition) {
        // Add to existing short position
        currentShortPosition.push(order);
        
      } else {
        // Unknown direction or no current position - treat as standalone if allowed
        if (this.config.allowPartialPositions) {
          const position = this.createPositionFromDirectionOrders([order]);
          if (position) positions.push(position);
        }
      }
    }
    
    // Handle any remaining open positions
    if (currentLongPosition && currentLongPosition.length > 0) {
      const position = this.createPositionFromDirectionOrders(currentLongPosition);
      if (position) positions.push(position);
    }
    
    if (currentShortPosition && currentShortPosition.length > 0) {
      const position = this.createPositionFromDirectionOrders(currentShortPosition);
      if (position) positions.push(position);
    }
    
    return positions;
  }

  private createPositionFromDirectionOrders(orders: Order[]): Position | null {
    if (orders.length === 0) return null;
    
    const firstOrder = orders[0];
    const lastOrder = orders[orders.length - 1];
    
    if (!firstOrder || !lastOrder) return null;

    // Analyze orders to get totals
    const buyOrders = orders.filter(o => o.type === 'buy');
    const sellOrders = orders.filter(o => o.type === 'sell');
    
    const totalBuyVolume = buyOrders.reduce((sum, order) => sum + Number(order.amount), 0);
    const totalSellVolume = sellOrders.reduce((sum, order) => sum + Number(order.amount), 0);
    const totalBuyCost = buyOrders.reduce((sum, order) => sum + Number(order.totalCost), 0);
    const totalSellCost = sellOrders.reduce((sum, order) => sum + Number(order.totalCost), 0);

    const duration = Number(lastOrder.time) - Number(firstOrder.time);
    const profitLoss = totalSellCost - totalBuyCost;
    
    // Determine position type from the first order's direction
    const firstDirection = firstOrder.direction?.toLowerCase() || '';
    let positionType: 'long' | 'short' = 'long';
    
    if (firstDirection.includes('open short') || firstDirection.includes('add short') || firstDirection.includes('close long')) {
      positionType = 'short';
    } else if (firstDirection.includes('open long') || firstDirection.includes('add long') || firstDirection.includes('close short')) {
      positionType = 'long';
    } else {
      // Fallback to type-based detection
      positionType = firstOrder.type === 'buy' ? 'long' : 'short';
    }
    
    // Calculate weighted average prices
    const avgBuyPrice = totalBuyVolume > 0 ? totalBuyCost / totalBuyVolume : 0;
    const avgSellPrice = totalSellVolume > 0 ? totalSellCost / totalSellVolume : 0;
    
    // Use the appropriate average price for the position
    const positionPrice = positionType === 'long' ? avgBuyPrice : avgSellPrice;
    
    return {
      time: firstOrder.time,
      date: new Date(Number(firstOrder.time)),
      price: positionPrice,
      type: positionType,
      buyCost: totalBuyCost,
      sellCost: totalSellCost,
      profitLoss,
      exchange: firstOrder.exchange || '',
      orders: [...orders],
      pair: firstOrder.pair,
      quantity: Math.max(totalBuyVolume, totalSellVolume),
      duration,
      lastTime: lastOrder.time,
    };
  }

  // Factory method for different aggregation strategies
  static createForStrategy(strategy: 'conservative' | 'aggressive' | 'dca' | 'positionByDirection'): EnhancedPositionAggregator {
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
      
      case 'positionByDirection':
        return new EnhancedPositionAggregator({
          volumeThresholdPercent: 0, // Not used for direction-based
          minOrdersForPosition: 1,
          allowPartialPositions: true,
          strategy: 'positionByDirection'
        });
      
      default:
        return new EnhancedPositionAggregator();
    }
  }
}