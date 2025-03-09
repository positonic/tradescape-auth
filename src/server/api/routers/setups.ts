import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const setupsRouter = createTRPCRouter({
  getPairBySymbol: protectedProcedure
    .input(z.object({
      symbol: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Convert symbol to standard format (e.g., "BTC" -> "BTC/USDT")
      const pairSymbol = `${input.symbol}/USDT`;
      
      const pair = await ctx.db.pair.findUnique({
        where: { symbol: pairSymbol },
      });

      if (!pair) {
        throw new Error(`No pair found for symbol ${pairSymbol}`);
      }

      return pair;
    }),

  create: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        entryPrice: z.number().nullish(),
        takeProfitPrice: z.number().nullish(),
        stopPrice: z.number().nullish(),
        timeframe: z.string().nullish(),
        videoId: z.string().nullish(),
        pairId: z.number(),
        direction: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log("input is ", input);
      
      // Extract coin symbol from content or find from pair
      const pair = await ctx.db.pair.findUnique({
        where: { id: input.pairId },
        select: { symbol: true }
      });

      if (!pair) {
        throw new Error('Pair not found');
      }

      // Extract the base symbol (e.g., "BTC" from "BTC/USDT")
      const baseSymbol = pair.symbol.split('/')[0];
      
      // Find the corresponding coin
      const coin = await ctx.db.coin.findFirst({
        where: { symbol: baseSymbol }
      });

      if (!coin) {
        console.log(`No coin found for symbol ${baseSymbol}`);
      }

      // Create the setup with coin relationship if found
      const setup = await ctx.db.setup.create({
        data: {
          ...input,
          status: "active",
          coinId: coin?.id, // Link to coin if found
        },
        include: {
          pair: true,
          coin: true,
        },
      });

      return setup;
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const setups = await ctx.db.setup.findMany({
      include: {
        pair: true,
        video: true,
        coin: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return setups;
  }),

  getById: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const setup = await ctx.db.setup.findUnique({
        where: {
          id: input.id
        },
        include: {
          pair: true,
          video: true,
          coin: true,
        }
      });

      if (!setup) {
        throw new Error('Setup not found');
      }

      return setup;
    }),
}); 