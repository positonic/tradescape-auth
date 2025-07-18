#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fullCleanup() {
  console.log('🧹 Starting full cleanup of trades data...\n');
  
  try {
    // Delete in correct order (foreign key constraints)
    console.log('🗑️ Deleting Positions...');
    const positionsResult = await prisma.position.deleteMany({});
    console.log(`✅ Deleted ${positionsResult.count} positions`);
    
    console.log('🗑️ Deleting Orders...');
    const ordersResult = await prisma.order.deleteMany({});
    console.log(`✅ Deleted ${ordersResult.count} orders`);
    
    console.log('🗑️ Deleting UserTrades...');
    const tradesResult = await prisma.userTrade.deleteMany({});
    console.log(`✅ Deleted ${tradesResult.count} user trades`);
    
    console.log('\n✅ Full cleanup complete!');
    console.log('👉 Now you can run "Full Sync" followed by "Create Positions"');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

await fullCleanup();