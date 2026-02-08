// src/server/api/routers/alerts.ts

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  type TRPCContext,
} from "~/server/api/trpc";
import { AlertType, Direction, AlertStatus, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Use Prisma.Decimal for Prisma 7 compatibility
const Decimal = Prisma.Decimal;
import type Redis from "ioredis";
import { randomUUID } from "crypto";
import type { ParsedAlert, AIAlertParseResult } from "~/types/alertImport";

// Hard-coded exchange key for all alerts
const exchangeKey = "BINANCE";

/** Extracts JSON from AI responses that may contain markdown code fences or surrounding text. */
function extractJSONFromText(text: string): string {
  const codeFenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(text);
  if (codeFenceMatch?.[1]) {
    return codeFenceMatch[1].trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

// --- TODO: Move Redis Logic to a Service File (e.g., src/server/services/redisService.ts) ---
// For now, defining helper functions here based on your reference code.
// These functions assume 'redis' client is available via ctx.redis

// Modified function that works with a pair object or with ctx+pairId
function getMarketIdentifier(
  pairOrSymbol: { symbol: string } | string,
): string {
  const symbol =
    typeof pairOrSymbol === "string" ? pairOrSymbol : pairOrSymbol.symbol;

  return `${exchangeKey}:${symbol.replace("/", "")}`;
}

// Function removed as it was unused and causing lint errors.

const priceAlertZSetKey = (market: string, direction: Direction): string =>
  `price_alerts:${market.toUpperCase()}:${direction}`;

const candleAlertZSetKey = (
  market: string,
  interval: string,
  direction: Direction,
): string => `candle_alerts:${market.toUpperCase()}:${interval}:${direction}`;

const alertDetailsHashKey = (alertId: string): string =>
  `alert_details:${alertId}`;

// Define a more specific type for alerts that include the pair relationship
type AlertWithPair = Prisma.AlertGetPayload<{
  include: { pair: true };
}>;

async function addAlertToRedis(
  redis: Redis,
  alert: AlertWithPair,
): Promise<void> {
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
  const alertDataForRedis: Record<
    string,
    string | number | boolean | null | undefined
  > = {
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
    console.warn(
      `Skipping add to Redis ZSET: Invalid alert type or missing interval for alert ${alertId}`,
    );
    // Execute only HSET if ZADD is skipped
    try {
      await pipeline.hset(hashKey, finalAlertDataForRedis).exec(); // Only HSET with filtered data
      console.info(`Added only HASH for alert ${alertId} to Redis.`);
    } catch (error) {
      console.error(
        `Error adding only HASH for alert ${alertId} to Redis:`,
        error,
      );
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

async function removeAlertFromRedis(
  redis: Redis,
  alert: AlertWithPair,
): Promise<void> {
  if (!redis) {
    console.error(
      "Redis client not available in context for removeAlertFromRedis",
    );
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
    console.warn(
      `Skipping remove from Redis ZSET: Invalid alert type or missing interval for alert ${alertId}`,
    );
    // Only execute HASH deletion if ZSET removal is skipped
    try {
      await pipeline.del(hashKey).exec();
      console.info(`Removed only HASH for alert ${alertId} from Redis.`);
    } catch (error) {
      console.error(
        `Error removing HASH for alert ${alertId} from Redis:`,
        error,
      );
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
  getAllForUser: protectedProcedure.query(
    async ({ ctx }: { ctx: TRPCContext }) => {
      const alerts = await ctx.db.alert.findMany({
        where: {
          userId: ctx.session!.user.id,
        },
        include: {
          pair: true, // Include related pair data needed for display/Redis keys
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      // Convert Decimal to string before sending to client
      return alerts.map((alert: AlertWithPair) => ({
        ...alert,
        threshold: alert.threshold.toString(),
      }));
    },
  ),

  create: protectedProcedure
    .input(createAlertInputSchema)
    .mutation(
      async ({
        ctx,
        input,
      }: {
        ctx: TRPCContext;
        input: z.infer<typeof createAlertInputSchema>;
      }) => {
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
          include: { pair: true },
        });

        if (ctx.redis) {
          console.log("Redis client available, adding alert to Redis", alert);
          await addAlertToRedis(ctx.redis, alert as AlertWithPair); // Added type assertion
        } else {
          console.warn(
            `Redis client not available, skipping addAlertToRedis for alert ${alert.id}`,
          );
        }

        return { ...alert, threshold: alert.threshold.toString() };
      },
    ),

  update: protectedProcedure
    .input(updateAlertInputSchema)
    .mutation(
      async ({
        ctx,
        input,
      }: {
        ctx: TRPCContext;
        input: z.infer<typeof updateAlertInputSchema>;
      }) => {
        const { id, ...inputData } = input;

        const currentAlert = await ctx.db.alert.findUnique({
          where: { id: id, userId: ctx.session!.user.id },
          include: { pair: true },
        });

        if (!currentAlert) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Alert not found or you do not have permission to update it.",
          });
        }

        // Explicitly build the update object for Prisma
        const updateData: {
          threshold?: Prisma.Decimal;
          direction?: Direction;
          status?: AlertStatus;
          interval?: string | null;
        } = {};
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
          return {
            ...currentAlert,
            threshold: currentAlert.threshold.toString(),
          };
        }

        const updatedAlert = await ctx.db.alert.update({
          where: { id: id, userId: ctx.session!.user.id },
          data: updateData,
          include: { pair: true },
        });

        if (ctx.redis) {
          await removeAlertFromRedis(ctx.redis, currentAlert as AlertWithPair); // Added type assertion
        } else {
          console.warn(
            `Redis client not available, skipping removeAlertFromRedis for alert ${currentAlert.id}`,
          );
        }

        if (ctx.redis) {
          await addAlertToRedis(ctx.redis, updatedAlert as AlertWithPair); // Added type assertion
        } else {
          console.warn(
            `Redis client not available, skipping addAlertToRedis for alert ${updatedAlert.id}`,
          );
        }

        return {
          ...updatedAlert,
          threshold: updatedAlert.threshold.toString(),
        };
      },
    ),

  delete: protectedProcedure
    .input(deleteAlertInputSchema)
    .mutation(
      async ({
        ctx,
        input,
      }: {
        ctx: TRPCContext;
        input: z.infer<typeof deleteAlertInputSchema>;
      }) => {
        // 1. Fetch the alert to get details needed for Redis removal
        const alertToDelete = await ctx.db.alert.findUnique({
          where: { id: input.id, userId: ctx.session!.user.id }, // Ensure user owns the alert
          include: { pair: true }, // Needed for Redis key generation
        });

        if (!alertToDelete) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Alert not found or you do not have permission to delete it.",
          });
        }

        // 2. Delete the alert from the database
        await ctx.db.alert.delete({
          where: { id: input.id, userId: ctx.session!.user.id },
        });

        // 3. Remove the alert from Redis (if client exists)
        if (ctx.redis) {
          await removeAlertFromRedis(ctx.redis, alertToDelete as AlertWithPair); // Added type assertion
        } else {
          console.warn(
            `Redis client not available, skipping removeAlertFromRedis for alert ${alertToDelete.id}`,
          );
        }

        // Return the deleted alert data (optional)
        return {
          ...alertToDelete,
          threshold: alertToDelete.threshold.toString(),
        };
      },
    ),

  // Parse free-form text into structured alerts using AI
  parseAlerts: protectedProcedure
    .input(z.object({ text: z.string().min(1, "Text is required") }))
    .mutation(
      async ({ ctx, input }: { ctx: TRPCContext; input: { text: string } }) => {
        // Fetch available pairs for context
        const pairs = await ctx.db.pair.findMany({
          select: { id: true, symbol: true },
        });

        const pairsContext = pairs.map((p) => p.symbol).join(", ");

        const systemPrompt = `You are an expert at extracting trading alerts from free-form text.
Analyze the following text and extract all trading alert definitions.

For each alert found, provide:
- coinSymbol: The trading pair symbol (e.g., "BTC", "ETH", "ETHBTC", "SOL")
- type: Either "PRICE" (for price alerts) or "CANDLE" (for candle close alerts)
- threshold: The price level as a number (convert "100k" to 100000, "94.2k" to 94200, etc.)
- direction: Either "ABOVE" or "BELOW"
- interval: For CANDLE alerts, the timeframe in lowercase (e.g., "4h", "1d", "1h", "15m"). Null for PRICE alerts.
- originalText: The original text snippet this alert was extracted from
- confidence: How confident you are in the parsing (high/medium/low)
- notes: Any additional context about this alert (conditions, targets, invalidation)

IMPORTANT RULES:
1. "close above/below" or "candle close" indicates a CANDLE alert
2. "price touches/reaches/hits/at" indicates a PRICE alert
3. "4H" means "4h", "Daily" means "1d", "Weekly" means "1w", "Hourly" or "1H" means "1h"
4. Extract ALL price levels mentioned, even multiple per coin
5. Convert shorthand: "100k" = 100000, "94.2k" = 94200, "~918" = 918
6. If direction isn't explicit, infer from context (targets = ABOVE, stop losses = BELOW)
7. For ratio pairs like "ETHBTC", keep them as is

Available trading pairs in our system: ${pairsContext}

Output format (JSON only):
{
  "alerts": [
    {
      "coinSymbol": "BTC",
      "type": "CANDLE",
      "threshold": 100000,
      "direction": "ABOVE",
      "interval": "4h",
      "originalText": "BTC 4H close ABOVE 100k",
      "confidence": "high",
      "notes": "Confirms resistance reclaim"
    }
  ],
  "unparseable": ["any lines that couldn't be parsed"]
}`;

        try {
          const response = await fetch(
            "https://api.anthropic.com/v1/messages",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-opus-4-6",
                max_tokens: 2000,
                temperature: 0.3,
                system: systemPrompt,
                messages: [{ role: "user", content: input.text }],
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Anthropic API request failed: ${response.status} - ${errorText}`,
            });
          }

          const data = (await response.json()) as {
            content: Array<{ type: string; text: string }>;
          };
          const textBlock = data.content.find((b) => b.type === "text");
          const rawContent = textBlock?.text ?? "{}";

          let aiResult: AIAlertParseResult;
          try {
            const cleanedContent = extractJSONFromText(rawContent);
            aiResult = JSON.parse(cleanedContent) as AIAlertParseResult;
          } catch {
            console.error("Failed to parse AI response. Raw:", rawContent);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to parse AI response as JSON",
            });
          }

          // Map AI results to ParsedAlert format with pair matching
          const parsedAlerts: ParsedAlert[] = (aiResult.alerts ?? []).map(
            (alert) => {
              // Try to match the coin symbol to a pair
              const matchedPair = mapCoinToPair(alert.coinSymbol, pairs);

              const isValid =
                matchedPair !== null &&
                !isNaN(alert.threshold) &&
                alert.threshold > 0;

              return {
                id: randomUUID(),
                coinSymbol: alert.coinSymbol,
                pairId: matchedPair?.id ?? null,
                pairSymbol: matchedPair?.symbol,
                type: alert.type,
                threshold: String(alert.threshold),
                direction: alert.direction,
                interval: alert.interval,
                originalText: alert.originalText,
                confidence: alert.confidence,
                notes: alert.notes,
                isValid,
                validationError:
                  matchedPair === null ? "No matching pair found" : undefined,
              };
            },
          );

          return {
            alerts: parsedAlerts,
            unparseable: aiResult.unparseable ?? [],
            availablePairs: pairs,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to parse alerts: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      },
    ),

  // Bulk create alerts from parsed data
  bulkCreate: protectedProcedure
    .input(
      z.object({
        alerts: z.array(
          z.object({
            pairId: z.number(),
            type: z.nativeEnum(AlertType),
            threshold: numericString,
            direction: z.nativeEnum(Direction),
            interval: z.string().optional().nullable(),
          }),
        ),
      }),
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        ctx: TRPCContext;
        input: {
          alerts: Array<{
            pairId: number;
            type: AlertType;
            threshold: string;
            direction: Direction;
            interval?: string | null;
          }>;
        };
      }) => {
        const userId = ctx.session!.user.id;
        const results = { created: 0, failed: 0, errors: [] as string[] };

        // Process alerts in a transaction for atomicity
        await ctx.db.$transaction(async (tx) => {
          for (const alertInput of input.alerts) {
            try {
              // Validate candle alerts have interval
              if (
                alertInput.type === AlertType.CANDLE &&
                !alertInput.interval
              ) {
                results.failed++;
                results.errors.push(
                  `Alert for pair ${alertInput.pairId}: Interval required for CANDLE alerts`,
                );
                continue;
              }

              const alert = await tx.alert.create({
                data: {
                  userId,
                  pairId: alertInput.pairId,
                  type: alertInput.type,
                  threshold: new Decimal(alertInput.threshold),
                  direction: alertInput.direction,
                  interval: alertInput.interval,
                  status: AlertStatus.PENDING,
                },
                include: { pair: true },
              });

              // Add to Redis if available
              if (ctx.redis) {
                await addAlertToRedis(ctx.redis, alert as AlertWithPair);
              }

              results.created++;
            } catch (error) {
              results.failed++;
              results.errors.push(
                `Alert for pair ${alertInput.pairId}: ${error instanceof Error ? error.message : "Unknown error"}`,
              );
            }
          }
        });

        return results;
      },
    ),
});

// Helper function to match coin symbol to a pair
function mapCoinToPair(
  coinSymbol: string,
  pairs: Array<{ id: number; symbol: string }>,
): { id: number; symbol: string } | null {
  const upperSymbol = coinSymbol.toUpperCase();

  // Exact match first (e.g., "ETHBTC" matches "ETHBTC")
  const exact = pairs.find((p) => p.symbol.toUpperCase() === upperSymbol);
  if (exact) return exact;

  // Try with common quote currencies
  const commonQuotes = ["USDT", "USDC", "USD", "USDT:USDT", "USDC:USDC"];
  for (const quote of commonQuotes) {
    const withQuote = pairs.find(
      (p) =>
        p.symbol.toUpperCase() === `${upperSymbol}/${quote}` ||
        p.symbol.toUpperCase() === `${upperSymbol}${quote}`,
    );
    if (withQuote) return withQuote;
  }

  // Partial match - symbol starts with the coin
  const partial = pairs.find((p) =>
    p.symbol.toUpperCase().startsWith(upperSymbol + "/"),
  );
  if (partial) return partial;

  return null;
}
