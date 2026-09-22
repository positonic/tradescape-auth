import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { generateApiKey, maskApiKey } from "~/server/apiKeys";

const EXPIRY_DAYS = {
  "30d": 30,
  "90d": 90,
  "1y": 365,
  never: null,
} as const;

export const apiKeysRouter = createTRPCRouter({
  /**
   * Creates a key and returns the plaintext exactly once. There is no way to
   * read it back — a lost key is revoked and replaced.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100).default("CLI"),
        expiresIn: z.enum(["30d", "90d", "1y", "never"]).default("never"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { key, prefix, hashedKey } = generateApiKey();

      const days = EXPIRY_DAYS[input.expiresIn];
      const expiresAt =
        days === null ? null : new Date(Date.now() + days * 86_400_000);

      const record = await ctx.db.apiKey.create({
        data: {
          userId: ctx.session.user.id,
          name: input.name,
          prefix,
          hashedKey,
          expiresAt,
        },
      });

      return {
        id: record.id,
        name: record.name,
        /** Shown once. Store it now — it cannot be retrieved again. */
        key,
        prefix: record.prefix,
        expiresAt: record.expiresAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await ctx.db.apiKey.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      masked: maskApiKey(key.prefix),
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      expiresAt: key.expiresAt?.toISOString() ?? null,
      revokedAt: key.revokedAt?.toISOString() ?? null,
      createdAt: key.createdAt.toISOString(),
    }));
  }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.apiKey.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found.",
        });
      }

      if (existing.revokedAt) {
        return { id: existing.id, revokedAt: existing.revokedAt.toISOString() };
      }

      const revoked = await ctx.db.apiKey.update({
        where: { id: input.id },
        data: { revokedAt: new Date() },
      });

      return {
        id: revoked.id,
        revokedAt: revoked.revokedAt?.toISOString() ?? new Date().toISOString(),
      };
    }),

  /** Identity check for headless clients — the `ts status` / `ts whoami` probe. */
  whoami: protectedProcedure.query(({ ctx }) => {
    return {
      id: ctx.session.user.id,
      email: ctx.session.user.email ?? null,
      name: ctx.session.user.name ?? null,
    };
  }),
});
