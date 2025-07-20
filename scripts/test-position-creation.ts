#!/usr/bin/env bun

import { EnhancedPositionAggregator } from "../src/app/tradeSync/aggregation/EnhancedPositionAggregator.js";
import type { Order } from "../src/app/tradeSync/interfaces/Order.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Sample order data for testing different scenarios
/* COMMENTED OUT - Using real data instead
const sampleOrders: Order[] = [
  // Scenario 1: Simple buy-sell pair (should create 1 position)
  {
    id: 1,
    ordertxid: "order-1",
    time: 1700000000000,
    date: new Date(1700000000000),
    type: "buy",
    direction: "Open Long",
    pair: "BTC/USDT",
    amount: 1.0,
    highestPrice: 50000,
    lowestPrice: 50000,
    averagePrice: 50000,
    totalCost: 50000,
    exchange: "binance",
    trades: [],
    fee: 25,
    closedPnL: 0,
  },
  {
    id: 2,
    ordertxid: "order-2", 
    time: 1700001000000,
    date: new Date(1700001000000),
    type: "sell",
    direction: "Close Long",
    pair: "BTC/USDT",
    amount: 1.0,
    highestPrice: 51000,
    lowestPrice: 51000,
    averagePrice: 51000,
    totalCost: 51000,
    exchange: "binance",
    trades: [],
    fee: 25.5,
    closedPnL: 950,
  },

  // Scenario 2: DCA strategy (multiple buys, then sell)
  {
    id: 3,
    ordertxid: "order-3",
    time: 1700002000000,
    date: new Date(1700002000000),
    type: "buy",
    direction: "Open Long",
    pair: "ETH/USDT",
    amount: 2.0,
    highestPrice: 3000,
    lowestPrice: 3000,
    averagePrice: 3000,
    totalCost: 6000,
    exchange: "binance",
    trades: [],
    fee: 3,
    closedPnL: 0,
  },
  {
    id: 4,
    ordertxid: "order-4",
    time: 1700003000000,
    date: new Date(1700003000000),
    type: "buy",
    direction: "Add Long", 
    pair: "ETH/USDT",
    amount: 1.0,
    highestPrice: 2900,
    lowestPrice: 2900,
    averagePrice: 2900,
    totalCost: 2900,
    exchange: "binance",
    trades: [],
    fee: 1.45,
    closedPnL: 0,
  },
  {
    id: 5,
    ordertxid: "order-5",
    time: 1700004000000,
    date: new Date(1700004000000),
    type: "sell",
    direction: "Close Long",
    pair: "ETH/USDT", 
    amount: 3.0,
    highestPrice: 3100,
    lowestPrice: 3100,
    averagePrice: 3100,
    totalCost: 9300,
    exchange: "binance",
    trades: [],
    fee: 4.65,
    closedPnL: 390,
  },

  // Scenario 3: Partial position (buy only, no matching sell)
  {
    id: 6,
    ordertxid: "order-6",
    time: 1700005000000,
    date: new Date(1700005000000),
    type: "buy",
    direction: "Open Long",
    pair: "ADA/USDT",
    amount: 1000,
    highestPrice: 0.5,
    lowestPrice: 0.5,
    averagePrice: 0.5,
    totalCost: 500,
    exchange: "binance",
    trades: [],
    fee: 0.25,
    closedPnL: 0,
  },

  // Scenario 4: Unbalanced volumes (should test threshold logic)
  {
    id: 7,
    ordertxid: "order-7",
    time: 1700006000000,
    date: new Date(1700006000000),
    type: "buy",
    direction: "Open Long",
    pair: "SOL/USDT",
    amount: 10.0,
    highestPrice: 100,
    lowestPrice: 100,
    averagePrice: 100,
    totalCost: 1000,
    exchange: "binance",
    trades: [],
    fee: 0.5,
    closedPnL: 0,
  },
  {
    id: 8,
    ordertxid: "order-8",
    time: 1700007000000,
    date: new Date(1700007000000),
    type: "sell",
    direction: "Close Long",
    pair: "SOL/USDT",
    amount: 9.5, // Slightly unbalanced (5% difference)
    highestPrice: 105,
    lowestPrice: 105,
    averagePrice: 105,
    totalCost: 997.5,
    exchange: "binance",
    trades: [],
    fee: 0.5,
    closedPnL: -3,
  },
];
*/

async function fetchRealOrders(pair: string = "UNI/USDC:USDC"): Promise<Order[]> {
  console.log(`🔍 Fetching orders for pair: ${pair}`);
  
  try {
    const dbOrders = await prisma.order.findMany({
      where: {
        pair: pair,
      },
      orderBy: {
        time: 'asc'
      },
      include: {
        trades: true
      }
    });

    console.log(`📦 Found ${dbOrders.length} orders in database`);

    // Convert DB orders to our Order interface
    const orders: Order[] = dbOrders.map(dbOrder => ({
      id: dbOrder.id,
      ordertxid: dbOrder.ordertxid || `order-${dbOrder.id}`,
      time: Number(dbOrder.time),
      date: dbOrder.date,
      type: dbOrder.type as 'buy' | 'sell',
      direction: dbOrder.direction || undefined,
      pair: dbOrder.pair,
      amount: Number(dbOrder.amount),
      highestPrice: Number(dbOrder.highestPrice),
      lowestPrice: Number(dbOrder.lowestPrice),
      averagePrice: Number(dbOrder.averagePrice),
      totalCost: Number(dbOrder.totalCost),
      exchange: dbOrder.exchange,
      trades: dbOrder.trades?.map(trade => ({
        id: trade.id?.toString() || '',
        tradeId: trade.tradeId || '',
        ordertxid: trade.ordertxid || '',
        pair: trade.pair,
        time: Number(trade.time),
        type: trade.type as 'buy' | 'sell',
        ordertype: trade.ordertype || '',
        price: trade.price,
        cost: trade.cost || '0',
        fee: trade.fee || '0',
        vol: Number(trade.vol),
        margin: trade.margin || '0',
        leverage: trade.leverage || '0',
        misc: trade.misc || '',
        exchange: trade.exchange,
        date: trade.date,
        closedPnL: Number(trade.closedPnL) || 0,
        direction: trade.direction || undefined,
        transactionId: trade.transactionId || undefined,
      })) || [],
      fee: Number(dbOrder.fee),
      closedPnL: Number(dbOrder.closedPnL) || 0,
      status: dbOrder.status || undefined,
    }));

    // Output the raw data for copying
    console.log("\n📋 RAW ORDER DATA (copy this for hardcoding):");
    console.log("=" .repeat(60));
    console.log("const realOrders: Order[] = " + JSON.stringify(orders, null, 2) + ";");
    console.log("=" .repeat(60));

    return orders;
    
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    return [];
  }
}

async function testPositionCreation() {
  console.log("🧪 Testing Position Creation Logic");
  console.log("=" .repeat(50));
  
  // Fetch real orders
  const realOrders = await fetchRealOrders("UNI/USDC:USDC");
  
  if (realOrders.length === 0) {
    console.log("❌ No orders found! Cannot test position creation.");
    return;
  }
  
  // Test different strategies
  const strategies = ['conservative', 'aggressive', 'dca', 'positionByDirection'] as const;
  
  strategies.forEach(strategy => {
    console.log(`\n📊 Testing ${strategy.toUpperCase()} strategy:`);
    console.log("-".repeat(30));
    
    const aggregator = EnhancedPositionAggregator.createForStrategy(strategy);
    const positions = aggregator.aggregate(realOrders);
    
    console.log(`✅ Created ${positions.length} positions`);
    
    positions.forEach((position, index) => {
      console.log(`\nPosition ${index + 1}:`);
      console.log(`  📈 Pair: ${position.pair}`);
      console.log(`  🔄 Type: ${position.type}`);
      console.log(`  💰 P&L: $${position.profitLoss?.toFixed(2) || 'N/A'}`);
      console.log(`  📦 Orders: ${position.orders?.length || 0}`);
      console.log(`  🎯 Quantity: ${position.quantity}`);
      console.log(`  💵 Buy Cost: $${position.buyCost?.toFixed(2) || 'N/A'}`);
      console.log(`  💸 Sell Cost: $${position.sellCost?.toFixed(2) || 'N/A'}`);
      console.log(`  ⏱️  Duration: ${position.duration ? Math.round(position.duration / 1000 / 60) : 'N/A'} minutes`);
      
      // Show order details
      if (position.orders && position.orders.length > 0) {
        console.log(`  📋 Order breakdown:`);
        position.orders.forEach(order => {
          console.log(`    - ${order.type} ${order.amount} at $${order.averagePrice} (${order.direction || 'N/A'})`);
        });
      }
    });
  });
  
  // Test edge cases
  console.log("\n🔍 Testing Edge Cases:");
  console.log("-".repeat(30));
  
  // Empty orders
  const emptyResult = new EnhancedPositionAggregator().aggregate([]);
  console.log(`📭 Empty orders → ${emptyResult.length} positions`);
  
  // Single order
  if (realOrders.length > 0) {
    const singleOrderResult = new EnhancedPositionAggregator().aggregate([realOrders[0]]);
    console.log(`📦 Single order → ${singleOrderResult.length} positions`);
  }
  
  // Different pairs mixed
  const mixedPairsResult = new EnhancedPositionAggregator().aggregate(realOrders);
  const pairCounts = mixedPairsResult.reduce((acc, pos) => {
    acc[pos.pair] = (acc[pos.pair] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`🔀 Mixed pairs → positions per pair:`, pairCounts);
}

async function analyzeCurrentIssues() {
  console.log("\n🐛 Analyzing Current Issues:");
  console.log("=" .repeat(50));
  
  // Fetch real orders for analysis
  const realOrders = await fetchRealOrders("UNI/USDC:USDC");
  
  if (realOrders.length === 0) {
    console.log("❌ No orders found for analysis.");
    return;
  }
  
  const aggregator = new EnhancedPositionAggregator();
  const positions = aggregator.aggregate(realOrders);
  
  console.log("\n🔍 Issue Analysis:");
  
  // Check for direction consistency
  positions.forEach((position, i) => {
    if (position.orders && position.orders.length > 1) {
      const directions = position.orders.map(o => o.direction).filter(Boolean);
      const types = position.orders.map(o => o.type);
      
      console.log(`\nPosition ${i + 1} (${position.pair}):`);
      console.log(`  🎯 Position Type: ${position.type}`);
      console.log(`  📊 Order Types: [${types.join(', ')}]`);
      console.log(`  🧭 Directions: [${directions.join(', ')}]`);
      
      // Check if position type matches order pattern
      const hasOpenLong = directions.some(d => d?.includes('Open Long'));
      const hasCloseLong = directions.some(d => d?.includes('Close Long'));
      
      if (hasOpenLong && hasCloseLong && position.type !== 'long') {
        console.log(`  ⚠️  Issue: Has Open/Close Long pattern but position type is '${position.type}'`);
      }
    }
  });
}

// Run the tests
async function main() {
  try {
    await testPositionCreation();
    await analyzeCurrentIssues();
    
    console.log("\n✅ Test completed successfully!");
    console.log("\n💡 To run this script: bun scripts/test-position-creation.ts");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

await main();