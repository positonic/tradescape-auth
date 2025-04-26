import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const pairsRouter = createTRPCRouter({
  getAll: publicProcedure
    .query(async ({ ctx }) => {
      const pairs = await ctx.db.pair.findMany({
        select: {
          id: true,
          symbol: true,
        },
        orderBy: {
          symbol: 'asc',
        },
      });
      return pairs;
    }),
}); 