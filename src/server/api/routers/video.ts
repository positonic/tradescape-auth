import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const videoRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  // create: protectedProcedure
  //   .input(z.object({ name: z.string().min(1) }))
  //   .mutation(async ({ ctx, input }) => {
  //     return ctx.db.video.create({
  //       data: {
  //         slug: input.slug,
  //         createdBy: { connect: { id: ctx.session.user.id } },
  //       },
  //     });
  //   }),

  getLatest: protectedProcedure.query(async ({ ctx }) => {
    const video = await ctx.db.video.findFirst({
      orderBy: { createdAt: "desc" },
      //where: { createdBy: { id: ctx.session.user.id } },
    });

    return video ?? null;
  }),

  get: protectedProcedure.query(async ({ ctx }) => {
    const videos = await ctx.db.video.findMany({
      orderBy: { createdAt: "desc" },
    });

    return videos;
  }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
