// Environment configuration for the alert service

export const config = {
  // Server
  port: parseInt(process.env.PORT ?? "3001", 10),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",

  // Database
  databaseUrl: process.env.DATABASE_URL ?? "",

  // Redis
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  // Price polling
  pricePollIntervalMs: parseInt(
    process.env.PRICE_POLL_INTERVAL_MS ?? "5000",
    10,
  ),

  // Exchange (hardcoded to match main app)
  exchangeKey: "BINANCE",
} as const;

// Validate required config
export function validateConfig(): void {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }
}
