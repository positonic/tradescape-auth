import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateSolTrades() {
  try {
    console.log('Starting to populate SOL trades...');
    
    // Find the SOL Pair record
    const solPair = await prisma.pair.findUnique({
      where: { symbol: 'SOL' }
    });
    
    if (!solPair) {
      console.log('No SOL pair found in database');
      return;
    }
    
    console.log(`Found SOL pair with ID: ${solPair.id}`);
    
    // Find all trades containing SOL
    const solTrades = await prisma.userTrade.findMany({
      where: {
        pair: {
          contains: 'SOL'
        },
        pairId: null
      },
      select: {
        id: true,
        pair: true
      }
    });
    
    console.log(`Found ${solTrades.length} SOL trades without pairId`);
    
    if (solTrades.length === 0) {
      console.log('No SOL trades to update');
      return;
    }
    
    // Update all SOL trades to use the SOL pair ID
    const result = await prisma.userTrade.updateMany({
      where: {
        pair: {
          contains: 'SOL'
        },
        pairId: null
      },
      data: {
        pairId: solPair.id
      }
    });
    
    console.log(`✅ Updated ${result.count} SOL trades with pairId ${solPair.id}`);
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

populateSolTrades()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });