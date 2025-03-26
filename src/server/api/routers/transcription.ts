import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Keep in-memory store for development/debugging
const transcriptionStore: Record<string, string[]> = {};

// Helper to print the store nicely
const logStore = () => {
  console.log('\n🎙️ ================== Transcription Store ==================');
  console.log(JSON.stringify(transcriptionStore, null, 2));
  console.log('🎙️ =====================================================\n');
};

export const transcriptionRouter = createTRPCRouter({
  startSession: publicProcedure
    .mutation(async ({ ctx }) => {
      // Create record in database using ctx.db instead of prisma
      const session = await ctx.db.transcriptionSession.create({
        data: {
          sessionId: `session_${Date.now()}`, // Keep this as a reference
          transcription: "", // Start with empty transcription
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

  saveTranscription: publicProcedure
    .input(z.object({
      id: z.string(), // Changed from sessionId to id
      transcription: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, transcription } = input;
      
      // Update database using ctx.db
      await ctx.db.transcriptionSession.update({
        where: { id }, // Use the database ID
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
}); 