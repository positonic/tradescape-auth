import type Redis from "ioredis";
import type { PrismaClient } from "@prisma/client";
import type { Server as SocketServer } from "socket.io";
import { redisKeys, type RedisAlertDetails } from "../utils/redis.js";

export interface TriggeredAlert {
  id: string;
  userId: string;
  symbol: string;
  threshold: string;
  direction: "ABOVE" | "BELOW";
  type: "PRICE" | "CANDLE";
  interval?: string | null;
  triggeredPrice: number;
}

export class AlertChecker {
  private redis: Redis;
  private prisma: PrismaClient;
  private io: SocketServer;

  constructor(redis: Redis, prisma: PrismaClient, io: SocketServer) {
    this.redis = redis;
    this.prisma = prisma;
    this.io = io;
  }

  /**
   * Check price alerts for a given market and current price
   */
  async checkPriceAlerts(
    market: string,
    currentPrice: number,
  ): Promise<TriggeredAlert[]> {
    const triggered: TriggeredAlert[] = [];

    // Check ABOVE alerts: trigger when price >= threshold
    // ZRANGEBYSCORE returns all alerts where threshold <= currentPrice
    const aboveKey = redisKeys.priceAlertZSet(market, "ABOVE");
    const aboveAlertIds = await this.redis.zrangebyscore(
      aboveKey,
      "-inf",
      currentPrice.toString(),
    );

    for (const alertId of aboveAlertIds) {
      const alert = await this.processTriggeredAlert(
        alertId,
        currentPrice,
        aboveKey,
      );
      if (alert) triggered.push(alert);
    }

    // Check BELOW alerts: trigger when price <= threshold
    // ZRANGEBYSCORE returns all alerts where threshold >= currentPrice
    const belowKey = redisKeys.priceAlertZSet(market, "BELOW");
    const belowAlertIds = await this.redis.zrangebyscore(
      belowKey,
      currentPrice.toString(),
      "+inf",
    );

    for (const alertId of belowAlertIds) {
      const alert = await this.processTriggeredAlert(
        alertId,
        currentPrice,
        belowKey,
      );
      if (alert) triggered.push(alert);
    }

    return triggered;
  }

  /**
   * Check candle close alerts for a given market, interval, and close price
   */
  async checkCandleAlerts(
    market: string,
    interval: string,
    closePrice: number,
  ): Promise<TriggeredAlert[]> {
    const triggered: TriggeredAlert[] = [];

    // Check ABOVE alerts
    const aboveKey = redisKeys.candleAlertZSet(market, interval, "ABOVE");
    const aboveAlertIds = await this.redis.zrangebyscore(
      aboveKey,
      "-inf",
      closePrice.toString(),
    );

    for (const alertId of aboveAlertIds) {
      const alert = await this.processTriggeredAlert(
        alertId,
        closePrice,
        aboveKey,
      );
      if (alert) triggered.push(alert);
    }

    // Check BELOW alerts
    const belowKey = redisKeys.candleAlertZSet(market, interval, "BELOW");
    const belowAlertIds = await this.redis.zrangebyscore(
      belowKey,
      closePrice.toString(),
      "+inf",
    );

    for (const alertId of belowAlertIds) {
      const alert = await this.processTriggeredAlert(
        alertId,
        closePrice,
        belowKey,
      );
      if (alert) triggered.push(alert);
    }

    return triggered;
  }

  /**
   * Process a triggered alert: update DB, remove from Redis, send notification
   */
  private async processTriggeredAlert(
    alertId: string,
    triggeredPrice: number,
    zsetKey: string,
  ): Promise<TriggeredAlert | null> {
    try {
      // Get alert details from Redis hash
      const hashKey = redisKeys.alertDetailsHash(alertId);
      const details = await this.redis.hgetall(hashKey);

      if (!details || !details.id) {
        console.warn(`[AlertChecker] Alert ${alertId} not found in Redis hash`);
        // Clean up orphaned ZSET entry
        await this.redis.zrem(zsetKey, alertId);
        return null;
      }

      const alertDetails = details as unknown as RedisAlertDetails;

      // Verify alert is still PENDING in database
      const dbAlert = await this.prisma.alert.findUnique({
        where: { id: alertId },
        include: { pair: true },
      });

      if (!dbAlert || dbAlert.status !== "PENDING") {
        console.log(`[AlertChecker] Alert ${alertId} is not PENDING, skipping`);
        // Clean up Redis entries
        await this.redis.zrem(zsetKey, alertId);
        await this.redis.del(hashKey);
        return null;
      }

      // Update database status to TRIGGERED
      await this.prisma.alert.update({
        where: { id: alertId },
        data: {
          status: "TRIGGERED",
          // triggeredAt: new Date(), // Uncomment if you add this field to schema
        },
      });

      // Remove from Redis (prevent re-triggering)
      await this.redis.zrem(zsetKey, alertId);
      await this.redis.del(hashKey);

      const triggeredAlert: TriggeredAlert = {
        id: alertId,
        userId: alertDetails.userId,
        symbol: dbAlert.pair.symbol,
        threshold: alertDetails.threshold,
        direction: alertDetails.direction as "ABOVE" | "BELOW",
        type: alertDetails.type as "PRICE" | "CANDLE",
        interval: alertDetails.interval,
        triggeredPrice,
      };

      // Send notification via Socket.io
      this.sendNotification(triggeredAlert);

      console.log(
        `[AlertChecker] Triggered alert ${alertId}: ${triggeredAlert.symbol} ${triggeredAlert.direction} ${triggeredAlert.threshold} (current: ${triggeredPrice})`,
      );

      return triggeredAlert;
    } catch (error) {
      console.error(`[AlertChecker] Error processing alert ${alertId}:`, error);
      return null;
    }
  }

  /**
   * Send notification to user via Socket.io
   */
  private sendNotification(alert: TriggeredAlert): void {
    const notification = {
      asset: alert.symbol,
      threshold: alert.threshold,
      direction: alert.direction.toLowerCase(),
      type: alert.type,
      triggeredPrice: alert.triggeredPrice,
      interval: alert.interval,
    };

    // Emit to user's room
    this.io
      .of("/alerts")
      .to(`user:${alert.userId}`)
      .emit("notification", notification);

    console.log(
      `[AlertChecker] Sent notification to user:${alert.userId}`,
      notification,
    );
  }

  /**
   * Run a full check cycle for all price alerts
   */
  async runPriceCheckCycle(
    prices: Map<string, number>,
  ): Promise<TriggeredAlert[]> {
    const allTriggered: TriggeredAlert[] = [];

    for (const [market, price] of prices) {
      const triggered = await this.checkPriceAlerts(market, price);
      allTriggered.push(...triggered);
    }

    if (allTriggered.length > 0) {
      console.log(
        `[AlertChecker] Price check cycle: ${allTriggered.length} alerts triggered`,
      );
    }

    return allTriggered;
  }
}
