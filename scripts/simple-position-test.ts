import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPositionCreation() {
  console.log('🧪 Testing position creation...');
  
  try {
    // Check how many orders exist without positions
    const ordersWithoutPositions = await prisma.order.count({
      where: {
        positionId: null
      }
    });
    
    console.log(`📦 Found ${ordersWithoutPositions} orders without positions`);

    // Check total orders
    const totalOrders = await prisma.order.count();
    console.log(`📊 Total orders in database: ${totalOrders}`);

    // Check existing positions
    const existingPositions = await prisma.position.count();
    console.log(`🏗️  Existing positions: ${existingPositions}`);

    // Sample a few orders to see their structure
    const sampleOrders = await prisma.order.findMany({
      where: {
        positionId: null
      },
      take: 3,
      orderBy: {
        time: 'asc'
      }
    });

    console.log('\n📋 Sample orders:');
    sampleOrders.forEach((order, index) => {
      console.log(`  Order ${index + 1}:`, {
        id: order.id,
        pair: order.pair,
        type: order.type,
        amount: Number(order.amount),
        time: new Date(Number(order.time)).toISOString(),
        userId: order.userId
      });
    });

    console.log('\n✅ Test completed successfully');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testPositionCreation()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });