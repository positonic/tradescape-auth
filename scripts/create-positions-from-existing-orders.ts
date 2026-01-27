import { PrismaClient } from "@prisma/client";
import { EnhancedPositionAggregator } from "../src/app/tradeSync/aggregation/EnhancedPositionAggregator";
import { PositionRepository } from "../src/app/tradeSync/repositories/PositionRepository";

const prisma = new PrismaClient();

interface ScriptConfig {
  userId?: string;
  pairFilter?: string;
  strategy: "conservative" | "aggressive" | "dca";
  dryRun: boolean;
  batchSize: number;
}

async function createPositionsFromExistingOrders(
  config: ScriptConfig = {
    strategy: "aggressive",
    dryRun: false,
    batchSize: 1000,
  },
) {
  try {
    console.log("🚀 Starting position creation from existing orders...");
    console.log("📋 Configuration:", config);

    // Build where clause for orders
    const whereClause: any = {
      positionId: null, // Only orders not yet linked to positions
    };

    if (config.userId) {
      whereClause.userId = config.userId;
    }

    if (config.pairFilter) {
      whereClause.pair = {
        contains: config.pairFilter,
      };
    }

    // Get count of orders to process
    const totalOrders = await prisma.order.count({
      where: whereClause,
    });

    console.log(`📊 Found ${totalOrders} orders without positions to process`);

    if (totalOrders === 0) {
      console.log("✅ No orders need position creation");
      return;
    }

    // Get all orders without positions
    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: {
        time: "asc", // Chronological order is important for position aggregation
      },
      take: config.batchSize,
    });

    console.log(`📦 Processing ${orders.length} orders in this batch`);

    // Group orders by user for processing
    const ordersByUser = orders.reduce(
      (groups: Record<string, (typeof orders)[number][]>, order) => {
        if (!order.userId) {
          return groups;
        }

        const existing = groups[order.userId] ?? [];
        existing.push(order);
        groups[order.userId] = existing;
        return groups;
      },
      {},
    );

    console.log(
      `👥 Processing orders for ${Object.keys(ordersByUser).length} users`,
    );

    let totalPositionsCreated = 0;

    // Process each user's orders
    for (const [userId, userOrders] of Object.entries(ordersByUser)) {
      console.log(
        `\n🔄 Processing ${userOrders.length} orders for user ${userId}`,
      );

      // Create position aggregator with selected strategy
      const positionAggregator = EnhancedPositionAggregator.createForStrategy(
        config.strategy,
      );

      // Generate positions from orders
      const positions = positionAggregator.aggregate(userOrders);

      console.log(
        `📊 Generated ${positions.length} positions for user ${userId}`,
      );

      if (positions.length > 0 && !config.dryRun) {
        // Save positions to database
        const positionRepository = new PositionRepository(prisma);
        const savedPositions = await positionRepository.saveAll(
          positions,
          userId,
        );

        console.log(
          `✅ Successfully saved ${savedPositions.length} positions for user ${userId}`,
        );
        totalPositionsCreated += savedPositions.length;
      } else if (config.dryRun) {
        console.log(
          `🧪 DRY RUN: Would have created ${positions.length} positions for user ${userId}`,
        );

        // Show sample positions for review
        positions.slice(0, 3).forEach((position, index) => {
          console.log(`   Position ${index + 1}:`, {
            pair: position.pair,
            type: position.type,
            orders: position.orders.length,
            buyCost: position.buyCost,
            sellCost: position.sellCost,
            profitLoss: position.profitLoss,
            duration: position.duration,
          });
        });
      }
    }

    console.log(`\n🎉 Script completed successfully!`);
    console.log(`📈 Total positions created: ${totalPositionsCreated}`);

    if (config.dryRun) {
      console.log(
        `\n💡 This was a dry run. To actually create positions, run with dryRun: false`,
      );
    }
  } catch (error) {
    console.error("❌ Error creating positions:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to run for specific user
async function createPositionsForUser(
  userId: string,
  options: Partial<ScriptConfig> = {},
) {
  return createPositionsFromExistingOrders({
    userId,
    strategy: "aggressive",
    dryRun: false,
    batchSize: 1000,
    ...options,
  });
}

// Helper function to run for specific pair
async function createPositionsForPair(
  pairFilter: string,
  options: Partial<ScriptConfig> = {},
) {
  return createPositionsFromExistingOrders({
    pairFilter,
    strategy: "aggressive",
    dryRun: false,
    batchSize: 1000,
    ...options,
  });
}

// Helper function for dry run
async function dryRunPositionCreation(options: Partial<ScriptConfig> = {}) {
  return createPositionsFromExistingOrders({
    strategy: "aggressive",
    dryRun: true,
    batchSize: 100, // Smaller batch for dry run
    ...options,
  });
}

// Export functions for use in other scripts
export {
  createPositionsFromExistingOrders,
  createPositionsForUser,
  createPositionsForPair,
  dryRunPositionCreation,
};

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "dry-run":
      console.log("🧪 Running dry run...");
      dryRunPositionCreation()
        .then(() => process.exit(0))
        .catch((error) => {
          console.error("Script failed:", error);
          process.exit(1);
        });
      break;

    case "user":
      const userId = args[1];
      if (!userId) {
        console.error("❌ Please provide a user ID");
        process.exit(1);
      }
      console.log(`👤 Creating positions for user: ${userId}`);
      createPositionsForUser(userId)
        .then(() => process.exit(0))
        .catch((error) => {
          console.error("Script failed:", error);
          process.exit(1);
        });
      break;

    case "pair":
      const pairFilter = args[1];
      if (!pairFilter) {
        console.error('❌ Please provide a pair filter (e.g., "SOL")');
        process.exit(1);
      }
      console.log(`💰 Creating positions for pair: ${pairFilter}`);
      createPositionsForPair(pairFilter)
        .then(() => process.exit(0))
        .catch((error) => {
          console.error("Script failed:", error);
          process.exit(1);
        });
      break;

    default:
      console.log("🚀 Creating positions for all users...");
      createPositionsFromExistingOrders()
        .then(() => process.exit(0))
        .catch((error) => {
          console.error("Script failed:", error);
          process.exit(1);
        });
  }
}
