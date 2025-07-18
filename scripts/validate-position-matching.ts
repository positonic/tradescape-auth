#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PositionAnalysis {
  positionId: number;
  pair: string;
  orders: {
    id: string;
    type: string;
    amount: number;
    totalCost: number;
    time: bigint;
  }[];
  calculatedMetrics: {
    totalBuyVolume: number;
    totalSellVolume: number;
    totalBuyCost: number;
    totalSellCost: number;
    calculatedPnL: number;
    calculatedDuration: number;
  };
  storedMetrics: {
    totalCostBuy: number;
    totalCostSell: number;
    profitLoss: number;
    duration: string;
    amount: number;
  };
  discrepancies: {
    buyCostMismatch: boolean;
    sellCostMismatch: boolean;
    pnlMismatch: boolean;
    volumeMismatch: boolean;
    durationMismatch: boolean;
  };
  issues: string[];
}

async function validatePositionMatching() {
  console.log('🔍 Starting position matching validation...\n');

  try {
    console.log('📡 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Get all automated positions with their orders
    console.log('📋 Querying automated positions...');
    const positions = await prisma.position.findMany({
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
        },
        orderBy: {
          time: 'asc'
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log(`📊 Found ${positions.length} automated positions to validate\n`);

  const analyses: PositionAnalysis[] = [];
  let totalIssues = 0;

  for (const position of positions) {
    const orders = position.orders;
    
    if (orders.length === 0) {
      console.log(`⚠️  Position ${position.id} has no linked orders!`);
      continue;
    }

    // Calculate metrics from orders
    const buyOrders = orders.filter(o => o.type === 'buy');
    const sellOrders = orders.filter(o => o.type === 'sell');
    
    const totalBuyVolume = buyOrders.reduce((sum, order) => sum + Number(order.amount), 0);
    const totalSellVolume = sellOrders.reduce((sum, order) => sum + Number(order.amount), 0);
    const totalBuyCost = buyOrders.reduce((sum, order) => sum + Number(order.totalCost), 0);
    const totalSellCost = sellOrders.reduce((sum, order) => sum + Number(order.totalCost), 0);
    
    const calculatedPnL = totalSellCost - totalBuyCost;
    const calculatedDuration = orders.length > 1 ? 
      Number(orders[orders.length - 1].time) - Number(orders[0].time) : 0;

    const calculatedMetrics = {
      totalBuyVolume,
      totalSellVolume,
      totalBuyCost,
      totalSellCost,
      calculatedPnL,
      calculatedDuration
    };

    const storedMetrics = {
      totalCostBuy: Number(position.totalCostBuy),
      totalCostSell: Number(position.totalCostSell),
      profitLoss: Number(position.profitLoss),
      duration: position.duration,
      amount: Number(position.amount)
    };

    // Check for discrepancies (with tolerance for floating point)
    const tolerance = 0.001;
    const discrepancies = {
      buyCostMismatch: Math.abs(calculatedMetrics.totalBuyCost - storedMetrics.totalCostBuy) > tolerance,
      sellCostMismatch: Math.abs(calculatedMetrics.totalSellCost - storedMetrics.totalCostSell) > tolerance,
      pnlMismatch: Math.abs(calculatedMetrics.calculatedPnL - storedMetrics.profitLoss) > tolerance,
      volumeMismatch: Math.abs(Math.max(totalBuyVolume, totalSellVolume) - storedMetrics.amount) > tolerance,
      durationMismatch: false // We'll check this separately since it's formatted differently
    };

    // Identify issues
    const issues: string[] = [];
    
    if (discrepancies.buyCostMismatch) {
      issues.push(`Buy cost mismatch: calculated ${calculatedMetrics.totalBuyCost.toFixed(2)} vs stored ${storedMetrics.totalCostBuy.toFixed(2)}`);
    }
    
    if (discrepancies.sellCostMismatch) {
      issues.push(`Sell cost mismatch: calculated ${calculatedMetrics.totalSellCost.toFixed(2)} vs stored ${storedMetrics.totalCostSell.toFixed(2)}`);
    }
    
    if (discrepancies.pnlMismatch) {
      issues.push(`PnL mismatch: calculated ${calculatedMetrics.calculatedPnL.toFixed(2)} vs stored ${storedMetrics.profitLoss.toFixed(2)}`);
    }
    
    if (discrepancies.volumeMismatch) {
      issues.push(`Volume mismatch: calculated ${Math.max(totalBuyVolume, totalSellVolume).toFixed(4)} vs stored ${storedMetrics.amount.toFixed(4)}`);
    }

    // Check for data quality issues
    if (orders.some(o => isNaN(Number(o.amount)) || isNaN(Number(o.totalCost)))) {
      issues.push('Invalid numeric data in orders');
    }

    if (isNaN(storedMetrics.profitLoss) || isNaN(storedMetrics.totalCostBuy) || isNaN(storedMetrics.totalCostSell)) {
      issues.push('Invalid numeric data in position record');
    }

    // Check for logical inconsistencies
    if (buyOrders.length === 0 && sellOrders.length === 0) {
      issues.push('Position has no buy or sell orders');
    }

    if (totalBuyVolume === 0 && totalSellVolume === 0) {
      issues.push('Position has zero volume');
    }

    const analysis: PositionAnalysis = {
      positionId: position.id,
      pair: position.pair,
      orders: orders.map(o => ({
        id: o.id,
        type: o.type,
        amount: Number(o.amount),
        totalCost: Number(o.totalCost),
        time: o.time
      })),
      calculatedMetrics,
      storedMetrics,
      discrepancies,
      issues
    };

    analyses.push(analysis);

    if (issues.length > 0) {
      totalIssues += issues.length;
      console.log(`❌ Position ${position.id} (${position.pair}) has ${issues.length} issues:`);
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('');
    }
  }

  // Summary statistics
  console.log('\n📊 VALIDATION SUMMARY:');
  console.log(`Total positions analyzed: ${analyses.length}`);
  console.log(`Positions with issues: ${analyses.filter(a => a.issues.length > 0).length}`);
  console.log(`Total issues found: ${totalIssues}`);
  
  // Issue breakdown
  const issueBreakdown = {
    buyCostMismatch: analyses.filter(a => a.discrepancies.buyCostMismatch).length,
    sellCostMismatch: analyses.filter(a => a.discrepancies.sellCostMismatch).length,
    pnlMismatch: analyses.filter(a => a.discrepancies.pnlMismatch).length,
    volumeMismatch: analyses.filter(a => a.discrepancies.volumeMismatch).length,
    invalidData: analyses.filter(a => a.issues.some(i => i.includes('Invalid numeric data'))).length,
    logicalInconsistencies: analyses.filter(a => a.issues.some(i => i.includes('zero volume') || i.includes('no buy or sell'))).length
  };

  console.log('\n🔍 ISSUE BREAKDOWN:');
  Object.entries(issueBreakdown).forEach(([issue, count]) => {
    if (count > 0) {
      console.log(`${issue}: ${count} positions`);
    }
  });

  // Top problematic pairs
  const pairIssues: Record<string, number> = {};
  analyses.forEach(a => {
    if (a.issues.length > 0) {
      pairIssues[a.pair] = (pairIssues[a.pair] || 0) + a.issues.length;
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

  // Sample of problematic positions for detailed analysis
  const sampleProblematicPositions = analyses
    .filter(a => a.issues.length > 0)
    .slice(0, 5);

  if (sampleProblematicPositions.length > 0) {
    console.log('\n🔬 SAMPLE PROBLEMATIC POSITIONS:');
    sampleProblematicPositions.forEach(analysis => {
      console.log(`\nPosition ${analysis.positionId} (${analysis.pair}):`);
      console.log(`  Orders: ${analysis.orders.length} (${analysis.orders.filter(o => o.type === 'buy').length} buy, ${analysis.orders.filter(o => o.type === 'sell').length} sell)`);
      console.log(`  Calculated: Buy=${analysis.calculatedMetrics.totalBuyCost.toFixed(2)}, Sell=${analysis.calculatedMetrics.totalSellCost.toFixed(2)}, PnL=${analysis.calculatedMetrics.calculatedPnL.toFixed(2)}`);
      console.log(`  Stored: Buy=${analysis.storedMetrics.totalCostBuy.toFixed(2)}, Sell=${analysis.storedMetrics.totalCostSell.toFixed(2)}, PnL=${analysis.storedMetrics.profitLoss.toFixed(2)}`);
      console.log(`  Issues: ${analysis.issues.join(', ')}`);
    });
  }

  // Accuracy metrics
  const accuratePositions = analyses.filter(a => a.issues.length === 0).length;
  const accuracyRate = analyses.length > 0 ? (accuratePositions / analyses.length) * 100 : 0;

  console.log('\n📈 ACCURACY METRICS:');
  console.log(`Accurate positions: ${accuratePositions}/${analyses.length} (${accuracyRate.toFixed(1)}%)`);
  console.log(`Average issues per position: ${analyses.length > 0 ? (totalIssues / analyses.length).toFixed(2) : 0}`);

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (issueBreakdown.buyCostMismatch > 0 || issueBreakdown.sellCostMismatch > 0) {
    console.log('- Review cost calculation logic in position aggregation');
  }
  if (issueBreakdown.pnlMismatch > 0) {
    console.log('- Fix P&L calculation - ensure it matches sell cost minus buy cost');
  }
  if (issueBreakdown.volumeMismatch > 0) {
    console.log('- Review volume calculation - should be max of buy/sell volumes for positions');
  }
  if (issueBreakdown.invalidData > 0) {
    console.log('- Implement better data validation and sanitization');
  }
  if (issueBreakdown.logicalInconsistencies > 0) {
    console.log('- Add validation to prevent creating positions with no meaningful data');
  }

  await prisma.$disconnect();
  return analyses;
  
  } catch (error) {
    console.error('❌ Database error:', error);
    await prisma.$disconnect();
    throw error;
  }
}

// Run the validation
validatePositionMatching()
  .then(() => {
    console.log('\n✅ Validation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });

export { validatePositionMatching };