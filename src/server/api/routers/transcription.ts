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

  // Type-safe error handling
  const userId = verificationToken.userId;
  if (!userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No user associated with this API key',
    });
  }

  // Add the user id to the context
  return next({
    ctx: {
      ...ctx,
      userId, // Now type-safe
    },
  });
});

export const transcriptionRouter = createTRPCRouter({
  startSession: apiKeyMiddleware
    .mutation(async ({ ctx }) => {
      // Type-safe userId access
      const userId = ctx.userId;
      
      // Create record in database using ctx.db
      const session = await ctx.db.transcriptionSession.create({
        data: {
          sessionId: `session_${Date.now()}`, // Keep this as a reference
          transcription: "", // Start with empty transcription
          userId, // Now type-safe
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

    
  saveTranscription: protectedProcedure
    .input(z.object({
      id: z.string(),
      transcription: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // First, get the current transcription session
      const existingSession = await ctx.db.transcriptionSession.findUnique({
        where: { id: input.id }
      });

      if (!existingSession) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transcription session not found'
        });
      }

      // Check if existing transcription has content and append if so
      const updatedTranscription = 
        existingSession.transcription && existingSession.transcription !== "" 
          ? `${existingSession.transcription} ${input.transcription}` 
          : input.transcription;

      // Update with the combined transcription
      await ctx.db.transcriptionSession.update({
        where: { id: input.id },
        data: {
          transcription: updatedTranscription,
        },
      });
      return {
        success: true,
        id: input.id,
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
        include: { 
          user: true,
          setups: {
            include: {
              pair: true,
              coin: true,
            }
          }
        }
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

  updateTranscription: protectedProcedure
    .input(z.object({
      id: z.string(),
      transcription: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.transcriptionSession.update({
        where: { 
          id: input.id,
          userId: ctx.session.user.id 
        },
        data: { 
          transcription: input.transcription,
          updatedAt: new Date(),
        },
      });
      return session;
    }),
}); 