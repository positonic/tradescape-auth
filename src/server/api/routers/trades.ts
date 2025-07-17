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

      // TODO: Implement once order model is added to Prisma schema
      // For now, return mock data
      return {
        orders: [],
        totalCount: 0,
        hasMore: false,
      };
    }),
});