#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugSolPosition() {
  console.log('🔍 Debugging SOL position creation...\n');
  
  try {
    // Find SOL orders from that specific time period
    const solOrders = await prisma.order.findMany({
      where: {
        pair: 'SOL/USDC:USDC',
        time: {
          gte: BigInt(new Date('2025-07-17T13:49:00').getTime()),
          lte: BigInt(new Date('2025-07-17T14:08:00').getTime())
        }
      },
      orderBy: {
        time: 'asc'
      }
    });
    
    console.log(`📊 Found ${solOrders.length} SOL orders in time range:`);
    
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    let totalBuyCost = 0;
    let totalSellCost = 0;
    
    for (const order of solOrders) {
      const amount = Number(order.amount);
      const cost = Number(order.totalCost);
      const price = cost / amount;
      
      console.log(`${order.type}: ${amount} SOL @ $${price.toFixed(2)} = $${cost.toFixed(2)} (${new Date(Number(order.time)).toLocaleString()})`);
      
      if (order.type === 'buy') {
        totalBuyVolume += amount;
        totalBuyCost += cost;
      } else {
        totalSellVolume += amount;
        totalSellCost += cost;
      }
    }
    
    console.log(`\n📊 Calculated totals:`);
    console.log(`Buy volume: ${totalBuyVolume} SOL`);
    console.log(`Sell volume: ${totalSellVolume} SOL`);
    console.log(`Buy cost: $${totalBuyCost.toFixed(2)}`);
    console.log(`Sell cost: $${totalSellCost.toFixed(2)}`);
    console.log(`P&L: $${(totalSellCost - totalBuyCost).toFixed(2)}`);
    
    // Check if there's a position for these orders
    const position = await prisma.position.findFirst({
      where: {
        pair: 'SOL/USDC:USDC',
        positionType: 'automated',
        time: {
          gte: BigInt(new Date('2025-07-17T13:49:00').getTime()),
          lte: BigInt(new Date('2025-07-17T14:08:00').getTime())
        }
      },
      include: {
        orders: true
      }
    });
    
    if (position) {
      console.log(`\n🎯 Found position ${position.id}:`);
      console.log(`Direction: ${position.direction}`);
      console.log(`Amount: ${Number(position.amount)}`);
      console.log(`Buy cost: $${Number(position.totalCostBuy).toFixed(2)}`);
      console.log(`Sell cost: $${Number(position.totalCostSell).toFixed(2)}`);
      console.log(`P&L: $${Number(position.profitLoss).toFixed(2)}`);
      console.log(`Orders linked: ${position.orders.length}`);
      
      // Show which orders are linked
      console.log(`\nLinked orders:`);
      for (const order of position.orders) {
        console.log(`  ${order.type}: ${Number(order.amount)} @ $${Number(order.totalCost).toFixed(2)}`);
      }
    } else {
      console.log(`\n⚠️ No position found for this time range`);
    }
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

await debugSolPosition();