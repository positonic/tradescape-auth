#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ValidationResult {
  positionId: number;
  pair: string;
  orderCount: number;
  issues: string[];
  calculatedMetrics: {
    buyVolume: number;
    sellVolume: number;
    buyCost: number;
    sellCost: number;
    pnl: number;
  };
  storedMetrics: {
    buyVolume: number;
    sellVolume: number;
    buyCost: number;
    sellCost: number;
    pnl: number;
  };
}

async function validatePositions() {
  console.log('🔍 Starting comprehensive position validation...\n');
  
  try {
    // Get total count first
    const totalCount = await prisma.position.count({
      where: { positionType: 'automated' }
    });
    console.log(`📊 Found ${totalCount} automated positions to validate\n`);
    
    const results: ValidationResult[] = [];
    const batchSize = 10;
    let processed = 0;
    
    // Process in batches to avoid memory issues
    for (let offset = 0; offset < totalCount; offset += batchSize) {
      console.log(`🔄 Processing batch ${Math.floor(offset / batchSize) + 1}/${Math.ceil(totalCount / batchSize)} (positions ${offset + 1}-${Math.min(offset + batchSize, totalCount)})`);
      
      const positions = await prisma.position.findMany({
        where: { positionType: 'automated' },
        include: {
          orders: {
            select: {
              id: true,
              type: true,
              amount: true,
              totalCost: true,
              time: true,
            }
          }
        },
        skip: offset,
        take: batchSize,
        orderBy: { createdAt: 'desc' }
      });
      
      for (const position of positions) {
        const result = await validatePosition(position);
        results.push(result);
        processed++;
        
        if (result.issues.length > 0) {
          console.log(`❌ Position ${result.positionId} (${result.pair}): ${result.issues.join(', ')}`);
        }
      }
      
      console.log(`✅ Processed ${processed}/${totalCount} positions`);
    }
    
    // Generate summary report
    generateSummaryReport(results);
    
  } catch (error) {
    console.error('❌ Validation error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function validatePosition(position: any): Promise<ValidationResult> {
  const orders = position.orders;
  const buyOrders = orders.filter((o: any) => o.type === 'buy');
  const sellOrders = orders.filter((o: any) => o.type === 'sell');
  
  // Calculate metrics from orders
  const calculatedBuyVolume = buyOrders.reduce((sum: number, o: any) => sum + Number(o.amount), 0);
  const calculatedSellVolume = sellOrders.reduce((sum: number, o: any) => sum + Number(o.amount), 0);
  const calculatedBuyCost = buyOrders.reduce((sum: number, o: any) => sum + Number(o.totalCost), 0);
  const calculatedSellCost = sellOrders.reduce((sum: number, o: any) => sum + Number(o.totalCost), 0);
  const calculatedPnL = calculatedSellCost - calculatedBuyCost;
  
  // Get stored metrics
  const storedBuyCost = Number(position.totalCostBuy);
  const storedSellCost = Number(position.totalCostSell);
  const storedPnL = Number(position.profitLoss);
  const storedVolume = Number(position.amount);
  
  // Detect issues
  const issues: string[] = [];
  const tolerance = 0.01;
  
  if (Math.abs(calculatedBuyCost - storedBuyCost) > tolerance) {
    issues.push(`Buy cost: calc=${calculatedBuyCost.toFixed(2)} vs stored=${storedBuyCost.toFixed(2)}`);
  }
  
  if (Math.abs(calculatedSellCost - storedSellCost) > tolerance) {
    issues.push(`Sell cost: calc=${calculatedSellCost.toFixed(2)} vs stored=${storedSellCost.toFixed(2)}`);
  }
  
  if (Math.abs(calculatedPnL - storedPnL) > tolerance) {
    issues.push(`P&L: calc=${calculatedPnL.toFixed(2)} vs stored=${storedPnL.toFixed(2)}`);
  }
  
  const expectedVolume = Math.max(calculatedBuyVolume, calculatedSellVolume);
  if (Math.abs(expectedVolume - storedVolume) > tolerance) {
    issues.push(`Volume: calc=${expectedVolume.toFixed(4)} vs stored=${storedVolume.toFixed(4)}`);
  }
  
  // Check for data quality issues
  if (orders.length === 0) {
    issues.push('No orders linked to position');
  }
  
  if (calculatedBuyVolume === 0 && calculatedSellVolume === 0) {
    issues.push('Zero volume in all orders');
  }
  
  if (isNaN(storedBuyCost) || isNaN(storedSellCost) || isNaN(storedPnL)) {
    issues.push('Invalid stored numeric values');
  }
  
  return {
    positionId: position.id,
    pair: position.pair,
    orderCount: orders.length,
    issues,
    calculatedMetrics: {
      buyVolume: calculatedBuyVolume,
      sellVolume: calculatedSellVolume,
      buyCost: calculatedBuyCost,
      sellCost: calculatedSellCost,
      pnl: calculatedPnL
    },
    storedMetrics: {
      buyVolume: calculatedBuyVolume, // We don't store buy/sell volume separately
      sellVolume: calculatedSellVolume,
      buyCost: storedBuyCost,
      sellCost: storedSellCost,
      pnl: storedPnL
    }
  };
}

function generateSummaryReport(results: ValidationResult[]) {
  console.log('\n📊 VALIDATION SUMMARY REPORT');
  console.log('='.repeat(50));
  
  const totalPositions = results.length;
  const positionsWithIssues = results.filter(r => r.issues.length > 0).length;
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  
  console.log(`📈 Total positions analyzed: ${totalPositions}`);
  console.log(`❌ Positions with issues: ${positionsWithIssues} (${(positionsWithIssues / totalPositions * 100).toFixed(1)}%)`);
  console.log(`🔍 Total issues found: ${totalIssues}`);
  console.log(`📊 Average issues per position: ${(totalIssues / totalPositions).toFixed(2)}`);
  
  // Issue type breakdown
  const issueTypes = {
    'Buy cost mismatch': 0,
    'Sell cost mismatch': 0,
    'P&L mismatch': 0,
    'Volume mismatch': 0,
    'No orders': 0,
    'Zero volume': 0,
    'Invalid data': 0
  };
  
  results.forEach(r => {
    r.issues.forEach(issue => {
      if (issue.includes('Buy cost')) issueTypes['Buy cost mismatch']++;
      else if (issue.includes('Sell cost')) issueTypes['Sell cost mismatch']++;
      else if (issue.includes('P&L')) issueTypes['P&L mismatch']++;
      else if (issue.includes('Volume')) issueTypes['Volume mismatch']++;
      else if (issue.includes('No orders')) issueTypes['No orders']++;
      else if (issue.includes('Zero volume')) issueTypes['Zero volume']++;
      else if (issue.includes('Invalid')) issueTypes['Invalid data']++;
    });
  });
  
  console.log('\n🔍 ISSUE TYPE BREAKDOWN:');
  Object.entries(issueTypes).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`${type}: ${count} positions`);
    }
  });
  
  // Most problematic pairs
  const pairIssues: Record<string, number> = {};
  results.forEach(r => {
    if (r.issues.length > 0) {
      pairIssues[r.pair] = (pairIssues[r.pair] || 0) + r.issues.length;
    }
  });
  
  const topProblematicPairs = Object.entries(pairIssues)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
  
  if (topProblematicPairs.length > 0) {
    console.log('\n🔴 TOP PROBLEMATIC PAIRS:');
    topProblematicPairs.forEach(([pair, count]) => {
      console.log(`${pair}: ${count} issues`);
    });
  }
  
  // Sample of worst positions
  const worstPositions = results
    .filter(r => r.issues.length > 0)
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 10);
  
  if (worstPositions.length > 0) {
    console.log('\n🔬 WORST POSITIONS:');
    worstPositions.forEach(pos => {
      console.log(`Position ${pos.positionId} (${pos.pair}): ${pos.issues.length} issues`);
      pos.issues.forEach(issue => console.log(`  - ${issue}`));
    });
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  if (issueTypes['Buy cost mismatch'] > 0 || issueTypes['Sell cost mismatch'] > 0) {
    console.log('- Fix cost calculation logic in EnhancedPositionAggregator');
  }
  if (issueTypes['P&L mismatch'] > 0) {
    console.log('- Ensure P&L calculation matches: sellCost - buyCost');
  }
  if (issueTypes['Volume mismatch'] > 0) {
    console.log('- Review volume calculation - should be max(buyVolume, sellVolume)');
  }
  if (issueTypes['No orders'] > 0) {
    console.log('- Investigate why positions exist without linked orders');
  }
  if (issueTypes['Zero volume'] > 0) {
    console.log('- Add validation to prevent zero-volume positions');
  }
  if (issueTypes['Invalid data'] > 0) {
    console.log('- Implement better data validation in PositionRepository');
  }
}

validatePositions()
  .then(() => console.log('\n✅ Comprehensive validation complete!'))
  .catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });