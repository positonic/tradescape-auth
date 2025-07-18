import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Checking database connection...');
  
  try {
    // Simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful:', result);
    
    // Quick count
    const orderCount = await prisma.order.count();
    console.log(`📊 Orders in database: ${orderCount}`);
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('👋 Disconnected from database');
  }
}

checkDatabase()
  .then(() => {
    console.log('✅ Check completed');
    process.exit(0);
  })
  .catch(() => {
    console.error('❌ Check failed');
    process.exit(1);
  });