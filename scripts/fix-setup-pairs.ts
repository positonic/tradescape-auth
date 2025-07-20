import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSetupPairs() {
  console.log('🔧 Starting to fix setup pairs...');
  
  try {
    console.log('📌 Connecting to database...');
    
    // Get all setups with their pairs
    const setups = await prisma.setup.findMany({
      include: {
        pair: true
      }
    });
    
    console.log('✅ Database connected');
    
    console.log(`📊 Found ${setups.length} setups to check`);
    
    for (const setup of setups) {
      if (setup.pair && !setup.pair.symbol.includes('/')) {
        // This pair has a simple symbol like "UNI" instead of "UNI/USDC:USDC"
        const properSymbol = `${setup.pair.symbol}/USDC:USDC`;
        
        console.log(`🔍 Setup ${setup.id} has pair symbol "${setup.pair.symbol}"`);
        
        // Check if a pair with the proper symbol already exists
        const existingProperPair = await prisma.pair.findUnique({
          where: { symbol: properSymbol }
        });
        
        if (existingProperPair) {
          // Update the setup to use the correct pair
          await prisma.setup.update({
            where: { id: setup.id },
            data: { pairId: existingProperPair.id }
          });
          console.log(`✅ Updated setup ${setup.id} to use pair ${existingProperPair.id} (${properSymbol})`);
        } else {
          // Update the existing pair's symbol
          await prisma.pair.update({
            where: { id: setup.pair.id },
            data: { symbol: properSymbol }
          });
          console.log(`✅ Updated pair ${setup.pair.id} symbol to "${properSymbol}"`);
        }
      }
    }
    
    console.log('✨ Finished fixing setup pairs!');
  } catch (error) {
    console.error('❌ Error fixing setup pairs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
await fixSetupPairs();