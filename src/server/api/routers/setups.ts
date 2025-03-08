import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const setupsRouter = createTRPCRouter({
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
        console.log("input is ", input)
      // Create the setup
      const setup = await ctx.db.setup.create({
        data: {
          ...input,
          status: "active",
        },
      });

      return setup;
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const setups = await ctx.db.setup.findMany({
      include: {
        pair: true,
        video: true,
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
        }
      });

      if (!setup) {
        throw new Error('Setup not found');
      }

      return setup;
    }),
}); 