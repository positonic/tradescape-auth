import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSetupPairs() {
  try {
    // Get all setups with their pairs
    const setups = await prisma.setup.findMany({
      include: {
        pair: true
      },
      take: 10 // Just check first 10
    });
    
    console.log(`\n📊 Checking first ${setups.length} setups:\n`);
    
    for (const setup of setups) {
      if (setup.pair) {
        const needsFix = !setup.pair.symbol.includes('/');
        console.log(`Setup ID: ${setup.id}`);
        console.log(`  Pair ID: ${setup.pairId}`);
        console.log(`  Pair Symbol: ${setup.pair.symbol}`);
        console.log(`  Needs Fix: ${needsFix ? '❌ YES' : '✅ NO'}`);
        console.log('---');
      }
    }
    
    // Count total that need fixing
    const allPairs = await prisma.pair.findMany();
    const needsFixing = allPairs.filter(p => !p.symbol.includes('/')).length;
    console.log(`\n📈 Total pairs needing fix: ${needsFixing} out of ${allPairs.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
await checkSetupPairs();