import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeSymbol(symbol: string): string {
  // Convert "SOL/USDC:USDC" to "SOL/USDC"
  // Convert "BTC/USDC:USDC" to "BTC/USDC"
  return symbol.split(':')[0] || symbol;
}

function extractBaseSymbol(symbol: string): string {
  // Extract base symbol: "SOL/USDC:USDC" -> "SOL"
  const normalized = normalizeSymbol(symbol);
  return normalized.split('/')[0] || normalized;
}

async function populateUserTradePairIds() {
  try {
    console.log('Starting to populate UserTrade pairId values...');
    
    // Get all UserTrades that don't have a pairId set
    const userTrades = await prisma.userTrade.findMany({
      where: {
        pairId: null
      },
      select: {
        id: true,
        pair: true
      }
    });
    
    console.log(`Found ${userTrades.length} UserTrades without pairId`);
    
    if (userTrades.length === 0) {
      console.log('No UserTrades need pairId population');
      return;
    }
    
    // Get all existing pairs
    const allPairs = await prisma.pair.findMany({
      select: {
        id: true,
        symbol: true
      }
    });
    
    console.log(`Found ${allPairs.length} existing Pair records`);
    
    let updated = 0;
    let notFound = 0;
    let created = 0;
    
    // Group trades by normalized symbol for efficiency
    const tradesBySymbol = new Map<string, { id: number; pair: string }[]>();
    
    for (const userTrade of userTrades) {
      const normalizedSymbol = normalizeSymbol(userTrade.pair);
      const baseSymbol = extractBaseSymbol(userTrade.pair);
      
      if (!tradesBySymbol.has(normalizedSymbol)) {
        tradesBySymbol.set(normalizedSymbol, []);
      }
      tradesBySymbol.get(normalizedSymbol)!.push(userTrade);
      
      // Also try base symbol matching
      if (!tradesBySymbol.has(baseSymbol)) {
        tradesBySymbol.set(baseSymbol, []);
      }
      tradesBySymbol.get(baseSymbol)!.push(userTrade);
    }
    
    console.log(`Processing ${tradesBySymbol.size} unique symbols`);
    
    for (const [symbol, trades] of tradesBySymbol) {
      console.log(`Processing symbol: ${symbol} (${trades.length} trades)`);
      
      // Try to find matching Pair record by exact symbol match
      let pairRecord = allPairs.find(p => p.symbol === symbol);
      
      if (!pairRecord) {
        // Try creating a new Pair record
        try {
          pairRecord = await prisma.pair.create({
            data: {
              symbol,
              baseCoinId: 1,  // Default base coin
              quoteCoinId: 1, // Default quote coin
            }
          });
          console.log(`📝 Created new Pair record for ${symbol}`);
          created++;
        } catch (error) {
          console.log(`❌ Could not create Pair for ${symbol}:`, error);
          notFound += trades.length;
          continue;
        }
      }
      
      // Update all trades for this symbol
      for (const trade of trades) {
        try {
          await prisma.userTrade.update({
            where: {
              id: trade.id
            },
            data: {
              pairId: pairRecord.id
            }
          });
          updated++;
        } catch (error) {
          console.log(`❌ Failed to update trade ${trade.id}:`, error);
          notFound++;
        }
      }
      
      console.log(`✅ Updated ${trades.length} trades for ${symbol} with pairId ${pairRecord.id}`);
    }
    
    console.log(`\n📊 Final Results:`);
    console.log(`✅ Updated ${updated} UserTrades with pairId`);
    console.log(`📝 Created ${created} new Pair records`);
    console.log(`⚠️  ${notFound} UserTrades could not be processed`);
    
  } catch (error) {
    console.error('Error populating UserTrade pairIds:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

populateUserTradePairIds()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });