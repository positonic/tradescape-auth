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
  const openPosition = 0;
  const positionCost = 0;
  const positionBuyCost = 0;
  const positionSellCost = 0;
  const tempOrders: Order[] = [];

  orders.forEach((order: Order) => {
    tempOrders.push(order);

    if (order.type === 'buy') {
      handleBuyOrder(order, openPosition, positionBuyCost, positionCost);
    } else {
      const position = handleSellOrder(
        order,
        tempOrders,
        openPosition,
        positionCost,
        positionBuyCost,
        positionSellCost,
        exchangeName
      );

      if (position) {
        positions.push(position);
        resetPositionTracking(positionBuyCost, positionSellCost);
      }
    }
  });

  return positions;
}

function handleBuyOrder(
  order: Order,
  openPosition: number,
  positionBuyCost: number,
  positionCost: number
): void {
  openPosition += order.amount;
  const buyCost = order.amount * order.averagePrice;
  positionBuyCost += buyCost;
  positionCost += buyCost;
}

function handleSellOrder(
  order: Order,
  tempOrders: Order[],
  openPosition: number,
  positionCost: number,
  positionBuyCost: number,
  positionSellCost: number,
  exchangeName: string
): Position | null {
  const amountSold = order.amount;
  const sellCost = order.amount * order.averagePrice;
  positionSellCost += sellCost;

  const relativePositionCost = (positionCost / openPosition) * amountSold;
  const profitLoss = sellCost - relativePositionCost;
  const relativePositionBuyCost = (positionBuyCost / openPosition) * amountSold;

  openPosition -= amountSold;
  positionCost -= relativePositionCost;

  const firstOrderTime = tempOrders[0]?.time ?? order.time;

  const duration = minutesBetweenTimestamps(order.time, firstOrderTime);

  return {
    time: firstOrderTime,
    date: new Date(order.time),
    price: Number(order.averagePrice),
    type: 'long',
    buyCost: relativePositionBuyCost,
    sellCost: positionSellCost,
    profitLoss,
    exchange: exchangeName,
    orders: [...tempOrders],
    pair: order.pair,
    quantity: order.amount,
    duration,
    lastTime: order.time,
  };
}

function resetPositionTracking(
  positionBuyCost: number,
  positionSellCost: number
): void {
  if (
    positionSoldOut(positionBuyCost, positionSellCost) ||
    isVolumeDifferenceWithinThreshold(
      positionBuyCost,
      positionSellCost,
      VOLUME_THRESHOLD_PERCENT
    )
  ) {
    positionBuyCost = 0;
    positionSellCost = 0;
  } else {
    positionBuyCost = positionBuyCost - positionSellCost;
  }
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
