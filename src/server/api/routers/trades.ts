import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { initUserExchange } from "~/lib/userExchangeInit";
import { decryptFromTransmission, validateKeys } from "~/lib/keyEncryption";
import type { TradeResponseData } from "~/lib/tradeUtils";

export const tradesRouter = createTRPCRouter({
  syncTrades: protectedProcedure
    .input(
      z.object({
        encryptedKeys: z.string(),
        since: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }): Promise<TradeResponseData> => {
      try {
        const userId = ctx.session.user.id;
        const { encryptedKeys, since } = input;

        // Decrypt the keys
        const decryptedKeys = decryptFromTransmission(encryptedKeys);
        if (!decryptedKeys) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or expired encrypted keys",
          });
        }

        // Validate keys
        const validationErrors = validateKeys(decryptedKeys);
        if (validationErrors.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid keys: ${validationErrors.join(', ')}`,
          });
        }

        console.log('Sync trades called for user:', userId);
        console.log('Number of exchanges:', decryptedKeys.length);
        console.log('Exchanges:', decryptedKeys.map(k => k.exchange));
        console.log('Since timestamp:', since);

        // TODO: Implement actual trade sync logic once tradeSync dependencies are resolved
        // For now, return mock data
        return {
          trades: [],
          orders: [],
          positions: [],
          error: 'Trade sync functionality is not yet implemented',
        };
      } catch (error) {
        console.error('Failed to process trade-sync request:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process trade-sync request",
        });
      }
    }),

  getTrades: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, offset } = input;

      // TODO: Implement once userTrade model is added to Prisma schema
      // For now, return mock data
      return {
        trades: [],
        totalCount: 0,
        hasMore: false,
      };
    }),

  getOrders: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, offset } = input;

      // TODO: Implement once order model is added to Prisma schema
      // For now, return mock data
      return {
        orders: [],
        totalCount: 0,
        hasMore: false,
      };
    }),
});