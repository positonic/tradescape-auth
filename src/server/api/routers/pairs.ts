import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { initUserExchange } from "~/lib/userExchangeInit";
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
  synchExchangePairs: protectedProcedure
    .input(
      z.object({
        encryptedKeys: z.string(),
        since: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { encryptedKeys } = input;
      const userId = ctx.session.user.id;
      // const exchange = await ctx.db.exchange.findUnique({
      //   where: { id: exchangeId },
      // });
      const { userExchange, error } = await initUserExchange(
        encryptedKeys,
        userId,
      );
      if (error || !userExchange) {
        return {
          success: false,
          message: error || 'Failed to initialize exchange',
        };
      }
      console.log("userExchange", userExchange);
      // Synchronize pairs for all exchanges
      await userExchange.updateUserPairs();
      console.log("userExchange after updateUserPairs", userExchange);
      // Load the updated pairs
      const updatedPairs = await userExchange.loadUserPairs();

      return {
        success: true,
        message: 'Successfully synchronized trading pairs',
        pairs: updatedPairs,
      }
    }),
});
