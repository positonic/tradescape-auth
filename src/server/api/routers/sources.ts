import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const sourcesRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const sources = await ctx.db.source.findMany({
      where: { userId: ctx.session.user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return sources;
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const name = input.name.trim();
      const source = await ctx.db.source.upsert({
        where: {
          userId_name: { userId: ctx.session.user.id, name },
        },
        create: { name, userId: ctx.session.user.id },
        update: {},
        select: { id: true, name: true },
      });
      return source;
    }),
});
