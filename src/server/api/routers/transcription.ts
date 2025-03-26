import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from '@trpc/server';
import { getSetups } from "~/server/services/videoService";

// Keep in-memory store for development/debugging
const transcriptionStore: Record<string, string[]> = {};

// Helper to print the store nicely
const logStore = () => {
  console.log('\n🎙️ ================== Transcription Store ==================');
  console.log(JSON.stringify(transcriptionStore, null, 2));
  console.log('🎙️ =====================================================\n');
};

// Middleware to check API key
const apiKeyMiddleware = publicProcedure.use(async ({ ctx, next }) => {
  const apiKey = ctx.headers.get('x-api-key');
  
  if (!apiKey) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'API key is required',
    });
  }

  console.log('AA apiKey', apiKey);
  // Find the verification token and associated user
  const verificationToken = await ctx.db.verificationToken.findFirst({
    where: {
      token: apiKey
    },
  });
  console.log('AA verificationToken', verificationToken);
  
  if (!verificationToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired API key',
    });
  }

  // Add the user to the context for use in the procedures
  return next({
    ctx: {
      ...ctx,
      userId: verificationToken.userId,
    },
  });
});

export const transcriptionRouter = createTRPCRouter({
  startSession: apiKeyMiddleware
    .mutation(async ({ ctx }) => {
      // Create record in database using ctx.db
      const session = await ctx.db.transcriptionSession.create({
        data: {
          sessionId: `session_${Date.now()}`, // Keep this as a reference
          transcription: "", // Start with empty transcription
          userId: ctx.userId, // Add the userId from the middleware
        },
      });
      
      // Keep in-memory store for debugging
      transcriptionStore[session.id] = [];
      console.log('\n🎙️ New session started:', session.id);
      logStore();
      
      return {
        id: session.id, // Return the database ID
        startTime: new Date().toISOString(),
      };
    }),

  saveTranscription: apiKeyMiddleware
    .input(z.object({
      id: z.string(),
      transcription: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, transcription } = input;
      
      // Update database using ctx.db
      await ctx.db.transcriptionSession.update({
        where: { id },
        data: { 
          transcription,
          updatedAt: new Date(),
        },
      });
      
      // Keep in-memory store for debugging
      if (!transcriptionStore[id]) {
        transcriptionStore[id] = [];
      }
      transcriptionStore[id].push(transcription);
      
      console.log('\n🎙️ Saved transcription for session:', id);
      logStore();

      return {
        success: true,
        id,
        savedAt: new Date().toISOString(),
      };
    }),

  getSessions: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.transcriptionSession.findMany({
        where: {
          userId: ctx.session.user.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    }),

  getById: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.transcriptionSession.findUnique({
        where: { id: input.id },
        include: { user: true }
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found'
        });
      }

      if (session.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to view this session'
        });
      }

      return session;
    }),

  createSetups: protectedProcedure
    .input(z.object({
      transcriptionId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.transcriptionSession.findUnique({
        where: { id: input.transcriptionId }
      });

      if (!session?.transcription) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No transcription found'
        });
      }

      // Get setups from transcription
      const setupsData = await getSetups(session.transcription, 'trade-setups');
      
      // Create setups for each trade setup found
      const createdSetups = [];
      
      for (const coin of setupsData.coins) {
        for (const setup of coin.tradeSetups) {
          // Find or create the pair
          const pair = await ctx.db.pair.upsert({
            where: { symbol: coin.coinSymbol },
            create: { symbol: coin.coinSymbol },
            update: {},
          });

          // Create the setup
          const createdSetup = await ctx.db.setup.create({
            data: {
              content: setup.transcriptExcerpt,
              direction: setup.position,
              entryPrice: setup.entryPrice ? parseFloat(setup.entryPrice) : null,
              takeProfitPrice: setup.t1 ? parseFloat(setup.t1) : null,
              stopPrice: setup.stopLossPrice ?? null,
              timeframe: setup.timeframe ?? null,
              status: "active",
              privacy: "private",
              pairId: pair.id,
              userId: ctx.session.user.id,
            },
          });

          createdSetups.push(createdSetup);
        }
      }

      return createdSetups;
    }),
}); 