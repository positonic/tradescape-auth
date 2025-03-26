import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const transcriptionRouter = createTRPCRouter({
  startSession: publicProcedure
    .mutation(async () => {
      // Mock response - in reality this would create a DB entry
      const sessionId = `session_${Date.now()}`;
      console.log('🎙️ New transcription session started:', sessionId);
      
      return {
        sessionId,
        startTime: new Date().toISOString(),
      };
    }),

  saveTranscription: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      transcription: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Mock response - in reality this would update the DB
      console.log('🎙️ Saving transcription for session:', input.sessionId);
      console.log('🎙️ Transcription text:', input.transcription);
      
      return {
        success: true,
        sessionId: input.sessionId,
        savedAt: new Date().toISOString(),
      };
    }),
}); 