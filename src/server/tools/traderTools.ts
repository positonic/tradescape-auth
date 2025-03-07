import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getSetups } from "~/server/services/videoService";
import { TranscriptionSetups } from "~/types/transcription";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createTimeline } from "~/server/services/traderService";

// const createTraderToolSchema = z.object({
//     symbol: z.string().describe("The trading symbol to scan (e.g., 'AAPL', 'BTC-USD')"),
//     timeframe: z.enum(['1d', '1h', '15m', '5m', '1m']).default('1d')
//       .describe("The timeframe to analyze"),
//     indicators: z.array(z.string()).optional()
//       .describe("Optional technical indicators to include in the scan"),
//     scanType: z.enum(['technical', 'fundamental', 'sentiment']).default('technical')
//       .describe("Type of market scan to perform")
//   });
  const marketScanToolSchema = z.object({
    transcription: z.string()
  })

interface TraderTools {
  marketScanTool: DynamicStructuredTool<typeof marketScanToolSchema>;
}

export const createTraderTools = (ctx: any): TraderTools => {
    const marketScanTool = tool(
        async (input: { transcription: string }): Promise<string> => {
          try {
            if (!input) {
              throw new Error("Input is required");
            }
    
            console.log('input is ', input);
            const setups: TranscriptionSetups = await getSetups(input.transcription, 'trade-setups')
            console.log("summarizeTranscription is", setups)
            
            return JSON.stringify(setups);
          } catch (error) {
            console.error('Error creating action:', {
              error: error instanceof Error ? error.message : String(error),
              input
            });
            
            if (error instanceof Error && error.message.includes('foreign key')) {
              return `Created action "${input?.transcription ?? 'unknown'}" without a project association`;
            }
            throw new Error(`Failed to create action: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
        {
          name: "market_scan",
          description: "Analyzes audio / video transcriptions for trading setups and market patterns. Input must include a transcription string. Example: { transcription: 'In this video, we're looking at Bitcoin's price action...' }",
          schema: marketScanToolSchema
        }
      );
      // const timelineTool = tool(
      //   async (input: { transcription: string }): Promise<string> => {
      //     try {
      //       const timeline = await createTimeline(input.transcription, input.videoUrl)
      //       return timeline
      //     } catch (error) {
      //       console.error('Error creating action:', {
      //         error: error instanceof Error ? error.message : String(error),
      //         input
      //       });
      //     }
      //   },
      //   {
      //     name: "create_timeline",
      //     description: "Creates a timeline for a video. Input must include a transcription string. Example: { transcription: 'In this video, we're looking at Bitcoin's price action...' }",
      //     schema: marketScanToolSchema
      //   }
      // )
      return {
        marketScanTool,
        //timelineTool
      }
}