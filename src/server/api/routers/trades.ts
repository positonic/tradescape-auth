import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const tradesRouter = createTRPCRouter({
  // Removed: syncTrades endpoint moved to pairs.syncTrades for consistency

  getTrades: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        pairFilter: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, offset, pairFilter } = input;

      try {
        const whereClause: Prisma.UserTradeWhereInput = {
          userId,
          ...(pairFilter ? { pair: pairFilter } : {}),
        };

        // Fetch trades from database
        const trades = await ctx.db.userTrade.findMany({
          where: whereClause,
          orderBy: { time: "desc" },
          take: limit,
          skip: offset,
        });

        // Get total count for pagination
        const totalCount = await ctx.db.userTrade.count({
          where: whereClause,
        });

        console.log(
          `📊 Retrieved ${trades.length} trades from database for user ${userId}`,
        );

        return {
          trades,
          totalCount,
          hasMore: offset + trades.length < totalCount,
        };
      } catch (error) {
        console.error("Failed to fetch trades:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch trades",
          cause: error,
        });
      }
    }),

  getOrders: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        pairFilter: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, offset, pairFilter } = input;

      try {
        const whereClause: Prisma.OrderWhereInput = {
          userId,
          ...(pairFilter ? { pair: pairFilter } : {}),
        };

        // Fetch orders from database
        const orders = await ctx.db.order.findMany({
          where: whereClause,
          orderBy: { time: "desc" },
          take: limit,
          skip: offset,
        });

        // Get total count for pagination
        const totalCount = await ctx.db.order.count({
          where: whereClause,
        });

        console.log(
          `📊 Retrieved ${orders.length} orders from database for user ${userId}`,
        );

        return {
          orders,
          totalCount,
          hasMore: offset + orders.length < totalCount,
        };
      } catch (error) {
        console.error("Failed to fetch orders:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch orders",
          cause: error,
        });
      }
    }),

  getPositions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        pairFilter: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, offset, pairFilter } = input;

      try {
        const whereClause: Prisma.PositionWhereInput = {
          userId,
          ...(pairFilter ? { pair: pairFilter } : {}),
        };

        // Fetch positions from database
        const positions = await ctx.db.position.findMany({
          where: whereClause,
          orderBy: { time: "desc" },
          take: limit,
          skip: offset,
        });

        // Get total count for pagination
        const totalCount = await ctx.db.position.count({
          where: whereClause,
        });

        console.log(
          `📊 Retrieved ${positions.length} positions from database for user ${userId}`,
        );

        return {
          positions,
          totalCount,
          hasMore: offset + positions.length < totalCount,
        };
      } catch (error) {
        console.error("Failed to fetch positions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch positions",
          cause: error,
        });
      }
    }),

  getTradesForPosition: protectedProcedure
    .input(
      z.object({
        positionId: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { positionId } = input;

      try {
        // Fetch trades connected to the position through orders
        const trades = await ctx.db.userTrade.findMany({
          where: {
            userId,
            order: {
              positionId,
            },
          },
          include: {
            order: true,
          },
          orderBy: { time: "desc" },
        });

        console.log(
          `📊 Retrieved ${trades.length} trades for position ${positionId} for user ${userId}`,
        );

        return {
          trades,
        };
      } catch (error) {
        console.error("Failed to fetch trades for position:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch trades for position",
          cause: error,
        });
      }
    }),

  getOrdersForPosition: protectedProcedure
    .input(
      z.object({
        positionId: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { positionId } = input;

      try {
        // Fetch orders for the position
        const orders = await ctx.db.order.findMany({
          where: {
            userId,
            positionId,
          },
          orderBy: { time: "desc" },
        });

        console.log(
          `📊 Retrieved ${orders.length} orders for position ${positionId} for user ${userId}`,
        );

        return {
          orders,
        };
      } catch (error) {
        console.error("Failed to fetch orders for position:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch orders for position",
          cause: error,
        });
      }
    }),

  getPositionById: protectedProcedure
    .input(
      z.object({
        positionId: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { positionId } = input;

      try {
        // Fetch position details
        const position = await ctx.db.position.findFirst({
          where: {
            id: positionId,
            userId,
          },
        });

        if (!position) {
          console.log(`❌ Position ${positionId} not found for user ${userId}`);
          return null;
        }

        console.log(`📊 Retrieved position ${positionId} for user ${userId}`);

        return position;
      } catch (error) {
        console.error("Failed to fetch position:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch position",
          cause: error,
        });
      }
    }),
});
