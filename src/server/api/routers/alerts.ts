import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const alertsRouter = createTRPCRouter({
  getAllForUser: protectedProcedure
    .query(async ({ ctx }) => {
      const alerts = await ctx.db.alert.findMany({
        where: {
          userId: ctx.session.user.id,
        },
        include: {
          pair: true, // Include related pair data
        },
        orderBy: {
          createdAt: 'desc', // Order by newest first
        },
      });
      return alerts;
    }),

  // Add other alert-related procedures here (e.g., create, delete)
}); 