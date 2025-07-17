import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getSetups } from "~/server/services/videoService";

// First, define the types for the response
type TradeSetup = {
  transcriptExcerpt: string;
  position: 'long' | 'short';
  entryPrice: string;
  t1: string;
  stopLossPrice: number;
  timeframe: string;
};

type Coin = {
  coinSymbol: string;
  tradeSetups: TradeSetup[];
};

type SetupResponse = {
  coins: Coin[];
};

export const setupsRouter = createTRPCRouter({
  getPairBySymbol: protectedProcedure
    .input(z.object({
      symbol: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Convert symbol to standard format (e.g., "BTC" -> "BTC/USDT")
      const pairSymbol = `${input.symbol}/USDT`;
      
      const pair = await ctx.db.pair.findUnique({
        where: { symbol: pairSymbol },
      });

      if (!pair) {
        throw new Error(`No pair found for symbol ${pairSymbol}`);
      }

      return pair;
    }),

  create: protectedProcedure
    .input(z.object({
      content: z.string(),
      entryPrice: z.number().nullish(),
      takeProfitPrice: z.number().nullish(),
      stopPrice: z.number().nullish(),
      timeframe: z.string().nullish(),
      direction: z.string(),
      pairId: z.number(),
      privacy: z.string().default('private'),
    }))
    .mutation(async ({ ctx, input }) => {
      console.log("input is ", input);
      
      // Extract coin symbol from content or find from pair
      const pair = await ctx.db.pair.findUnique({
        where: { id: input.pairId },
        select: { symbol: true }
      });

      if (!pair) {
        throw new Error('Pair not found');
      }

      // Extract the base symbol (e.g., "BTC" from "BTC/USDT")
      const baseSymbol = pair.symbol.split('/')[0];
      
      // Find the corresponding coin
      const coin = await ctx.db.coin.findFirst({
        where: { symbol: baseSymbol }
      });

      if (!coin) {
        console.log(`No coin found for symbol ${baseSymbol}`);
      }

      // Create the setup with coin relationship if found
      const setup = await ctx.db.setup.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
          status: "active",
          coinId: coin?.id,
        },
        include: {
          pair: true,
          coin: true,
        },
      });

      return setup;
    }),

  createFromTranscription: protectedProcedure
    .input(z.object({
      transcriptionId: z.string(),
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

      console.log("session.transcription is ", session.transcription);
      // Get setups from transcription with type assertion
      const setupsData = await getSetups(session.transcription, 'trade-setups') as SetupResponse;
      
      console.log("setupsData is ", setupsData);
      // Validate the response structure
      if (!setupsData || !Array.isArray(setupsData.coins)) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Invalid response format from setup parser'
        });
      }

      // Create setups for each trade setup found
      const createdSetups = [];
      
      for (const coin of setupsData.coins) {
        if (!coin.tradeSetups || !Array.isArray(coin.tradeSetups)) continue;

        for (const setup of coin.tradeSetups) {
          // Find or create the pair
          const pair = await ctx.db.pair.upsert({
            where: { symbol: coin.coinSymbol },
            create: { symbol: coin.coinSymbol },
            update: {},
          });

          // Create the setup with type-safe values
          const createdSetup = await ctx.db.setup.create({
            data: {
              content: setup.transcriptExcerpt || '',
              direction: setup.position,
              entryPrice: Number(setup.entryPrice) || 0,
              takeProfitPrice: Number(setup.t1) || 0,
              stopPrice: Number(setup.stopLossPrice) || 0,
              timeframe: setup.timeframe || null,
              status: "active",
              privacy: "private",
              pairId: pair.id,
              userId: ctx.session.user.id,
              transcriptionSessionId: input.transcriptionId
            },
          });

          createdSetups.push(createdSetup);
        }
      }

      return createdSetups;
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const setups = await ctx.db.setup.findMany({
      include: {
        pair: true,
        video: true,
        coin: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return setups;
  }),

  getPublic: protectedProcedure.query(async ({ ctx }) => {
    const setups = await ctx.db.setup.findMany({
      where: {
        privacy: 'public'
      },
      include: {
        pair: true,
        video: true,
        coin: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return setups;
  }),

  getPrivate: protectedProcedure.query(async ({ ctx }) => {
    const setups = await ctx.db.setup.findMany({
      where: {
        AND: [
          { privacy: 'private' },
          { userId: ctx.session.user.id }
        ]
      },
      include: {
        pair: true,
        video: true,
        coin: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return setups;
  }),

  getById: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const setup = await ctx.db.setup.findUnique({
        where: {
          id: input.id
        },
        include: {
          pair: true,
          video: true,
          coin: true,
        }
      });

      if (!setup) {
        throw new Error('Setup not found');
      }

      // Check if user has permission to view this setup
      if (setup.privacy === 'private' && setup.userId !== ctx.session.user.id) {
        throw new Error('Not authorized to view this setup');
      }

      // Debug logging
      console.log('🔍 [Setup Debug] Setup ID:', setup.id);
      console.log('🔍 [Setup Debug] Setup pairId:', setup.pairId);
      console.log('🔍 [Setup Debug] Pair symbol:', setup.pair?.symbol);
      console.log('🔍 [Setup Debug] User ID:', ctx.session.user.id);

      // Check if there are any UserTrades for this user at all
      const totalUserTrades = await ctx.db.userTrade.count({
        where: {
          userId: ctx.session.user.id,
        }
      });
      console.log('🔍 [Setup Debug] Total user trades:', totalUserTrades);

      // Check how many UserTrades have pairId set
      const tradesWithPairId = await ctx.db.userTrade.count({
        where: {
          userId: ctx.session.user.id,
          pairId: { not: null }
        }
      });
      console.log('🔍 [Setup Debug] Trades with pairId:', tradesWithPairId);

      // Check if any trades exist for this specific pair symbol (string match)
      const tradesForPairSymbol = await ctx.db.userTrade.count({
        where: {
          userId: ctx.session.user.id,
          pair: setup.pair?.symbol
        }
      });
      console.log('🔍 [Setup Debug] Trades for pair symbol:', tradesForPairSymbol);

      // Let's see what trade pair symbols actually exist
      const sampleTrades = await ctx.db.userTrade.findMany({
        where: {
          userId: ctx.session.user.id,
        },
        select: {
          pair: true,
        },
        distinct: ['pair'],
        take: 10
      });
      console.log('🔍 [Setup Debug] Sample trade pair symbols:', sampleTrades.map(t => t.pair));

      // Check if there are trades with similar symbols (like SOL/USDT)
      const solTrades = await ctx.db.userTrade.count({
        where: {
          userId: ctx.session.user.id,
          pair: {
            contains: 'SOL'
          }
        }
      });
      console.log('🔍 [Setup Debug] Trades containing "SOL":', solTrades);

      // Fetch trades for this setup's pair
      let trades = await ctx.db.userTrade.findMany({
        where: {
          userId: ctx.session.user.id,
          pairId: setup.pairId,
        },
        orderBy: {
          time: 'desc'
        },
        take: 50 // Limit to recent 50 trades
      });

      // If no trades found with pairId, try string matching as fallback
      if (trades.length === 0 && setup.pair?.symbol) {
        console.log('🔍 [Setup Debug] No trades found with pairId, trying string matching...');
        trades = await ctx.db.userTrade.findMany({
          where: {
            userId: ctx.session.user.id,
            pair: {
              contains: setup.pair.symbol
            }
          },
          orderBy: {
            time: 'desc'
          },
          take: 50 // Limit to recent 50 trades
        });
        console.log(`🔍 [Setup Debug] Found ${trades.length} trades with string matching`);
      }

      console.log('🔍 [Setup Debug] Found trades:', trades.length);
      if (trades.length > 0) {
        console.log('🔍 [Setup Debug] Sample trade:', {
          id: trades[0]?.id,
          pair: trades[0]?.pair,
          pairId: trades[0]?.pairId,
          time: trades[0]?.time
        });
      }

      // Fetch orders for this setup's pair (using string matching for now until server restart)
      console.log('🔍 [Setup Debug] Fetching orders for pair:', setup.pair?.symbol);
      const orders = await ctx.db.order.findMany({
        where: {
          userId: ctx.session.user.id,
          pair: {
            contains: setup.pair?.symbol || ''
          }
        },
        include: {
          trades: true,
        },
        orderBy: {
          time: 'desc'
        },
        take: 20
      });
      console.log(`🔍 [Setup Debug] Found ${orders.length} orders with string matching`);

      // Convert Decimal fields to numbers for setup, trades, and orders
      const serializedTrades = trades.map(trade => ({
        ...trade,
        closedPnL: trade.closedPnL ? Number(trade.closedPnL) : null,
      }));

      const serializedOrders = orders.map(order => ({
        ...order,
        amount: Number(order.amount),
        totalCost: Number(order.totalCost),
        fee: Number(order.fee),
        highestPrice: Number(order.highestPrice),
        lowestPrice: Number(order.lowestPrice),
        averagePrice: Number(order.averagePrice),
        closedPnL: order.closedPnL ? Number(order.closedPnL) : null,
        tradeCount: order.trades.length,
      }));

      return {
        ...setup,
        entryPrice: setup.entryPrice ? Number(setup.entryPrice) : null,
        takeProfitPrice: setup.takeProfitPrice ? Number(setup.takeProfitPrice) : null,
        stopPrice: setup.stopPrice ? Number(setup.stopPrice) : null,
        trades: serializedTrades,
        orders: serializedOrders,
      };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      entryPrice: z.union([
        z.string().transform((val) => Number(val)),
        z.number(),
        z.null()
      ]),
      takeProfitPrice: z.union([
        z.string().transform((val) => Number(val)),
        z.number(),
        z.null()
      ]),
      stopPrice: z.union([
        z.string().transform((val) => Number(val)),
        z.number(),
        z.null()
      ]),
    }))
    .mutation(async ({ ctx, input }) => {
      const setup = await ctx.db.setup.update({
        where: { 
          id: input.id,
          userId: ctx.session.user.id 
        },
        data: {
          entryPrice: input.entryPrice,
          takeProfitPrice: input.takeProfitPrice,
          stopPrice: input.stopPrice,
        },
      });
      return setup;
    }),

  updateContent: protectedProcedure
    .input(z.object({
      id: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const setup = await ctx.db.setup.update({
        where: { 
          id: input.id,
          userId: ctx.session.user.id 
        },
        data: {
          content: input.content,
        },
      });
      return setup;
    }),

  updatePrivacy: protectedProcedure
    .input(z.object({
      id: z.string(),
      privacy: z.enum(['public', 'private'])
    }))
    .mutation(async ({ ctx, input }) => {
      const setup = await ctx.db.setup.update({
        where: { 
          id: input.id,
          userId: ctx.session.user.id 
        },
        data: {
          privacy: input.privacy
        },
      });
      return setup;
    }),

  deleteSetup: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Ensure the user owns the setup before deleting
      const setup = await ctx.db.setup.findUnique({
        where: { 
          id: input.id 
        },
        select: { userId: true }
      });
      
      if (!setup) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Setup not found'
        });
      }
      
      if (setup.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to delete this setup'
        });
      }
      
      await ctx.db.setup.delete({
        where: { 
          id: input.id
        },
      });
      
      return { success: true };
    }),
}); 