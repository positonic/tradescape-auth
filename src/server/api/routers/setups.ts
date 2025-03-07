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
}); 