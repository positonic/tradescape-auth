#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function quickTest() {
  console.log('🔍 Starting quick validation test...');
  
  try {
    // Set a connection timeout
    console.log('📡 Attempting database connection...');
    
    const result = await Promise.race([
      prisma.position.count({
        where: {
          positionType: 'automated'
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      )
    ]);
    
    console.log(`📊 Found ${result} automated positions`);
    
    // Enhanced analysis of positions
    const samplePositions = await prisma.position.findMany({
      where: {
        positionType: 'automated'
      },
      include: {
        orders: {
          select: {
            id: true,
            type: true,
            amount: true,
            totalCost: true,
            time: true,
            averagePrice: true,
          }
        }
      },
      take: 20, // Analyze more positions
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`\n📋 Detailed analysis of ${samplePositions.length} recent positions:`);
    
    let totalIssues = 0;
    let positionsWithIssues = 0;
    const pairStats: Record<string, { total: number; issues: number }> = {};
    
    for (const position of samplePositions) {
      const buyOrders = position.orders.filter(o => o.type === 'buy');
      const sellOrders = position.orders.filter(o => o.type === 'sell');
      
      const calculatedBuyVolume = buyOrders.reduce((sum, o) => sum + Number(o.amount), 0);
      const calculatedSellVolume = sellOrders.reduce((sum, o) => sum + Number(o.amount), 0);
      const calculatedBuyCost = buyOrders.reduce((sum, o) => sum + Number(o.totalCost), 0);
      const calculatedSellCost = sellOrders.reduce((sum, o) => sum + Number(o.totalCost), 0);
      
      // Track pair statistics
      const pair = position.pair ?? "UNKNOWN";
      if (!pairStats[pair]) {
        pairStats[pair] = { total: 0, issues: 0 };
      }
      pairStats[pair].total++;
      
      console.log(`\n🔸 Position ${position.id} (${position.pair}):`);
      console.log(`   Orders: ${position.orders.length} total (${buyOrders.length} buy, ${sellOrders.length} sell)`);
      console.log(`   Calculated: Buy=$${calculatedBuyCost.toFixed(2)} (${calculatedBuyVolume.toFixed(4)} vol), Sell=$${calculatedSellCost.toFixed(2)} (${calculatedSellVolume.toFixed(4)} vol)`);
      console.log(`   Stored: Buy=$${Number(position.totalCostBuy).toFixed(2)}, Sell=$${Number(position.totalCostSell).toFixed(2)}, Amount=${Number(position.amount).toFixed(4)}`);
      console.log(`   P&L: Calculated=$${(calculatedSellCost - calculatedBuyCost).toFixed(2)}, Stored=$${Number(position.profitLoss).toFixed(2)}`);
      
      // Show individual orders for problematic positions
      const tolerance = 0.01;
      const hasBuyCostIssue = Math.abs(calculatedBuyCost - Number(position.totalCostBuy)) > tolerance;
      const hasSellCostIssue = Math.abs(calculatedSellCost - Number(position.totalCostSell)) > tolerance;
      const hasPnLIssue = Math.abs((calculatedSellCost - calculatedBuyCost) - Number(position.profitLoss)) > tolerance;
      
      if (hasBuyCostIssue || hasSellCostIssue || hasPnLIssue) {
        console.log(`   📋 Order breakdown:`);
        position.orders.forEach(order => {
          console.log(`      ${order.type}: ${Number(order.amount).toFixed(4)} @ $${Number(order.averagePrice || 0).toFixed(2)} = $${Number(order.totalCost).toFixed(2)}`);
        });
      }
      
      // Check for issues
      const issues = [];
      if (hasBuyCostIssue) {
        issues.push(`Buy cost mismatch: calc=${calculatedBuyCost.toFixed(2)} vs stored=${Number(position.totalCostBuy).toFixed(2)}`);
      }
      if (hasSellCostIssue) {
        issues.push(`Sell cost mismatch: calc=${calculatedSellCost.toFixed(2)} vs stored=${Number(position.totalCostSell).toFixed(2)}`);
      }
      if (hasPnLIssue) {
        issues.push(`P&L mismatch: calc=${(calculatedSellCost - calculatedBuyCost).toFixed(2)} vs stored=${Number(position.profitLoss).toFixed(2)}`);
      }
      
      // Check for volume mismatches
      const expectedVolume = Math.max(calculatedBuyVolume, calculatedSellVolume);
      if (Math.abs(expectedVolume - Number(position.amount)) > tolerance) {
        issues.push(`Volume mismatch: calc=${expectedVolume.toFixed(4)} vs stored=${Number(position.amount).toFixed(4)}`);
      }
      
      // Check for data quality issues
      if (position.orders.length === 0) {
        issues.push('No orders linked');
      }
      
      if (calculatedBuyVolume === 0 && calculatedSellVolume === 0) {
        issues.push('Zero volume');
      }
      
      if (issues.length > 0) {
        console.log(`   ❌ Issues (${issues.length}):`);
        issues.forEach(issue => console.log(`      - ${issue}`));
        totalIssues += issues.length;
        positionsWithIssues++;
        pairStats[pair].issues++;
      } else {
        console.log(`   ✅ No issues detected`);
      }
    }
    
    // Summary statistics
    console.log(`\n📊 SUMMARY STATISTICS:`);
    console.log(`Total positions analyzed: ${samplePositions.length}`);
    console.log(`Positions with issues: ${positionsWithIssues} (${(positionsWithIssues / samplePositions.length * 100).toFixed(1)}%)`);
    console.log(`Total issues found: ${totalIssues}`);
    console.log(`Average issues per position: ${(totalIssues / samplePositions.length).toFixed(2)}`);
    
    // Pair-wise analysis
    console.log(`\n📊 PAIR-WISE ANALYSIS:`);
    Object.entries(pairStats).forEach(([pair, stats]) => {
      const issueRate = (stats.issues / stats.total * 100).toFixed(1);
      console.log(`${pair}: ${stats.issues}/${stats.total} positions with issues (${issueRate}%)`);
    });
    
    await prisma.$disconnect();
    console.log('\n✅ Enhanced validation complete!');
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
    await prisma.$disconnect();
    throw error;
  }
}

quickTest();