import Redis from "ioredis";
import { config } from "../config.js";

// Singleton Redis client
let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected");
    });
  }
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// Redis key patterns - must match src/server/api/routers/alerts.ts in main app
export const redisKeys = {
  // Price alert ZSET: stores alert IDs sorted by threshold
  priceAlertZSet: (market: string, direction: "ABOVE" | "BELOW"): string =>
    `price_alerts:${market.toUpperCase()}:${direction}`,

  // Candle alert ZSET: stores alert IDs sorted by threshold
  candleAlertZSet: (
    market: string,
    interval: string,
    direction: "ABOVE" | "BELOW",
  ): string => `candle_alerts:${market.toUpperCase()}:${interval}:${direction}`,

  // Alert details hash: stores full alert data
  alertDetailsHash: (alertId: string): string => `alert_details:${alertId}`,
};

// Market identifier format - must match main app
export function getMarketIdentifier(symbol: string): string {
  // Remove '/' from symbol: "BTC/USDT" -> "BTCUSDT"
  const cleanSymbol = symbol.replace("/", "");
  return `${config.exchangeKey}:${cleanSymbol}`;
}

// Interface for alert details stored in Redis hash
export interface RedisAlertDetails {
  id: string;
  userId: string;
  pairId: string;
  type: "PRICE" | "CANDLE";
  threshold: string;
  direction: "ABOVE" | "BELOW";
  status: string;
  interval: string | null;
  createdAt: string;
  market: string;
}
