import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function quickFix() {
  console.log('Quick fix for SOL trades...');
  
  // Direct SQL update to avoid hanging
  const result = await prisma.$executeRaw`
    UPDATE "UserTrade" 
    SET "pairId" = 17 
    WHERE "pair" LIKE '%SOL%' AND "pairId" IS NULL;
  `;
  
  console.log(`Updated ${result} SOL trades`);
  
  await prisma.$disconnect();
  process.exit(0);
}

quickFix().catch(console.error);