import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { TradeSyncService } from "~/app/tradeSync/services/TradeSyncService";
export const pairsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const pairs = await ctx.db.pair.findMany({
      select: {
        id: true,
        symbol: true,
      },
      orderBy: {
        symbol: "asc",
      },
    });
    return pairs;
  }),
  syncTrades: protectedProcedure
    .input(
      z.object({
        encryptedKeys: z.string(),
        mode: z.enum(['full', 'incremental']).optional(),
        since: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { encryptedKeys, mode, since } = input;
      const userId = ctx.session.user.id;
      
      const tradeSyncService = new TradeSyncService();
      const result = await tradeSyncService.syncTrades(userId, encryptedKeys, mode, since);
      
      return result;
    }),
});
