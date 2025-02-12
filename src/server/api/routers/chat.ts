import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const chatRouter = createTRPCRouter({
  sendMessage: protectedProcedure
    .input(z.object({
      message: z.string(),
      conversationId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const completion = await openai.chat.completions.create({
          messages: [{ role: 'user', content: input.message }],
          model: 'gpt-3.5-turbo',
        });

        return {
          response: completion.choices[0]?.message?.content ?? 'No response',
        };
      } catch (error) {
        console.error('OpenAI API error:', error);
        throw new Error('Failed to get response from AI');
      }
    }),
}); 