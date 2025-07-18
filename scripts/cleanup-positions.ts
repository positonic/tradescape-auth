#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupAutomatedPositions() {
  console.log('🧹 Starting cleanup of automated positions...\n');
  
  try {
    // First, get count of positions to delete
    const count = await prisma.position.count({
      where: {
        positionType: 'automated'
      }
    });
    
    console.log(`📊 Found ${count} automated positions to delete`);
    
    if (count === 0) {
      console.log('✅ No automated positions to delete');
      return;
    }
    
    // Get all automated positions with their order IDs
    const positions = await prisma.position.findMany({
      where: {
        positionType: 'automated'
      },
      include: {
        orders: {
          select: {
            id: true
          }
        }
      }
    });
    
    console.log(`🔍 Found ${positions.length} positions with ${positions.reduce((sum, p) => sum + p.orders.length, 0)} linked orders`);
    
    // First, unlink all orders from positions
    console.log('🔗 Unlinking orders from positions...');
    const unlinkResult = await prisma.order.updateMany({
      where: {
        positionId: {
          in: positions.map(p => p.id)
        }
      },
      data: {
        positionId: null
      }
    });
    
    console.log(`✅ Unlinked ${unlinkResult.count} orders from positions`);
    
    // Then delete all automated positions
    console.log('🗑️ Deleting automated positions...');
    const deleteResult = await prisma.position.deleteMany({
      where: {
        positionType: 'automated'
      }
    });
    
    console.log(`✅ Deleted ${deleteResult.count} automated positions`);
    
    // Verify cleanup
    const remainingCount = await prisma.position.count({
      where: {
        positionType: 'automated'
      }
    });
    
    if (remainingCount === 0) {
      console.log('✅ Cleanup completed successfully - no automated positions remaining');
    } else {
      console.log(`⚠️ Warning: ${remainingCount} automated positions still remain`);
    }
    
    // Show order statistics
    const ordersWithoutPosition = await prisma.order.count({
      where: {
        positionId: null
      }
    });
    
    console.log(`📊 Orders without positions: ${ordersWithoutPosition}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

await cleanupAutomatedPositions()
  .then(() => console.log('\n✅ Cleanup complete!'))
  .catch(error => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });