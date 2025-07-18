#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNewFields() {
  console.log('🧪 Testing new direction and transactionId fields...\n');
  
  try {
    // Test UserTrade fields
    const trades = await prisma.userTrade.findMany({
      take: 5,
      orderBy: { time: 'desc' },
      where: {
        exchange: 'Hyperliquid'
      }
    });
    
    console.log('📋 Recent UserTrade records:');
    trades.forEach(trade => {
      console.log(`  Trade ${trade.tradeId}: ${trade.type} ${trade.pair}`);
      console.log(`    Direction: ${trade.direction || 'null'}`);
      console.log(`    Transaction ID: ${trade.transactionId || 'null'}`);
      console.log('');
    });
    
    // Test Order fields
    const orders = await prisma.order.findMany({
      take: 5,
      orderBy: { time: 'desc' },
      where: {
        exchange: 'Hyperliquid'
      }
    });
    
    console.log('📋 Recent Order records:');
    orders.forEach(order => {
      console.log(`  Order ${order.id}: ${order.type} ${order.pair}`);
      console.log(`    Direction: ${order.direction || 'null'}`);
      console.log('');
    });
    
    // Check if any new fields are populated
    const tradesWithDirection = await prisma.userTrade.count({
      where: {
        direction: { not: null }
      }
    });
    
    const tradesWithTransactionId = await prisma.userTrade.count({
      where: {
        transactionId: { not: null }
      }
    });
    
    const ordersWithDirection = await prisma.order.count({
      where: {
        direction: { not: null }
      }
    });
    
    console.log('📊 FIELD POPULATION SUMMARY:');
    console.log(`UserTrades with direction: ${tradesWithDirection}`);
    console.log(`UserTrades with transactionId: ${tradesWithTransactionId}`);
    console.log(`Orders with direction: ${ordersWithDirection}`);
    
    if (tradesWithDirection === 0 && ordersWithDirection === 0) {
      console.log('\n⚠️  No new fields populated yet. Need to sync new trades to test.');
    } else {
      console.log('\n✅ New fields are working!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewFields();