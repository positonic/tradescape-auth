import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { PortfolioSnapshotService } from "~/server/services/balanceSnapshotService";
import { TRPCError } from "@trpc/server";

const snapshotFiltersSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  exchange: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const portfolioSnapshotRouter = createTRPCRouter({
  /**
   * Create a snapshot from current live data or direct exchange fetch
   */
  create: protectedProcedure
    .input(
      z
        .object({
          encryptedKeys: z.string().optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log("Creating snapshot", input);
        console.log("Encrypted keys", input?.encryptedKeys);
        console.log("ctx.session.user.id ", ctx.session.user.id);
        const service = new PortfolioSnapshotService(ctx.db);
        const snapshot = await service.captureSnapshot(
          ctx.session.user.id,
          input?.encryptedKeys,
        );

        return {
          success: true,
          snapshot,
        };
      } catch (error) {
        console.error("Failed to create portfolio snapshot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to create snapshot",
        });
      }
    }),

  /**
   * Get list of snapshots with optional filters
   */
  list: protectedProcedure
    .input(snapshotFiltersSchema)
    .query(async ({ ctx, input }) => {
      try {
        const service = new PortfolioSnapshotService(ctx.db);
        const snapshots = await service.getSnapshots(ctx.session.user.id, {
          startDate: input.startDate,
          endDate: input.endDate,
          exchange: input.exchange,
          limit: input.limit,
          offset: input.offset,
        });

        return {
          snapshots,
          total: snapshots.length,
        };
      } catch (error) {
        console.error("Failed to get snapshots:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve snapshots",
        });
      }
    }),

  /**
   * Get a specific snapshot by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        snapshotId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = new PortfolioSnapshotService(ctx.db);
        const snapshot = await service.getSnapshot(
          input.snapshotId,
          ctx.session.user.id,
        );

        if (!snapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Snapshot not found",
          });
        }

        return snapshot;
      } catch (error) {
        console.error("Failed to get snapshot:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve snapshot",
        });
      }
    }),

  /**
   * Compare two snapshots
   */
  compare: protectedProcedure
    .input(
      z.object({
        previousSnapshotId: z.string(),
        currentSnapshotId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = new PortfolioSnapshotService(ctx.db);
        const comparison = await service.compareSnapshots(
          ctx.session.user.id,
          input.previousSnapshotId,
          input.currentSnapshotId,
        );

        return comparison;
      } catch (error) {
        console.error("Failed to compare snapshots:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to compare snapshots",
        });
      }
    }),

  /**
   * Delete a snapshot
   */
  delete: protectedProcedure
    .input(
      z.object({
        snapshotId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = new PortfolioSnapshotService(ctx.db);
        const deleted = await service.deleteSnapshot(
          input.snapshotId,
          ctx.session.user.id,
        );

        if (!deleted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Snapshot not found or already deleted",
          });
        }

        return { success: true };
      } catch (error) {
        console.error("Failed to delete snapshot:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete snapshot",
        });
      }
    }),

  /**
   * Get recent snapshots for quick comparison
   */
  getRecent: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(10).default(5),
        exchange: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = new PortfolioSnapshotService(ctx.db);
        const snapshots = await service.getSnapshots(ctx.session.user.id, {
          exchange: input.exchange,
          limit: input.limit,
          offset: 0,
        });

        return snapshots;
      } catch (error) {
        console.error("Failed to get recent snapshots:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve recent snapshots",
        });
      }
    }),

  /**
   * Clean up old snapshots
   */
  cleanup: protectedProcedure
    .input(
      z.object({
        retentionDays: z.number().min(1).max(365).default(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = new PortfolioSnapshotService(ctx.db);
        const deletedCount = await service.cleanupOldSnapshots(
          ctx.session.user.id,
          input.retentionDays,
        );

        return {
          success: true,
          deletedCount,
        };
      } catch (error) {
        console.error("Failed to cleanup snapshots:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cleanup old snapshots",
        });
      }
    }),
});
