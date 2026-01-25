import { config, validateConfig } from "./config.js";
import { getPrismaClient, disconnectPrisma } from "./utils/prisma.js";
import { getRedisClient, disconnectRedis } from "./utils/redis.js";
import { PriceService } from "./services/PriceService.js";
import { AlertChecker } from "./services/AlertChecker.js";
import { CandleScheduler } from "./services/CandleScheduler.js";
import {
  createSocketServer,
  startSocketServer,
} from "./socket/SocketServer.js";

// Main application state
let pricePollingInterval: ReturnType<typeof setInterval> | null = null;
let candleScheduler: CandleScheduler | null = null;

async function main(): Promise<void> {
  console.log("====================================");
  console.log("  Alert Monitoring Service");
  console.log("====================================");
  console.log("");

  // Validate config
  try {
    validateConfig();
  } catch (error) {
    console.error("[Config] Validation failed:", error);
    process.exit(1);
  }

  // Initialize connections
  console.log("[Init] Connecting to Redis...");
  const redis = getRedisClient();
  await redis.connect();

  console.log("[Init] Connecting to PostgreSQL...");
  const prisma = getPrismaClient();
  await prisma.$connect();

  // Create Socket.io server
  console.log("[Init] Creating Socket.io server...");
  const { httpServer, io } = createSocketServer();

  // Initialize services
  console.log("[Init] Initializing services...");
  const priceService = new PriceService(redis);
  const alertChecker = new AlertChecker(redis, prisma, io);
  candleScheduler = new CandleScheduler(redis, priceService, alertChecker);

  // Start Socket.io server
  await startSocketServer(httpServer, config.port);

  // Start price polling loop
  console.log(
    `[Init] Starting price polling (every ${config.pricePollIntervalMs}ms)...`,
  );
  pricePollingInterval = setInterval(async () => {
    try {
      const prices = await priceService.fetchAllPrices();
      if (prices.size > 0) {
        await alertChecker.runPriceCheckCycle(prices);
      }
    } catch (error) {
      console.error("[PricePolling] Error:", error);
    }
  }, config.pricePollIntervalMs);

  // Start candle schedulers
  console.log("[Init] Starting candle schedulers...");
  candleScheduler.start();

  console.log("");
  console.log("====================================");
  console.log("  Service is running!");
  console.log(`  Port: ${config.port}`);
  console.log(`  Price poll interval: ${config.pricePollIntervalMs}ms`);
  console.log("====================================");
  console.log("");
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully...`);

  // Stop price polling
  if (pricePollingInterval) {
    clearInterval(pricePollingInterval);
    pricePollingInterval = null;
    console.log("[Shutdown] Stopped price polling");
  }

  // Stop candle schedulers
  if (candleScheduler) {
    candleScheduler.stop();
    console.log("[Shutdown] Stopped candle schedulers");
  }

  // Disconnect from databases
  await disconnectRedis();
  console.log("[Shutdown] Disconnected from Redis");

  await disconnectPrisma();
  console.log("[Shutdown] Disconnected from PostgreSQL");

  console.log("[Shutdown] Goodbye!");
  process.exit(0);
}

// Handle shutdown signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[Fatal] Uncaught exception:", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Fatal] Unhandled rejection at:", promise, "reason:", reason);
});

// Start the service
main().catch((error) => {
  console.error("[Fatal] Failed to start:", error);
  process.exit(1);
});
