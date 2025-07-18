import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const tradesRouter = createTRPCRouter({
  // Removed: syncTrades endpoint moved to pairs.syncTrades for consistency

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

      try {
        // Fetch trades from database
        const trades = await ctx.db.userTrade.findMany({
          where: { userId },
          orderBy: { time: 'desc' },
          take: limit,
          skip: offset,
        });
        
        // Get total count for pagination
        const totalCount = await ctx.db.userTrade.count({
          where: { userId },
        });
        
        console.log(`📊 Retrieved ${trades.length} trades from database for user ${userId}`);
        
        return {
          trades,
          totalCount,
          hasMore: offset + trades.length < totalCount,
        };
        
      } catch (error) {
        console.error('Failed to fetch trades:', error);
        return {
          trades: [],
          totalCount: 0,
          hasMore: false,
        };
      }
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

      try {
        // Fetch orders from database
        const orders = await ctx.db.order.findMany({
          where: { userId },
          orderBy: { time: 'desc' },
          take: limit,
          skip: offset,
        });
        
        // Get total count for pagination
        const totalCount = await ctx.db.order.count({
          where: { userId },
        });
        
        console.log(`📊 Retrieved ${orders.length} orders from database for user ${userId}`);
        
        return {
          orders,
          totalCount,
          hasMore: offset + orders.length < totalCount,
        };
        
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        return {
          orders: [],
          totalCount: 0,
          hasMore: false,
        };
      }
    }),

  getPositions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, offset } = input;

      try {
        // Fetch positions from database
        const positions = await ctx.db.position.findMany({
          where: { userId },
          orderBy: { time: 'desc' },
          take: limit,
          skip: offset,
        });
        
        // Get total count for pagination
        const totalCount = await ctx.db.position.count({
          where: { userId },
        });
        
        console.log(`📊 Retrieved ${positions.length} positions from database for user ${userId}`);
        
        return {
          positions,
          totalCount,
          hasMore: offset + positions.length < totalCount,
        };
        
      } catch (error) {
        console.error('Failed to fetch positions:', error);
        return {
          positions: [],
          totalCount: 0,
          hasMore: false,
        };
      }
    }),

  getTradesForPosition: protectedProcedure
    .input(
      z.object({
        positionId: z.number(),
      })
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
          orderBy: { time: 'desc' },
        });
        
        console.log(`📊 Retrieved ${trades.length} trades for position ${positionId} for user ${userId}`);
        
        return {
          trades,
        };
        
      } catch (error) {
        console.error('Failed to fetch trades for position:', error);
        return {
          trades: [],
        };
      }
    }),
});