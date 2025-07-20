#!/usr/bin/env bun

// Quick integration test for positionByDirection strategy
import { EnhancedPositionAggregator } from "../src/app/tradeSync/aggregation/EnhancedPositionAggregator.js";

console.log("🧪 Testing positionByDirection Integration");
console.log("=" .repeat(50));

// Simple test to verify the strategy works
const testOrders = [
  {
    id: 1,
    ordertxid: "test-1",
    time: 1000000000,
    date: new Date(1000000000),
    type: "buy" as const,
    direction: "Open Long",
    pair: "TEST/USDC",
    amount: 100,
    highestPrice: 10,
    lowestPrice: 10,
    averagePrice: 10,
    totalCost: 1000,
    exchange: "test",
    trades: [],
    fee: 0.5,
    closedPnL: 0,
  },
  {
    id: 2,
    ordertxid: "test-2",
    time: 1000001000,
    date: new Date(1000001000),
    type: "sell" as const,
    direction: "Close Long",
    pair: "TEST/USDC",
    amount: 100,
    highestPrice: 11,
    lowestPrice: 11,
    averagePrice: 11,
    totalCost: 1100,
    exchange: "test",
    trades: [],
    fee: 0.55,
    closedPnL: 100,
  }
];

try {
  const aggregator = EnhancedPositionAggregator.createForStrategy('positionByDirection');
  const positions = aggregator.aggregate(testOrders);
  
  console.log(`✅ Success! Created ${positions.length} positions`);
  console.log(`📊 Position details:`, positions[0]);
  
  if (positions.length === 1 && positions[0]?.type === 'long') {
    console.log("🎉 Integration test PASSED!");
  } else {
    console.log("❌ Integration test FAILED!");
  }
  
} catch (error) {
  console.error("❌ Integration test ERROR:", error);
}