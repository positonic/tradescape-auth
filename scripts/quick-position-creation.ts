import { PrismaClient } from '@prisma/client';
import { EnhancedPositionAggregator } from '../src/app/tradeSync/aggregation/EnhancedPositionAggregator';
import { PositionRepository } from '../src/app/tradeSync/repositories/PositionRepository';

const prisma = new PrismaClient();

async function quickPositionCreation() {
  console.log('🚀 Quick position creation script starting...');
  
  try {
    // Find orders without positions
    const orders = await prisma.order.findMany({
      where: {
        positionId: null
      },
      orderBy: {
        time: 'asc'
      }
    });

    console.log(`📦 Found ${orders.length} orders without positions`);

    if (orders.length === 0) {
      console.log('✅ No orders need position creation');
      return;
    }

    // Group by user
    const userOrderMap = new Map<string, any[]>();
    for (const order of orders) {
      if (!userOrderMap.has(order.userId)) {
        userOrderMap.set(order.userId, []);
      }
      userOrderMap.get(order.userId)!.push(order);
    }

    console.log(`👥 Processing ${userOrderMap.size} users`);

    let totalPositions = 0;

    // Process each user
    for (const [userId, userOrders] of userOrderMap) {
      console.log(`\n🔄 Processing ${userOrders.length} orders for user ${userId}`);

      // Create aggregator
      const aggregator = EnhancedPositionAggregator.createForStrategy('aggressive');
      
      // Generate positions
      const positions = aggregator.aggregate(userOrders);
      
      console.log(`📊 Generated ${positions.length} positions`);

      if (positions.length > 0) {
        // Save to database
        const positionRepo = new PositionRepository(prisma);
        const saved = await positionRepo.saveAll(positions, userId);
        
        console.log(`✅ Saved ${saved.length} positions`);
        totalPositions += saved.length;
      }
    }

    console.log(`\n🎉 Script completed! Created ${totalPositions} total positions`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
quickPositionCreation()
  .then(() => {
    console.log('✅ Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });