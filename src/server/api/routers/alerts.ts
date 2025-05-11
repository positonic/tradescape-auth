// src/server/api/routers/alerts.ts

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, type TRPCContext } from "~/server/api/trpc"; // Changed Context to TRPCContext
import { AlertType, Direction, AlertStatus, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { Decimal } from "@prisma/client/runtime/library";
import type Redis from "ioredis";

// Hard-coded exchange key for all alerts
const exchangeKey = 'BINANCE';

// --- TODO: Move Redis Logic to a Service File (e.g., src/server/services/redisService.ts) ---
// For now, defining helper functions here based on your reference code.
// These functions assume 'redis' client is available via ctx.redis

// Modified function that works with a pair object or with ctx+pairId
function getMarketIdentifier(pairOrSymbol: { symbol: string } | string): string {
  const symbol = typeof pairOrSymbol === 'string' 
    ? pairOrSymbol 
    : pairOrSymbol.symbol;
  
  return `${exchangeKey}:${symbol.replace('/', '')}`;
}

// Function removed as it was unused and causing lint errors.

const priceAlertZSetKey = (market: string, direction: Direction): string =>
  `price_alerts:${market.toUpperCase()}:${direction}`;

const candleAlertZSetKey = (market: string, interval: string, direction: Direction): string =>
  `candle_alerts:${market.toUpperCase()}:${interval}:${direction}`;

const alertDetailsHashKey = (alertId: string): string => `alert_details:${alertId}`;

// Define a more specific type for alerts that include the pair relationship
type AlertWithPair = Prisma.AlertGetPayload<{
  include: { pair: true }
}>;

async function addAlertToRedis(redis: Redis, alert: AlertWithPair): Promise<void> {
  if (!redis) {
    console.error("Redis client not available in context for addAlertToRedis");
    return;
  }
  
  const pipeline = redis.pipeline();
  const thresholdScore = new Decimal(alert.threshold).toNumber();
  const alertId = alert.id;
  const hashKey = alertDetailsHashKey(alertId);
  const market = getMarketIdentifier(alert.pair);

  // Store alert details in HASH
  // Explicitly construct the object for Redis to ensure correct types and remove relational data
  const alertDataForRedis: Record<string, string | number | boolean | null | undefined> = {
    id: alert.id,
    userId: alert.userId,
    pairId: alert.pairId,
    type: alert.type,
    threshold: alert.threshold.toString(), // Convert Decimal to string
    direction: alert.direction,
    status: alert.status,
    interval: alert.interval,
    createdAt: alert.createdAt.toISOString(), // Convert Date to ISO string
    // If triggeredAt and notes are part of your Alert model in schema.prisma, uncomment them:
    // triggeredAt: alert.triggeredAt?.toISOString(), 
    // notes: alert.notes, 
    market: market, // Add the market identifier
  };
  
  // Filter out null or undefined values and ensure all values are strings for HSET
  const finalAlertDataForRedis: Record<string, string> = {};
  for (const key in alertDataForRedis) {
    const value = alertDataForRedis[key];
    if (value !== undefined && value !== null) {
      finalAlertDataForRedis[key] = String(value);
    }
  }

  pipeline.hset(hashKey, finalAlertDataForRedis);

  // Add alert ID to the appropriate ZSET
  if (alert.type === AlertType.PRICE) {
    const zsetKey = priceAlertZSetKey(market, alert.direction);
    pipeline.zadd(zsetKey, thresholdScore, alertId);
  } else if (alert.type === AlertType.CANDLE && alert.interval) {
    const zsetKey = candleAlertZSetKey(market, alert.interval, alert.direction);
    pipeline.zadd(zsetKey, thresholdScore, alertId);
  } else {
    console.warn(`Skipping add to Redis ZSET: Invalid alert type or missing interval for alert ${alertId}`);
    // Execute only HSET if ZADD is skipped
     try {
      await pipeline.hset(hashKey, finalAlertDataForRedis).exec(); // Only HSET with filtered data
      console.info(`Added only HASH for alert ${alertId} to Redis.`);
    } catch (error) {
      console.error(`Error adding only HASH for alert ${alertId} to Redis:`, error);
    }
    return;
  }

  try {
    await pipeline.exec();
    console.info(`Added alert ${alertId} to Redis.`);
  } catch (error) {
    console.error(`Error adding alert ${alertId} to Redis:`, error);
    // Consider rollback/cleanup for DB entry if Redis fails?
  }
}

async function removeAlertFromRedis(redis: Redis, alert: AlertWithPair): Promise<void> {
  if (!redis) {
    console.error("Redis client not available in context for removeAlertFromRedis");
    return;
  }
  
  const pipeline = redis.pipeline();
  const alertId = alert.id;
  const hashKey = alertDetailsHashKey(alertId);
  const market = getMarketIdentifier(alert.pair);

  // Remove alert details HASH
  pipeline.del(hashKey);

  // Remove alert ID from the appropriate ZSET
  if (alert.type === AlertType.PRICE) {
    const zsetKey = priceAlertZSetKey(market, alert.direction);
    pipeline.zrem(zsetKey, alertId);
  } else if (alert.type === AlertType.CANDLE && alert.interval) {
    const zsetKey = candleAlertZSetKey(market, alert.interval, alert.direction);
    pipeline.zrem(zsetKey, alertId);
  } else {
     console.warn(`Skipping remove from Redis ZSET: Invalid alert type or missing interval for alert ${alertId}`);
    // Only execute HASH deletion if ZSET removal is skipped
    try {
      await pipeline.del(hashKey).exec();
      console.info(`Removed only HASH for alert ${alertId} from Redis.`);
    } catch (error) {
      console.error(`Error removing HASH for alert ${alertId} from Redis:`, error);
    }
    return;
  }

  try {
    await pipeline.exec();
    console.info(`Removed alert ${alertId} from Redis.`);
  } catch (error) {
    console.error(`Error removing alert ${alertId} from Redis:`, error);
  }
}

// --- End Redis Logic ---

// Zod schema for validating numeric strings
const numericString = z.string().refine((val) => !isNaN(parseFloat(val)), {
  message: "Threshold must be a valid number string",
});

// Input Schemas
const createAlertInputSchema = z.object({
  pairId: z.number(),
  type: z.nativeEnum(AlertType),
  threshold: numericString,
  direction: z.nativeEnum(Direction),
  interval: z.string().optional().nullable(),
});

const updateAlertInputSchema = z.object({
  id: z.string(),
  threshold: numericString.optional(),
  direction: z.nativeEnum(Direction).optional(),
  status: z.nativeEnum(AlertStatus).optional(),
  interval: z.string().optional().nullable(),
});

const deleteAlertInputSchema = z.object({ id: z.string() });

export const alertsRouter = createTRPCRouter({
  getAllForUser: protectedProcedure
    .query(async ({ ctx }: { ctx: TRPCContext }) => {
      const alerts = await ctx.db.alert.findMany({
        where: {
          userId: ctx.session!.user.id,
        },
        include: {
          pair: true, // Include related pair data needed for display/Redis keys
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      // Convert Decimal to string before sending to client
      return alerts.map((alert: AlertWithPair) => ({
        ...alert,
        threshold: alert.threshold.toString(),
      }));
    }),

  create: protectedProcedure
    .input(createAlertInputSchema)
    .mutation(async ({ ctx, input }: { ctx: TRPCContext, input: z.infer<typeof createAlertInputSchema> }) => {
      if (input.type === AlertType.CANDLE && !input.interval) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Interval is required for CANDLE alerts.",
        });
      }

      // Explicitly define data for Prisma create
      const createData = {
        userId: ctx.session!.user.id,
        pairId: input.pairId,
        type: input.type,
        // Convert validated string to Decimal
        threshold: new Decimal(input.threshold),
        direction: input.direction,
        interval: input.interval,
        status: AlertStatus.PENDING,
      };

      const alert = await ctx.db.alert.create({
        data: createData,
        include: { pair: true }
      });

      if (ctx.redis) {
        console.log('Redis client available, adding alert to Redis', alert);
        await addAlertToRedis(ctx.redis, alert as AlertWithPair); // Added type assertion
      } else {
        console.warn(`Redis client not available, skipping addAlertToRedis for alert ${alert.id}`);
      }

      return { ...alert, threshold: alert.threshold.toString() };
    }),

  update: protectedProcedure
    .input(updateAlertInputSchema)
    .mutation(async ({ ctx, input }: { ctx: TRPCContext, input: z.infer<typeof updateAlertInputSchema>}) => {
      const { id, ...inputData } = input;

      const currentAlert = await ctx.db.alert.findUnique({
        where: { id: id, userId: ctx.session!.user.id },
         include: { pair: true }
      });

      if (!currentAlert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found or you do not have permission to update it." });
      }

      // Explicitly build the update object for Prisma
      const updateData: { threshold?: Decimal; direction?: Direction; status?: AlertStatus; interval?: string | null } = {};
      if (inputData.threshold !== undefined) {
         // Convert validated string to Decimal
        updateData.threshold = new Decimal(inputData.threshold);
      }
      if (inputData.direction !== undefined) {
        updateData.direction = inputData.direction;
      }
      if (inputData.status !== undefined) {
        updateData.status = inputData.status;
      }
      if (inputData.interval !== undefined) {
        // Allow setting interval to null explicitly
        updateData.interval = inputData.interval;
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
          // Optionally return current alert or throw an error if no changes are made
          return { ...currentAlert, threshold: currentAlert.threshold.toString() };
      }

      const updatedAlert = await ctx.db.alert.update({
        where: { id: id, userId: ctx.session!.user.id },
        data: updateData,
        include: { pair: true }
      });

      if (ctx.redis) {
        await removeAlertFromRedis(ctx.redis, currentAlert as AlertWithPair); // Added type assertion
      } else {
         console.warn(`Redis client not available, skipping removeAlertFromRedis for alert ${currentAlert.id}`);
      }

      if (ctx.redis) {
        await addAlertToRedis(ctx.redis, updatedAlert as AlertWithPair); // Added type assertion
      } else {
        console.warn(`Redis client not available, skipping addAlertToRedis for alert ${updatedAlert.id}`);
      }

      return { ...updatedAlert, threshold: updatedAlert.threshold.toString() };
    }),

  delete: protectedProcedure
    .input(deleteAlertInputSchema)
    .mutation(async ({ ctx, input }: { ctx: TRPCContext, input: z.infer<typeof deleteAlertInputSchema> }) => {
       // 1. Fetch the alert to get details needed for Redis removal
      const alertToDelete = await ctx.db.alert.findUnique({
        where: { id: input.id, userId: ctx.session!.user.id }, // Ensure user owns the alert
        include: { pair: true } // Needed for Redis key generation
      });

      if (!alertToDelete) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found or you do not have permission to delete it." });
      }

      // 2. Delete the alert from the database
      await ctx.db.alert.delete({
        where: { id: input.id, userId: ctx.session!.user.id },
      });

      // 3. Remove the alert from Redis (if client exists)
      if (ctx.redis) {
        await removeAlertFromRedis(ctx.redis, alertToDelete as AlertWithPair); // Added type assertion
      } else {
        console.warn(`Redis client not available, skipping removeAlertFromRedis for alert ${alertToDelete.id}`);
      }

      // Return the deleted alert data (optional)
      return { ...alertToDelete, threshold: alertToDelete.threshold.toString() };
    }),
});
