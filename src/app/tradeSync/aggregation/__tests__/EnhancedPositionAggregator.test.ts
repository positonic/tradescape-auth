import { describe, expect, test, beforeEach } from "@jest/globals";
import { EnhancedPositionAggregator } from "../EnhancedPositionAggregator";
import type { Order } from "../../interfaces/Order";
/* npx jest src/app/tradeSy
  nc/aggregation/__tests__
  /EnhancedPositionAggrega
  tor.test.ts*/
describe("EnhancedPositionAggregator", () => {
  let aggregator: EnhancedPositionAggregator;

  beforeEach(() => {
    aggregator = EnhancedPositionAggregator.createForStrategy(
      "positionByDirection",
    );
  });

  describe("positionByDirection strategy", () => {
    test("should correctly calculate position size for simple long position", () => {
      const orders: Order[] = [
        {
          id: 1,
          ordertxid: "test-1",
          time: 1750884972680,
          date: new Date(1750884972680),
          type: "buy",
          direction: "Open Long",
          pair: "UNI/USDC:USDC",
          amount: 28.4,
          highestPrice: 7.0378,
          lowestPrice: 7.0378,
          averagePrice: 7.0378,
          totalCost: 199.87352,
          exchange: "Hyperliquid",
          trades: [],
          fee: 0.089943,
          closedPnL: 0,
        },
        {
          id: 2,
          ordertxid: "test-2",
          time: 1750885011611,
          date: new Date(1750885011611),
          type: "buy",
          direction: "Open Long",
          pair: "UNI/USDC:USDC",
          amount: 56.8,
          highestPrice: 7.0379,
          lowestPrice: 7.0379,
          averagePrice: 7.0379,
          totalCost: 399.75272,
          exchange: "Hyperliquid",
          trades: [],
          fee: 0.179888,
          closedPnL: 0,
        },
        {
          id: 3,
          ordertxid: "test-3",
          time: 1751010944136,
          date: new Date(1751010944136),
          type: "sell",
          direction: "Close Long",
          pair: "UNI/USDC:USDC",
          amount: 85.2,
          highestPrice: 6.8544,
          lowestPrice: 6.8544,
          averagePrice: 6.8544,
          totalCost: 583.9948800000001,
          exchange: "Hyperliquid",
          trades: [],
          fee: 0.262797,
          closedPnL: -15.630792,
        },
      ];

      const positions = aggregator.aggregate(orders);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        pair: "UNI/USDC:USDC",
        type: "long",
        buyCost: expect.any(Number),
        sellCost: expect.any(Number),
        profitLoss: expect.any(Number),
      });

      // Specifically test that quantity is correct (max position size, not sum of all orders)
      expect(positions[0]?.quantity).toBeCloseTo(85.2, 1);
      expect(positions[0]?.quantity).not.toBeCloseTo(170.4, 1); // Should NOT be sum of all orders
    });

    test("should handle DCA position correctly", () => {
      const orders: Order[] = [
        {
          id: 1,
          ordertxid: "dca-1",
          time: 1751377783064,
          date: new Date(1751377783064),
          type: "buy",
          direction: "Open Long",
          pair: "UNI/USDC:USDC",
          amount: 143.1,
          highestPrice: 6.9936,
          lowestPrice: 6.9936,
          averagePrice: 6.9936,
          totalCost: 1000.78416,
          exchange: "Hyperliquid",
          trades: [],
          fee: 0.450352,
          closedPnL: 0,
        },
        {
          id: 2,
          ordertxid: "dca-2",
          time: 1751378453291,
          date: new Date(1751378453291),
          type: "buy",
          direction: "Open Long", // Adding to position
          pair: "UNI/USDC:USDC",
          amount: 428.9,
          highestPrice: 6.9984,
          lowestPrice: 6.9964,
          averagePrice: 6.998047843320121,
          totalCost: 3001.46272,
          exchange: "Hyperliquid",
          trades: [],
          fee: 1.350657,
          closedPnL: 0,
        },
        {
          id: 3,
          ordertxid: "dca-3",
          time: 1751380104516,
          date: new Date(1751380104516),
          type: "sell",
          direction: "Close Long",
          pair: "UNI/USDC:USDC",
          amount: 572,
          highestPrice: 6.9331,
          lowestPrice: 6.9306,
          averagePrice: 6.931632972027971,
          totalCost: 3964.89406,
          exchange: "Hyperliquid",
          trades: [],
          fee: 1.7842,
          closedPnL: -37.3499,
        },
      ];

      const positions = aggregator.aggregate(orders);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        pair: "UNI/USDC:USDC",
        type: "long",
        quantity: 572, // Max position size reached
      });

      // Verify the position size tracks the maximum, not the sum
      expect(positions[0]?.quantity).toBe(572);
      expect(positions[0]?.quantity).not.toBe(143.1 + 428.9 + 572); // Should NOT be sum
    });

    test("should create separate positions for distinct trading cycles", () => {
      const orders: Order[] = [
        // Position 1: Simple round trip
        {
          id: 1,
          ordertxid: "pos1-1",
          time: 1750884972680,
          date: new Date(1750884972680),
          type: "buy",
          direction: "Open Long",
          pair: "TEST/USDC",
          amount: 100,
          highestPrice: 10,
          lowestPrice: 10,
          averagePrice: 10,
          totalCost: 1000,
          exchange: "test",
          trades: [],
          fee: 1,
          closedPnL: 0,
        },
        {
          id: 2,
          ordertxid: "pos1-2",
          time: 1750885000000,
          date: new Date(1750885000000),
          type: "sell",
          direction: "Close Long",
          pair: "TEST/USDC",
          amount: 100,
          highestPrice: 11,
          lowestPrice: 11,
          averagePrice: 11,
          totalCost: 1100,
          exchange: "test",
          trades: [],
          fee: 1.1,
          closedPnL: 100,
        },
        // Position 2: Another separate round trip
        {
          id: 3,
          ordertxid: "pos2-1",
          time: 1750886000000,
          date: new Date(1750886000000),
          type: "buy",
          direction: "Open Long",
          pair: "TEST/USDC",
          amount: 200,
          highestPrice: 12,
          lowestPrice: 12,
          averagePrice: 12,
          totalCost: 2400,
          exchange: "test",
          trades: [],
          fee: 2.4,
          closedPnL: 0,
        },
        {
          id: 4,
          ordertxid: "pos2-2",
          time: 1750887000000,
          date: new Date(1750887000000),
          type: "sell",
          direction: "Close Long",
          pair: "TEST/USDC",
          amount: 200,
          highestPrice: 13,
          lowestPrice: 13,
          averagePrice: 13,
          totalCost: 2600,
          exchange: "test",
          trades: [],
          fee: 2.6,
          closedPnL: 200,
        },
      ];

      const positions = aggregator.aggregate(orders);

      expect(positions).toHaveLength(2);

      // First position
      expect(positions[0]).toMatchObject({
        pair: "TEST/USDC",
        type: "long",
        quantity: 100,
      });

      // Second position
      expect(positions[1]).toMatchObject({
        pair: "TEST/USDC",
        type: "long",
        quantity: 200,
      });
    });

    test("should handle orphaned close orders correctly", () => {
      const orders: Order[] = [
        // Orphaned close short order (should be ignored)
        {
          id: 1,
          ordertxid: "orphan-1",
          time: 1745195419788,
          date: new Date(1745195419788),
          type: "buy",
          direction: "Close Short",
          pair: "UNI/USDC:USDC",
          amount: 153,
          highestPrice: 5.3703,
          lowestPrice: 5.3687,
          averagePrice: 5.369835686274509,
          totalCost: 821.5848599999999,
          exchange: "Hyperliquid",
          trades: [],
          fee: 0.287554,
          closedPnL: -12.87429,
        },
        // Valid position
        {
          id: 2,
          ordertxid: "valid-1",
          time: 1750884972680,
          date: new Date(1750884972680),
          type: "buy",
          direction: "Open Long",
          pair: "UNI/USDC:USDC",
          amount: 28.4,
          highestPrice: 7.0378,
          lowestPrice: 7.0378,
          averagePrice: 7.0378,
          totalCost: 199.87352,
          exchange: "Hyperliquid",
          trades: [],
          fee: 0.089943,
          closedPnL: 0,
        },
        {
          id: 3,
          ordertxid: "valid-2",
          time: 1751010944136,
          date: new Date(1751010944136),
          type: "sell",
          direction: "Close Long",
          pair: "UNI/USDC:USDC",
          amount: 28.4,
          highestPrice: 6.8544,
          lowestPrice: 6.8544,
          averagePrice: 6.8544,
          totalCost: 193.43616,
          exchange: "Hyperliquid",
          trades: [],
          fee: 0.193436,
          closedPnL: -6.437,
        },
      ];

      const positions = aggregator.aggregate(orders);

      // Should only create 1 position (orphaned close short is ignored)
      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        pair: "UNI/USDC:USDC",
        type: "long",
        quantity: 28.4,
      });
    });

    test("should handle short positions correctly", () => {
      const orders: Order[] = [
        {
          id: 1,
          ordertxid: "short-1",
          time: 1750000000000,
          date: new Date(1750000000000),
          type: "sell",
          direction: "Open Short",
          pair: "FARTCOIN/USDC:USDC",
          amount: 2201.5,
          highestPrice: 0.5,
          lowestPrice: 0.5,
          averagePrice: 0.5,
          totalCost: 1100.75,
          exchange: "test",
          trades: [],
          fee: 1.1,
          closedPnL: 0,
        },
        {
          id: 2,
          ordertxid: "short-2",
          time: 1750001000000,
          date: new Date(1750001000000),
          type: "buy",
          direction: "Close Short",
          pair: "FARTCOIN/USDC:USDC",
          amount: 2201.5,
          highestPrice: 0.45,
          lowestPrice: 0.45,
          averagePrice: 0.45,
          totalCost: 990.675,
          exchange: "test",
          trades: [],
          fee: 0.99,
          closedPnL: 110.075,
        },
      ];

      const positions = aggregator.aggregate(orders);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        pair: "FARTCOIN/USDC:USDC",
        type: "short",
        quantity: 2201.5,
      });
    });

    test("should handle empty orders array", () => {
      const positions = aggregator.aggregate([]);
      expect(positions).toHaveLength(0);
    });

    test("should handle single order (open position)", () => {
      const orders: Order[] = [
        {
          id: 1,
          ordertxid: "single-1",
          time: 1750000000000,
          date: new Date(1750000000000),
          type: "buy",
          direction: "Open Long",
          pair: "TEST/USDC",
          amount: 100,
          highestPrice: 10,
          lowestPrice: 10,
          averagePrice: 10,
          totalCost: 1000,
          exchange: "test",
          trades: [],
          fee: 1,
          closedPnL: 0,
        },
      ];

      const positions = aggregator.aggregate(orders);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        pair: "TEST/USDC",
        type: "long",
        quantity: 100,
      });
    });
  });

  describe("other strategies", () => {
    test("conservative strategy should create fewer positions", () => {
      const conservativeAggregator =
        EnhancedPositionAggregator.createForStrategy("conservative");

      const orders: Order[] = [
        {
          id: 1,
          ordertxid: "test-1",
          time: 1750000000000,
          date: new Date(1750000000000),
          type: "buy",
          direction: "Open Long",
          pair: "TEST/USDC",
          amount: 100,
          highestPrice: 10,
          lowestPrice: 10,
          averagePrice: 10,
          totalCost: 1000,
          exchange: "test",
          trades: [],
          fee: 1,
          closedPnL: 0,
        },
      ];

      const positions = conservativeAggregator.aggregate(orders);

      // Conservative strategy requires minimum 2 orders
      expect(positions).toHaveLength(0);
    });

    test("aggressive strategy should create more positions", () => {
      const aggressiveAggregator =
        EnhancedPositionAggregator.createForStrategy("aggressive");

      const orders: Order[] = [
        {
          id: 1,
          ordertxid: "test-1",
          time: 1750000000000,
          date: new Date(1750000000000),
          type: "buy",
          direction: "Open Long",
          pair: "TEST/USDC",
          amount: 100,
          highestPrice: 10,
          lowestPrice: 10,
          averagePrice: 10,
          totalCost: 1000,
          exchange: "test",
          trades: [],
          fee: 1,
          closedPnL: 0,
        },
      ];

      const positions = aggressiveAggregator.aggregate(orders);

      // Aggressive strategy allows single orders
      expect(positions).toHaveLength(1);
    });
  });
});
