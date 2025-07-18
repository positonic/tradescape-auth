import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PositionAnalysis {
  totalPositions: number;
  completePositions: number;
  partialPositions: number;
  buyOnlyPositions: number;
  sellOnlyPositions: number;
  positionsByPair: Record<string, number>;
  averageOrdersPerPosition: number;
  averageProfitLoss: number;
  positivePositions: number;
  negativePositions: number;
  breakEvenPositions: number;
  dataQualityIssues: number;
}

async function validatePositionCreation(): Promise<PositionAnalysis> {
  console.log('🔍 Validating position creation effectiveness...\n');

  // Get all positions with their orders
  const positions = await prisma.position.findMany({
    where: {
      positionType: 'automated'
    },
    include: {
      orders: {
        include: {
          trades: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log(`📊 Found ${positions.length} automated positions to analyze\n`);

  const analysis: PositionAnalysis = {
    totalPositions: positions.length,
    completePositions: 0,
    partialPositions: 0,
    buyOnlyPositions: 0,
    sellOnlyPositions: 0,
    positionsByPair: {},
    averageOrdersPerPosition: 0,
    averageProfitLoss: 0,
    positivePositions: 0,
    negativePositions: 0,
    breakEvenPositions: 0,
    dataQualityIssues: 0
  };

  let totalOrders = 0;
  let totalProfitLoss = 0;
  const issues: string[] = [];

  for (const position of positions) {
    const pairSymbol = position.pair;
    analysis.positionsByPair[pairSymbol] = (analysis.positionsByPair[pairSymbol] || 0) + 1;

    // Count orders in this position
    const orderCount = position.orders.length;
    totalOrders += orderCount;

    // Analyze order types
    const buyOrders = position.orders.filter(order => order.type === 'buy');
    const sellOrders = position.orders.filter(order => order.type === 'sell');

    // Calculate volumes
    const buyVolume = buyOrders.reduce((sum, order) => sum + Number(order.amount), 0);
    const sellVolume = sellOrders.reduce((sum, order) => sum + Number(order.amount), 0);

    // Classify position type
    if (buyOrders.length > 0 && sellOrders.length > 0) {
      // Check if volumes are balanced (within 1% tolerance)
      const volumeDiff = Math.abs(buyVolume - sellVolume);
      const avgVolume = (buyVolume + sellVolume) / 2;
      const balancePercentage = avgVolume > 0 ? (volumeDiff / avgVolume) * 100 : 0;
      
      if (balancePercentage <= 1) {
        analysis.completePositions++;
      } else {
        analysis.partialPositions++;
      }
    } else if (buyOrders.length > 0) {
      analysis.buyOnlyPositions++;
    } else if (sellOrders.length > 0) {
      analysis.sellOnlyPositions++;
    }

    // Analyze profit/loss
    const pnl = Number(position.profitLoss);
    totalProfitLoss += pnl;

    if (pnl > 0.01) {
      analysis.positivePositions++;
    } else if (pnl < -0.01) {
      analysis.negativePositions++;
    } else {
      analysis.breakEvenPositions++;
    }

    // Check for data quality issues
    if (orderCount === 0) {
      analysis.dataQualityIssues++;
      issues.push(`Position ${position.id} has no orders`);
    }

    if (Number(position.totalCostBuy) === 0 && Number(position.totalCostSell) === 0) {
      analysis.dataQualityIssues++;
      issues.push(`Position ${position.id} has zero costs`);
    }

    if (Number(position.amount) === 0) {
      analysis.dataQualityIssues++;
      issues.push(`Position ${position.id} has zero amount`);
    }
  }

  analysis.averageOrdersPerPosition = positions.length > 0 ? totalOrders / positions.length : 0;
  analysis.averageProfitLoss = positions.length > 0 ? totalProfitLoss / positions.length : 0;

  return analysis;
}

async function printAnalysis(analysis: PositionAnalysis) {
  console.log('📈 POSITION CREATION ANALYSIS REPORT');
  console.log('=' .repeat(50));
  
  console.log(`\n📊 OVERVIEW:`);
  console.log(`   Total Positions: ${analysis.totalPositions}`);
  console.log(`   Average Orders per Position: ${analysis.averageOrdersPerPosition.toFixed(2)}`);
  console.log(`   Average P&L per Position: $${analysis.averageProfitLoss.toFixed(2)}`);

  console.log(`\n🎯 POSITION COMPLETENESS:`);
  console.log(`   Complete Positions (buy + sell): ${analysis.completePositions} (${((analysis.completePositions / analysis.totalPositions) * 100).toFixed(1)}%)`);
  console.log(`   Partial Positions (unbalanced): ${analysis.partialPositions} (${((analysis.partialPositions / analysis.totalPositions) * 100).toFixed(1)}%)`);
  console.log(`   Buy-Only Positions: ${analysis.buyOnlyPositions} (${((analysis.buyOnlyPositions / analysis.totalPositions) * 100).toFixed(1)}%)`);
  console.log(`   Sell-Only Positions: ${analysis.sellOnlyPositions} (${((analysis.sellOnlyPositions / analysis.totalPositions) * 100).toFixed(1)}%)`);

  console.log(`\n💰 PROFITABILITY:`);
  console.log(`   Profitable Positions: ${analysis.positivePositions} (${((analysis.positivePositions / analysis.totalPositions) * 100).toFixed(1)}%)`);
  console.log(`   Losing Positions: ${analysis.negativePositions} (${((analysis.negativePositions / analysis.totalPositions) * 100).toFixed(1)}%)`);
  console.log(`   Break-Even Positions: ${analysis.breakEvenPositions} (${((analysis.breakEvenPositions / analysis.totalPositions) * 100).toFixed(1)}%)`);

  console.log(`\n📋 TOP TRADING PAIRS:`);
  const sortedPairs = Object.entries(analysis.positionsByPair)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
  
  for (const [pair, count] of sortedPairs) {
    console.log(`   ${pair}: ${count} positions`);
  }

  if (analysis.dataQualityIssues > 0) {
    console.log(`\n⚠️  DATA QUALITY ISSUES: ${analysis.dataQualityIssues}`);
  }

  console.log(`\n🎯 EFFECTIVENESS SCORE:`);
  const completenessScore = (analysis.completePositions / analysis.totalPositions) * 100;
  const profitabilityScore = (analysis.positivePositions / analysis.totalPositions) * 100;
  const dataQualityScore = Math.max(0, 100 - ((analysis.dataQualityIssues / analysis.totalPositions) * 100));
  const overallScore = (completenessScore + profitabilityScore + dataQualityScore) / 3;
  
  console.log(`   Completeness Score: ${completenessScore.toFixed(1)}%`);
  console.log(`   Profitability Score: ${profitabilityScore.toFixed(1)}%`);
  console.log(`   Data Quality Score: ${dataQualityScore.toFixed(1)}%`);
  console.log(`   Overall Effectiveness: ${overallScore.toFixed(1)}%`);

  console.log(`\n📝 RECOMMENDATIONS:`);
  if (completenessScore < 50) {
    console.log(`   ⚠️  Low completeness (${completenessScore.toFixed(1)}%) - Consider improving position matching algorithm`);
  }
  if (analysis.buyOnlyPositions + analysis.sellOnlyPositions > analysis.completePositions) {
    console.log(`   ⚠️  Many partial positions - Review time-based grouping strategy`);
  }
  if (profitabilityScore < 30) {
    console.log(`   ⚠️  Low profitability ratio - May indicate incorrect position calculations`);
  }
  if (analysis.dataQualityIssues > 0) {
    console.log(`   ⚠️  Data quality issues detected - Review data cleaning processes`);
  }
}

async function validateRecentPositions() {
  console.log('\n🔍 SAMPLE RECENT POSITIONS:');
  console.log('=' .repeat(30));

  const recentPositions = await prisma.position.findMany({
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
          time: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  });

  for (const position of recentPositions) {
    const buyOrders = position.orders.filter(o => o.type === 'buy');
    const sellOrders = position.orders.filter(o => o.type === 'sell');
    
    console.log(`\n📍 Position ${position.id} (${position.pair}):`);
    console.log(`   Status: ${position.status}`);
    console.log(`   Direction: ${position.direction}`);
    console.log(`   Amount: ${Number(position.amount).toFixed(4)}`);
    console.log(`   P&L: $${Number(position.profitLoss).toFixed(2)}`);
    console.log(`   Orders: ${position.orders.length} (${buyOrders.length} buy, ${sellOrders.length} sell)`);
    console.log(`   Duration: ${position.duration}`);
    
    if (position.orders.length > 0) {
      const firstOrder = position.orders.reduce((earliest, order) => 
        Number(order.time) < Number(earliest.time) ? order : earliest
      );
      const lastOrder = position.orders.reduce((latest, order) => 
        Number(order.time) > Number(latest.time) ? order : latest
      );
      
      console.log(`   Time Range: ${new Date(Number(firstOrder.time)).toLocaleDateString()} - ${new Date(Number(lastOrder.time)).toLocaleDateString()}`);
    }
  }
}

async function main() {
  try {
    const analysis = await validatePositionCreation();
    await printAnalysis(analysis);
    await validateRecentPositions();
  } catch (error) {
    console.error('❌ Error validating positions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script directly
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

export { validatePositionCreation, printAnalysis };