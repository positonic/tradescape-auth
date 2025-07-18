import { Position } from './types';
import { Order } from '../interfaces/Order';
import {
  minutesBetweenTimestamps,
  isVolumeDifferenceWithinThreshold,
  positionSoldOut,
} from './calculations';

const VOLUME_THRESHOLD_PERCENT = 3;

export function createPositionsFromOrders(
  orders: Order[],
  exchangeName: string
): Position[] {
  const positions: Position[] = [];
  
  // Group orders by pair for proper position tracking
  const ordersByPair = groupOrdersByPair(orders);
  
  for (const [pair, pairOrders] of Object.entries(ordersByPair)) {
    const pairPositions = createPositionsForPair(pairOrders, exchangeName);
    positions.push(...pairPositions);
  }

  return positions;
}

function groupOrdersByPair(orders: Order[]): Record<string, Order[]> {
  return orders.reduce((groups: Record<string, Order[]>, order) => {
    const pair = order.pair;
    if (!groups[pair]) {
      groups[pair] = [];
    }
    groups[pair].push(order);
    return groups;
  }, {});
}

function createPositionsForPair(orders: Order[], exchangeName: string): Position[] {
  const positions: Position[] = [];
  const positionState = {
    openPosition: 0,
    positionCost: 0,
    positionBuyCost: 0,
    positionSellCost: 0,
    tempOrders: [] as Order[]
  };

  // Sort orders by time to ensure proper chronological processing
  const sortedOrders = [...orders].sort((a, b) => Number(a.time) - Number(b.time));

  for (const order of sortedOrders) {
    positionState.tempOrders.push(order);

    if (order.type === 'buy') {
      handleBuyOrder(order, positionState);
    } else {
      const position = handleSellOrder(order, positionState, exchangeName);

      if (position) {
        positions.push(position);
        resetPositionTracking(positionState);
      }
    }
  }

  // Handle any remaining open position
  if (positionState.tempOrders.length > 0 && Math.abs(positionState.openPosition) > 0.00001) {
    const openPosition = createOpenPosition(positionState, exchangeName);
    if (openPosition) {
      positions.push(openPosition);
    }
  }

  return positions;
}

interface PositionState {
  openPosition: number;
  positionCost: number;
  positionBuyCost: number;
  positionSellCost: number;
  tempOrders: Order[];
}

function handleBuyOrder(order: Order, state: PositionState): void {
  state.openPosition += order.amount;
  const buyCost = order.amount * order.averagePrice;
  state.positionBuyCost += buyCost;
  state.positionCost += buyCost;
}

function handleSellOrder(
  order: Order,
  state: PositionState,
  exchangeName: string
): Position | null {
  const amountSold = order.amount;
  const sellCost = order.amount * order.averagePrice;
  state.positionSellCost += sellCost;

  // Calculate proportional costs for the sold amount
  const relativePositionCost = state.openPosition > 0 
    ? (state.positionCost / state.openPosition) * amountSold 
    : 0;
  const profitLoss = sellCost - relativePositionCost;
  const relativePositionBuyCost = state.openPosition > 0 
    ? (state.positionBuyCost / state.openPosition) * amountSold 
    : 0;

  state.openPosition -= amountSold;
  state.positionCost -= relativePositionCost;

  const firstOrderTime = state.tempOrders[0]?.time ?? order.time;
  const duration = minutesBetweenTimestamps(order.time, firstOrderTime);

  // Check if position should be closed
  if (Math.abs(state.openPosition) < 0.00001 || 
      isVolumeDifferenceWithinThreshold(
        state.positionBuyCost,
        state.positionSellCost,
        VOLUME_THRESHOLD_PERCENT
      )) {
    return {
      time: firstOrderTime,
      date: new Date(Number(order.time)),
      price: Number(order.averagePrice),
      type: 'long',
      buyCost: relativePositionBuyCost,
      sellCost: state.positionSellCost,
      profitLoss,
      exchange: exchangeName,
      orders: [...state.tempOrders],
      pair: order.pair,
      quantity: order.amount,
      duration,
      lastTime: order.time,
    };
  }

  return null;
}

function resetPositionTracking(state: PositionState): void {
  if (
    positionSoldOut(state.positionBuyCost, state.positionSellCost) ||
    isVolumeDifferenceWithinThreshold(
      state.positionBuyCost,
      state.positionSellCost,
      VOLUME_THRESHOLD_PERCENT
    )
  ) {
    state.positionBuyCost = 0;
    state.positionSellCost = 0;
    state.tempOrders = [];
  } else {
    state.positionBuyCost = state.positionBuyCost - state.positionSellCost;
    state.positionSellCost = 0;
  }
}

function createOpenPosition(state: PositionState, exchangeName: string): Position | null {
  if (state.tempOrders.length === 0) return null;

  const firstOrder = state.tempOrders[0];
  const lastOrder = state.tempOrders[state.tempOrders.length - 1];
  
  if (!firstOrder || !lastOrder) return null;

  const duration = minutesBetweenTimestamps(lastOrder.time, firstOrder.time);
  
  return {
    time: firstOrder.time,
    date: new Date(Number(firstOrder.time)),
    price: Number(firstOrder.averagePrice),
    type: state.openPosition > 0 ? 'long' : 'short',
    buyCost: state.positionBuyCost,
    sellCost: state.positionSellCost,
    profitLoss: state.positionSellCost - state.positionBuyCost, // Unrealized P&L
    exchange: exchangeName,
    orders: [...state.tempOrders],
    pair: firstOrder.pair,
    quantity: Math.abs(state.openPosition),
    duration,
    lastTime: lastOrder.time,
  };
}

export function aggregatePositions(orders: Order[]): Position[] {
  // Group orders by pair
  const ordersByPair: { [pair: string]: Order[] } = {};
  orders.forEach((order) => {
    if (!ordersByPair[order.pair]) {
      ordersByPair[order.pair] = [];
    }
    ordersByPair[order.pair]?.push(order);
  });

  const positions: Position[] = [];
  const pairOrders = Object.keys(ordersByPair);

  // Process each pair
  pairOrders.forEach((pair) => {
    console.log('pair', pair);
    let buyVolume = 0,
      sellVolume = 0;
    let buyCost = 0,
      sellCost = 0;
    let tempOrders: Order[] = [];

    ordersByPair[pair]?.forEach((order: Order) => {
      console.log('ordersByPair pair', pair);
      // Accumulate volumes and costs
      if (order.type === 'buy') {
        buyVolume += order.amount;
        buyCost += order.amount * order.averagePrice;
      } else {
        sellVolume += order.amount;
        sellCost += order.amount * order.averagePrice;
      }

      console.log(buyVolume);
      tempOrders.push(order);
      console.log('tempOrders', tempOrders);
      const VOLUME_THRESHOLD_PERCENT = 2;
      function isVolumeDifferenceWithinThreshold(
        buyVolume: number,
        sellVolume: number
      ) {
        return (
          (Math.abs(buyVolume - sellVolume) / ((buyVolume + sellVolume) / 2)) *
            100 <=
          VOLUME_THRESHOLD_PERCENT
        );
      }
      // Check if buy and sell volumes match
      if (isVolumeDifferenceWithinThreshold(buyVolume, sellVolume)) {
        // Create a position when buy and sell volumes are equal
        const positionType: 'long' | 'short' =
          buyVolume > sellVolume ? 'long' : 'short';
        const quantity = buyVolume > sellVolume ? buyVolume : sellVolume;
        const profitLoss =
          positionType === 'long' ? sellCost - buyCost : buyCost - sellCost;
        const duration =
          (tempOrders[0]?.time ?? 0) - (tempOrders[tempOrders.length - 1]?.time ?? 0);
        positions.push({
          time: tempOrders[0]?.trades[0]?.time ?? 0,
          date: new Date(tempOrders[0]?.trades[0]?.time ?? 0),
          price: Number(tempOrders[0]?.trades[0]?.price ?? 0),
          type: positionType,
          buyCost,
          sellCost,
          profitLoss,
          exchange: tempOrders[0]?.trades[0]?.exchange ?? '',
          orders: tempOrders.slice(),
          pair: tempOrders[0]?.pair ?? '',
          quantity,
          duration,
        });

        // Reset for the next set of matching orders
        buyVolume = 0;
        sellVolume = 0;
        buyCost = 0;
        sellCost = 0;
        tempOrders = [];
      }
    });
  });

  return positions;
}
