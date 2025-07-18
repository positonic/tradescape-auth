#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectHyperliquidData() {
  console.log('🔍 Inspecting Hyperliquid trade data...\n');
  
  try {
    // Get recent Hyperliquid orders
    const hyperliquidOrders = await prisma.order.findMany({
      where: {
        exchange: 'Hyperliquid'
      },
      orderBy: {
        time: 'desc'
      },
      take: 20
    });
    
    console.log(`📊 Found ${hyperliquidOrders.length} recent Hyperliquid orders:\n`);
    
    for (const order of hyperliquidOrders) {
      const time = new Date(Number(order.time));
      const price = Number(order.totalCost) / Number(order.amount);
      
      console.log(`🔹 Order ${order.id}:`);
      console.log(`   Time: ${time.toLocaleString()}`);
      console.log(`   Pair: ${order.pair}`);
      console.log(`   Type: ${order.type}`);
      console.log(`   Amount: ${Number(order.amount).toFixed(4)}`);
      console.log(`   Price: $${price.toFixed(4)}`);
      console.log(`   Total Cost: $${Number(order.totalCost).toFixed(2)}`);
      console.log(`   Average Price: $${Number(order.averagePrice || 0).toFixed(4)}`);
      console.log(`   Fee: $${Number(order.fee || 0).toFixed(4)}`);
      console.log(`   Order TX ID: ${order.ordertxid || 'N/A'}`);
      console.log(`   Position ID: ${order.positionId || 'None'}`);
      console.log(`   User ID: ${order.userId}`);
      console.log(`   order: ${JSON.stringify(order, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      )}`);
      console.log('');
    }
    
    // Show data types and structure
    console.log('📋 DATA STRUCTURE ANALYSIS:');
    console.log('============================');
    
    if (hyperliquidOrders.length > 0) {
      const sample = hyperliquidOrders[0];
      if (sample) {
        console.log('Sample order data types:');
        console.log(`- id: ${typeof sample.id} (${sample.id})`);
        console.log(`- time: ${typeof sample.time} (${sample.time})`);
        console.log(`- pair: ${typeof sample.pair} (${sample.pair})`);
        console.log(`- type: ${typeof sample.type} (${sample.type})`);
        console.log(`- amount: ${typeof sample.amount} (${sample.amount})`);
        console.log(`- totalCost: ${typeof sample.totalCost} (${sample.totalCost})`);
        console.log(`- averagePrice: ${typeof sample.averagePrice} (${sample.averagePrice})`);
        console.log(`- fee: ${typeof sample.fee} (${sample.fee})`);
        console.log(`- ordertxid: ${typeof sample.ordertxid} (${sample.ordertxid})`);
        console.log(`- exchange: ${typeof sample.exchange} (${sample.exchange})`);
      }
    }
    
    // Statistics
    console.log('\\n📈 STATISTICS:');
    console.log('===============');
    
    const totalOrders = await prisma.order.count({
      where: { exchange: 'Hyperliquid' }
    });
    
    const pairs = await prisma.order.findMany({
      where: { exchange: 'Hyperliquid' },
      select: { pair: true },
      distinct: ['pair']
    });
    
    const orderTypes = await prisma.order.groupBy({
      by: ['type'],
      where: { exchange: 'Hyperliquid' },
      _count: { type: true }
    });
    
    console.log(`Total Hyperliquid orders: ${totalOrders}`);
    console.log(`Unique pairs: ${pairs.length}`);
    console.log(`Order type breakdown:`);
    orderTypes.forEach(({ type, _count }) => {
      console.log(`  ${type}: ${_count.type} orders`);
    });
    
    console.log('\\nTop 10 most traded pairs:');
    const topPairs = await prisma.order.groupBy({
      by: ['pair'],
      where: { exchange: 'Hyperliquid' },
      _count: { pair: true },
      orderBy: { _count: { pair: 'desc' } },
      take: 10
    });
    
    topPairs.forEach(({ pair, _count }) => {
      console.log(`  ${pair}: ${_count.pair} orders`);
    });
    
    // Show raw data structure for debugging
    console.log('\\n🔬 RAW DATA SAMPLE:');
    console.log('===================');
    if (hyperliquidOrders.length > 0) {
      console.log(JSON.stringify(hyperliquidOrders[0], (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      , 2));
    }
    
  } catch (error) {
    console.error('❌ Error inspecting Hyperliquid data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

await inspectHyperliquidData();