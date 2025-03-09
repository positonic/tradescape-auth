import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getSetups } from "~/server/services/videoService";
import type { TranscriptionSetups } from "~/types/transcription";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import type { Context } from "~/server/auth/types";
//import { createTimeline } from "~/server/services/traderService";

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

export const createTraderTools = (_ctx: Context): TraderTools => {
    const marketScanTool = tool(
        async (input: { transcription: string }): Promise<string> => {
          try {
            if (!input) {
              throw new Error("Input is required");
            }
    
            console.log('input is ', input);
            const setups: TranscriptionSetups = await getSetups(input.transcription, 'trade-setups')
            console.log("summarizeTranscription is", setups)
            
            if (!setups?.coins) {
                return JSON.stringify({
                    generalMarketContext: "",
                    coins: []
                });
            }
            
            // Ensure the data matches the expected format
            const validatedSetups: TranscriptionSetups = {
              generalMarketContext: setups.generalMarketContext,
              coins: setups.coins.map(coin => ({
                coinSymbol: coin.coinSymbol,
                sentiment: coin.sentiment,
                marketContext: coin.marketContext,
                tradeSetups: coin.tradeSetups.map(setup => ({
                  position: setup.position,
                  entryTriggers: setup.entryTriggers,
                  entryPrice: setup.entryPrice,
                  timeframe: setup.timeframe,
                  takeProfit: setup.takeProfit,
                  t1: setup.t1 ?? '',
                  t2: setup.t2 ?? '',
                  t3: setup.t3 ?? '',
                  stopLoss: setup.stopLoss,
                  stopLossPrice: typeof setup.stopLossPrice === 'number' ? setup.stopLossPrice : 0,
                  invalidation: setup.invalidation,
                  confidenceLevel: setup.confidenceLevel,
                  transcriptExcerpt: setup.transcriptExcerpt
                }))
              }))
            };
            
            return JSON.stringify(validatedSetups);
          } catch (error) {
            console.error('Error scanning market:', {
              error: error instanceof Error ? error.message : String(error),
              input
            });
            throw new Error(`Failed to scan market: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
        {
          name: "market_scan",
          description: "Analyzes audio/video transcriptions for trading setups and market patterns.",
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