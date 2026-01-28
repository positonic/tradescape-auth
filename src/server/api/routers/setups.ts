import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getSetups } from "~/server/services/videoService";

export const setupsRouter = createTRPCRouter({
  getPairBySymbol: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
      }),
    )
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
    .input(
      z.object({
        content: z.string(),
        entryPrice: z.number().nullish(),
        takeProfitPrice: z.number().nullish(),
        stopPrice: z.number().nullish(),
        timeframe: z.string().nullish(),
        direction: z.string(),
        pairId: z.number(),
        privacy: z.string().default("private"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("input is ", input);

      // Extract coin symbol from content or find from pair
      const pair = await ctx.db.pair.findUnique({
        where: { id: input.pairId },
        select: { symbol: true },
      });

      if (!pair) {
        throw new Error("Pair not found");
      }

      // Extract the base symbol (e.g., "BTC" from "BTC/USDT")
      const baseSymbol = pair.symbol.split("/")[0];

      // Find the corresponding coin
      const coin = await ctx.db.coin.findFirst({
        where: { symbol: baseSymbol },
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
    .input(
      z.object({
        transcriptionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.transcriptionSession.findUnique({
        where: { id: input.transcriptionId },
      });

      if (!session?.transcription) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No transcription found",
        });
      }

      console.log("session.transcription is ", session.transcription);

      // Get all available pairs from the database
      const availablePairs = await ctx.db.pair.findMany({
        select: {
          id: true,
          symbol: true,
        },
        orderBy: {
          symbol: "asc",
        },
      });

      console.log(`📊 Passing ${availablePairs.length} available pairs to AI`);

      // Get setups from transcription with available pairs context
      const setupsData = await getSetups(
        session.transcription,
        "trade-setups",
        availablePairs,
      );

      console.log("setupsData is ", setupsData);
      // Validate the response structure
      if (!setupsData || !Array.isArray(setupsData.coins)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid response format from setup parser",
        });
      }

      // Create setups for each trade setup found
      const createdSetups = [];

      for (const coin of setupsData.coins) {
        if (!coin.tradeSetups || !Array.isArray(coin.tradeSetups)) continue;

        for (const setup of coin.tradeSetups) {
          // The AI should now return the full pair symbol (e.g., "BTC/USDC:USDC")
          // First try to find existing pair by exact symbol match
          let pair = await ctx.db.pair.findUnique({
            where: { symbol: coin.coinSymbol },
          });

          if (!pair) {
            // If not found, try the fallback format conversion
            const pairSymbol = coin.coinSymbol.includes("/")
              ? coin.coinSymbol
              : `${coin.coinSymbol}/USDC:USDC`;

            pair = await ctx.db.pair.upsert({
              where: { symbol: pairSymbol },
              create: { symbol: pairSymbol },
              update: {},
            });
          }

          // Create the setup with type-safe values
          const createdSetup = await ctx.db.setup.create({
            data: {
              content: setup.transcriptExcerpt || "",
              direction: setup.position,
              entryPrice: Number(setup.entryPrice) || 0,
              takeProfitPrice: Number(setup.t1) || 0,
              stopPrice: Number(setup.stopLossPrice) || 0,
              timeframe: setup.timeframe || null,
              status: "active",
              privacy: "private",
              pairId: pair.id,
              userId: ctx.session.user.id,
              transcriptionSessionId: input.transcriptionId,
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
        createdAt: "desc",
      },
    });
    return setups;
  }),

  getPublic: protectedProcedure.query(async ({ ctx }) => {
    const setups = await ctx.db.setup.findMany({
      where: {
        privacy: "public",
      },
      include: {
        pair: true,
        video: true,
        coin: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return setups;
  }),

  getPrivate: protectedProcedure.query(async ({ ctx }) => {
    const setups = await ctx.db.setup.findMany({
      where: {
        AND: [{ privacy: "private" }, { userId: ctx.session.user.id }],
      },
      include: {
        pair: true,
        video: true,
        coin: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return setups;
  }),

  getById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const setup = await ctx.db.setup.findUnique({
        where: {
          id: input.id,
        },
        include: {
          pair: true,
          video: true,
          coin: true,
          transcriptionSession: true,
        },
      });

      if (!setup) {
        throw new Error("Setup not found");
      }

      // Check if user has permission to view this setup
      if (setup.privacy === "private" && setup.userId !== ctx.session.user.id) {
        throw new Error("Not authorized to view this setup");
      }

      // Debug logging
      console.log("🔍 [Setup Debug] Setup ID:", setup.id);
      console.log("🔍 [Setup Debug] Setup pairId:", setup.pairId);
      console.log("🔍 [Setup Debug] Pair symbol:", setup.pair?.symbol);
      console.log("🔍 [Setup Debug] Full pair object:", setup.pair);
      console.log("🔍 [Setup Debug] User ID:", ctx.session.user.id);
      console.log(
        "🔍 [Setup Debug] Transcription session ID:",
        setup.transcriptionSessionId,
      );
      console.log(
        "🔍 [Setup Debug] Transcription session object:",
        setup.transcriptionSession,
      );

      // Check if there are any UserTrades for this user at all
      const totalUserTrades = await ctx.db.userTrade.count({
        where: {
          userId: ctx.session.user.id,
        },
      });
      console.log("🔍 [Setup Debug] Total user trades:", totalUserTrades);

      // Check how many UserTrades have pairId set
      const tradesWithPairId = await ctx.db.userTrade.count({
        where: {
          userId: ctx.session.user.id,
          pairId: { not: null },
        },
      });
      console.log("🔍 [Setup Debug] Trades with pairId:", tradesWithPairId);

      // Check if any trades exist for this specific pair symbol (string match)
      const tradesForPairSymbol = await ctx.db.userTrade.count({
        where: {
          userId: ctx.session.user.id,
          pair: setup.pair?.symbol,
        },
      });
      console.log(
        "🔍 [Setup Debug] Trades for pair symbol:",
        tradesForPairSymbol,
      );

      // Let's see what trade pair symbols actually exist
      const sampleTrades = await ctx.db.userTrade.findMany({
        where: {
          userId: ctx.session.user.id,
        },
        select: {
          pair: true,
        },
        distinct: ["pair"],
        take: 10,
      });
      console.log(
        "🔍 [Setup Debug] Sample trade pair symbols:",
        sampleTrades.map((t) => t.pair),
      );

      // // Check if there are trades with similar symbols (like SOL/USDT)
      // const solTrades = await ctx.db.userTrade.count({
      //   where: {
      //     userId: ctx.session.user.id,
      //     pair: {
      //       contains: 'SOL'
      //     }
      //   }
      // });
      // console.log('🔍 [Setup Debug] Trades containing "SOL":', solTrades);

      // Convert setup creation date to BigInt timestamp for comparison
      const setupCreatedAtTimestamp = BigInt(setup.createdAt.getTime());

      console.log("🔍 [Setup Debug] Setup created at:", setup.createdAt);
      console.log(
        "🔍 [Setup Debug] Setup createdAt.getTime():",
        setup.createdAt.getTime(),
      );
      console.log(
        "🔍 [Setup Debug] Setup timestamp (BigInt):",
        setupCreatedAtTimestamp,
      );
      console.log("🔍 [Setup Debug] Current time:", new Date());
      console.log("🔍 [Setup Debug] Date.now():", Date.now());
      console.log(
        "🔍 [Setup Debug] Current timestamp (BigInt):",
        BigInt(Date.now()),
      );

      // Let's also check what a normal 2025 timestamp should look like
      const normalTimestamp = new Date("2025-07-18").getTime();
      console.log("🔍 [Setup Debug] Normal 2025 timestamp:", normalTimestamp);

      // Also check what pairId this setup has
      console.log(
        "🔍 [Setup Debug] About to query trades for pairId:",
        setup.pairId,
      );

      // Fetch trades for this setup's pair (only those created after the setup)
      let trades = await ctx.db.userTrade.findMany({
        where: {
          userId: ctx.session.user.id,
          pairId: setup.pairId,
          time: {
            gte: setupCreatedAtTimestamp,
          },
        },
        orderBy: {
          time: "desc",
        },
        take: 50, // Limit to recent 50 trades
      });

      // If no trades found with pairId, try string matching as fallback
      if (trades.length === 0 && setup.pair?.symbol) {
        console.log(
          "🔍 [Setup Debug] No trades found with pairId, trying string matching...",
        );
        console.log(
          "🔍 [Setup Debug] Looking for trades containing:",
          setup.pair.symbol,
        );
        trades = await ctx.db.userTrade.findMany({
          where: {
            userId: ctx.session.user.id,
            pair: {
              startsWith: setup.pair.symbol,
            },
            time: {
              gte: setupCreatedAtTimestamp,
            },
          },
          orderBy: {
            time: "desc",
          },
          take: 50, // Limit to recent 50 trades
        });
        console.log(
          `🔍 [Setup Debug] Found ${trades.length} trades with startsWith matching`,
        );

        // If still no trades, try broader contains matching
        if (trades.length === 0) {
          trades = await ctx.db.userTrade.findMany({
            where: {
              userId: ctx.session.user.id,
              pair: {
                contains: setup.pair.symbol,
              },
              time: {
                gte: setupCreatedAtTimestamp,
              },
            },
            orderBy: {
              time: "desc",
            },
            take: 50, // Limit to recent 50 trades
          });
          console.log(
            `🔍 [Setup Debug] Found ${trades.length} trades with contains matching`,
          );
        }
      }

      console.log("🔍 [Setup Debug] Found trades:", trades.length);
      if (trades.length > 0) {
        console.log("🔍 [Setup Debug] Sample trade:", {
          id: trades[0]?.id,
          pair: trades[0]?.pair,
          pairId: trades[0]?.pairId,
          time: trades[0]?.time,
          timeAsDate: new Date(Number(trades[0]?.time)),
        });
      }

      // Let's also check some recent trades for this pair without date filtering
      const recentTrades = await ctx.db.userTrade.findMany({
        where: {
          userId: ctx.session.user.id,
          pairId: setup.pairId,
        },
        orderBy: {
          time: "desc",
        },
        take: 3,
      });
      console.log(
        "🔍 [Setup Debug] Recent trades without date filter:",
        recentTrades.length,
      );
      if (recentTrades.length > 0) {
        console.log("🔍 [Setup Debug] Sample recent trade:", {
          id: recentTrades[0]?.id,
          time: recentTrades[0]?.time,
          timeAsDate: new Date(Number(recentTrades[0]?.time)),
          isAfterSetup:
            Number(recentTrades[0]?.time) > Number(setupCreatedAtTimestamp),
        });
      }

      // Let's check what pairIds actually exist in the trades
      const pairIdSample = await ctx.db.userTrade.findMany({
        where: {
          userId: ctx.session.user.id,
        },
        select: {
          pairId: true,
          pair: true,
        },
        distinct: ["pairId"],
        take: 10,
      });
      console.log(
        "🔍 [Setup Debug] Sample pairIds from trades:",
        pairIdSample.map((t) => ({ pairId: t.pairId, pair: t.pair })),
      );

      // Fetch orders for this setup's pair (only those created after the setup)
      console.log(
        "🔍 [Setup Debug] Fetching orders for pair:",
        setup.pair?.symbol,
      );
      const orders = await ctx.db.order.findMany({
        where: {
          userId: ctx.session.user.id,
          pair: {
            startsWith: setup.pair?.symbol || "",
          },
          time: {
            gte: setupCreatedAtTimestamp,
          },
        },
        include: {
          trades: true,
        },
        orderBy: {
          time: "desc",
        },
        take: 20,
      });
      console.log(
        `🔍 [Setup Debug] Found ${orders.length} orders with string matching`,
      );

      // Fetch positions for this setup's pair (only those created after the setup)
      console.log(
        "🔍 [Setup Debug] Fetching positions for pair:",
        setup.pair?.symbol,
      );
      const positions = await ctx.db.position.findMany({
        where: {
          userId: ctx.session.user.id,
          pair: {
            startsWith: setup.pair?.symbol || "",
          },
          time: {
            gte: setupCreatedAtTimestamp,
          },
        },
        include: {
          orders: {
            include: {
              trades: true,
            },
          },
        },
        orderBy: {
          time: "desc",
        },
        take: 10,
      });
      console.log(`🔍 [Setup Debug] Found ${positions.length} positions`);

      // Fetch additional positions, orders, and trades since transcription session was created
      let allPositionsSinceSession = positions;
      let allOrdersSinceSession = orders;
      let allTradesSinceSession = trades;

      if (setup.transcriptionSession?.createdAt) {
        const sessionCreatedAtTimestamp = BigInt(
          setup.transcriptionSession.createdAt.getTime(),
        );
        console.log(
          "🟡 [TRADES DEBUG] Transcription session created at:",
          setup.transcriptionSession.createdAt,
        );
        console.log(
          "🟡 [TRADES DEBUG] Session timestamp (BigInt):",
          sessionCreatedAtTimestamp,
        );
        console.log(
          "🟡 [TRADES DEBUG] Session timestamp (Date):",
          new Date(Number(sessionCreatedAtTimestamp)),
        );

        // Calculate time window around session (24 hours before and after)
        const sessionTime = Number(sessionCreatedAtTimestamp);
        const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const startTime = sessionTime - oneDayInMs;
        const endTime = sessionTime + oneDayInMs;

        console.log("🟡 [TRADES DEBUG] Time window around session:", {
          sessionTime: sessionTime,
          sessionTimeAsDate: new Date(sessionTime),
          startTime: startTime,
          startTimeAsDate: new Date(startTime),
          endTime: endTime,
          endTimeAsDate: new Date(endTime),
        });

        // First, let's check what positions exist for this pair WITHOUT time filtering
        const allPositionsForPair = await ctx.db.position.findMany({
          where: {
            userId: ctx.session.user.id,
            pair: {
              startsWith: setup.pair?.symbol || "",
            },
          },
          include: {
            orders: {
              include: {
                trades: true,
              },
            },
          },
          orderBy: {
            time: "desc",
          },
          take: 100,
        });

        console.log(
          `🔍 [Setup Debug] Found ${allPositionsForPair.length} total positions for pair ${setup.pair?.symbol} (no time filter)`,
        );
        if (allPositionsForPair.length > 0) {
          console.log("🔍 [Setup Debug] Sample position:", {
            id: allPositionsForPair[0]?.id,
            time: allPositionsForPair[0]?.time,
            timeAsDate: new Date(Number(allPositionsForPair[0]?.time)),
            pair: allPositionsForPair[0]?.pair,
            status: allPositionsForPair[0]?.status,
          });
        }

        // Let's also check what pair symbols exist in positions table
        const positionPairSymbols = await ctx.db.position.findMany({
          where: {
            userId: ctx.session.user.id,
          },
          select: {
            pair: true,
          },
          distinct: ["pair"],
          take: 10,
        });
        console.log(
          "🔍 [Setup Debug] Available position pair symbols:",
          positionPairSymbols.map((p) => p.pair),
        );

        // Check what orders exist for this pair WITHOUT time filtering
        const allOrdersForPair = await ctx.db.order.findMany({
          where: {
            userId: ctx.session.user.id,
            pair: {
              startsWith: setup.pair?.symbol || "",
            },
          },
          include: {
            trades: true,
          },
          orderBy: {
            time: "desc",
          },
          take: 100,
        });

        console.log(
          `🔍 [Setup Debug] Found ${allOrdersForPair.length} total orders for pair ${setup.pair?.symbol} (no time filter)`,
        );
        if (allOrdersForPair.length > 0) {
          console.log("🔍 [Setup Debug] Sample order:", {
            id: allOrdersForPair[0]?.id,
            time: allOrdersForPair[0]?.time,
            timeAsDate: new Date(Number(allOrdersForPair[0]?.time)),
            pair: allOrdersForPair[0]?.pair,
            type: allOrdersForPair[0]?.type,
          });
        }

        // Let's also check what pair symbols exist in orders table
        const orderPairSymbols = await ctx.db.order.findMany({
          where: {
            userId: ctx.session.user.id,
          },
          select: {
            pair: true,
          },
          distinct: ["pair"],
          take: 10,
        });
        console.log(
          "🔍 [Setup Debug] Available order pair symbols:",
          orderPairSymbols.map((o) => o.pair),
        );

        // Check what trades exist for this pair WITHOUT time filtering
        const allTradesForPair = await ctx.db.userTrade.findMany({
          where: {
            userId: ctx.session.user.id,
            pair: {
              startsWith: setup.pair?.symbol || "",
            },
          },
          orderBy: {
            time: "desc",
          },
          take: 100,
        });

        console.log(
          `🟡 [TRADES DEBUG] Found ${allTradesForPair.length} total trades for pair ${setup.pair?.symbol} (no time filter)`,
        );
        if (allTradesForPair.length > 0) {
          console.log("🟡 [TRADES DEBUG] Sample trade:", {
            id: allTradesForPair[0]?.id,
            time: allTradesForPair[0]?.time,
            timeAsDate: new Date(Number(allTradesForPair[0]?.time)),
            pair: allTradesForPair[0]?.pair,
            type: allTradesForPair[0]?.type,
          });

          // Log ALL trades for comparison
          console.log("🟡 [TRADES DEBUG] ALL TRADES FOR PAIR:");
          allTradesForPair.forEach((trade, index) => {
            console.log(`🟡 [TRADES DEBUG] Trade ${index + 1}:`, {
              id: trade.id,
              time: trade.time,
              timeAsDate: new Date(Number(trade.time)),
              pair: trade.pair,
              type: trade.type,
              price: trade.price,
              vol: trade.vol,
            });
          });
        }

        // Now fetch with time filtering (within 24 hours of session)
        const additionalPositions = await ctx.db.position.findMany({
          where: {
            userId: ctx.session.user.id,
            pair: {
              startsWith: setup.pair?.symbol || "",
            },
            time: {
              gte: BigInt(startTime),
              lte: BigInt(endTime),
            },
          },
          include: {
            orders: {
              include: {
                trades: true,
              },
            },
          },
          orderBy: {
            time: "desc",
          },
          take: 50, // Increased limit for all positions
        });

        // Fetch ALL orders for this pair within 24 hours of session
        const additionalOrders = await ctx.db.order.findMany({
          where: {
            userId: ctx.session.user.id,
            pair: {
              startsWith: setup.pair?.symbol || "",
            },
            time: {
              gte: BigInt(startTime),
              lte: BigInt(endTime),
            },
          },
          include: {
            trades: true,
          },
          orderBy: {
            time: "desc",
          },
          take: 100, // Increased limit for all orders
        });

        console.log(
          `🔍 [Setup Debug] Found ${additionalPositions.length} total positions since session`,
        );
        console.log(
          `🔍 [Setup Debug] Found ${additionalOrders.length} total orders since session`,
        );

        // Fetch ALL trades for this pair within 24 hours of session
        const additionalTrades = await ctx.db.userTrade.findMany({
          where: {
            userId: ctx.session.user.id,
            pair: {
              startsWith: setup.pair?.symbol || "",
            },
            time: {
              gte: BigInt(startTime),
              lte: BigInt(endTime),
            },
          },
          orderBy: {
            time: "desc",
          },
          take: 200, // Increased limit for all trades
        });

        console.log(
          `🟡 [TRADES DEBUG] Found ${additionalTrades.length} total trades within 24 hours of session`,
        );

        // Log the trades that match the time filter
        if (additionalTrades.length > 0) {
          console.log("🟡 [TRADES DEBUG] TRADES SINCE SESSION:");
          additionalTrades.forEach((trade, index) => {
            console.log(`🟡 [TRADES DEBUG] Session Trade ${index + 1}:`, {
              id: trade.id,
              time: trade.time,
              timeAsDate: new Date(Number(trade.time)),
              pair: trade.pair,
              type: trade.type,
              price: trade.price,
              vol: trade.vol,
              isAfterSession:
                Number(trade.time) >= Number(sessionCreatedAtTimestamp),
            });
          });
        } else {
          console.log(
            "🟡 [TRADES DEBUG] NO TRADES FOUND SINCE SESSION - checking time comparison...",
          );
          // Let's check a few trades to see the time comparison
          if (allTradesForPair.length > 0) {
            console.log("🟡 [TRADES DEBUG] TIME COMPARISON ANALYSIS:");
            allTradesForPair.slice(0, 5).forEach((trade, index) => {
              const tradeTime = Number(trade.time);
              const sessionTime = Number(sessionCreatedAtTimestamp);
              console.log(`🟡 [TRADES DEBUG] Trade ${index + 1} comparison:`, {
                tradeId: trade.id,
                tradeTime: tradeTime,
                tradeTimeAsDate: new Date(tradeTime),
                sessionTime: sessionTime,
                sessionTimeAsDate: new Date(sessionTime),
                isAfterSession: tradeTime >= sessionTime,
                difference: tradeTime - sessionTime,
                differenceInHours: (tradeTime - sessionTime) / (1000 * 60 * 60),
              });
            });
          }
        }

        allPositionsSinceSession = additionalPositions;
        allOrdersSinceSession = additionalOrders;
        allTradesSinceSession = additionalTrades;
      }

      // Convert Decimal fields to numbers for setup, trades, orders, and positions
      const serializedTrades = trades.map((trade) => ({
        ...trade,
        closedPnL: trade.closedPnL ? Number(trade.closedPnL) : null,
        price: trade.price ? Number(trade.price) : null,
        cost: trade.cost ? Number(trade.cost) : null,
        fee: trade.fee ? Number(trade.fee) : null,
        vol: trade.vol ? Number(trade.vol) : null,
        margin: trade.margin ? Number(trade.margin) : null,
      }));

      // Serialize additional trades since session
      const serializedAllTradesSinceSession = allTradesSinceSession.map(
        (trade) => ({
          ...trade,
          closedPnL: trade.closedPnL ? Number(trade.closedPnL) : null,
          price: trade.price ? Number(trade.price) : null,
          cost: trade.cost ? Number(trade.cost) : null,
          fee: trade.fee ? Number(trade.fee) : null,
          vol: trade.vol ? Number(trade.vol) : null,
          margin: trade.margin ? Number(trade.margin) : null,
        }),
      );

      const serializedOrders = orders.map((order) => ({
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

      const serializedPositions = positions.map((position) => ({
        ...position,
        averageEntryPrice: Number(position.averageEntryPrice),
        averageExitPrice: Number(position.averageExitPrice),
        totalCostBuy: Number(position.totalCostBuy),
        totalCostSell: Number(position.totalCostSell),
        amount: Number(position.amount),
        profitLoss: Number(position.profitLoss),
        orderCount: position.orders.length,
        tradeCount: position.orders.reduce(
          (sum, order) => sum + order.trades.length,
          0,
        ),
      }));

      // Serialize additional positions and orders since session
      const serializedAllOrdersSinceSession = allOrdersSinceSession.map(
        (order) => ({
          ...order,
          amount: Number(order.amount),
          totalCost: Number(order.totalCost),
          fee: Number(order.fee),
          highestPrice: Number(order.highestPrice),
          lowestPrice: Number(order.lowestPrice),
          averagePrice: Number(order.averagePrice),
          closedPnL: order.closedPnL ? Number(order.closedPnL) : null,
          tradeCount: order.trades.length,
        }),
      );
      console.log(
        "serializedAllOrdersSinceSession is ",
        serializedAllOrdersSinceSession,
      );
      const serializedAllPositionsSinceSession = allPositionsSinceSession.map(
        (position) => ({
          ...position,
          averageEntryPrice: Number(position.averageEntryPrice),
          averageExitPrice: Number(position.averageExitPrice),
          totalCostBuy: Number(position.totalCostBuy),
          totalCostSell: Number(position.totalCostSell),
          amount: Number(position.amount),
          profitLoss: Number(position.profitLoss),
          orderCount: position.orders.length,
          tradeCount: position.orders.reduce(
            (sum, order) => sum + order.trades.length,
            0,
          ),
        }),
      );
      console.log(
        "serializedAllPositionsSinceSession is ",
        serializedAllPositionsSinceSession,
      );
      console.log(
        "serializedAllTradesSinceSession is ",
        serializedAllTradesSinceSession,
      );
      return {
        ...setup,
        entryPrice: setup.entryPrice ? Number(setup.entryPrice) : null,
        takeProfitPrice: setup.takeProfitPrice
          ? Number(setup.takeProfitPrice)
          : null,
        stopPrice: setup.stopPrice ? Number(setup.stopPrice) : null,
        trades: serializedTrades,
        orders: serializedOrders,
        positions: serializedPositions,
        allOrdersSinceSession: serializedAllOrdersSinceSession,
        allPositionsSinceSession: serializedAllPositionsSinceSession,
        allTradesSinceSession: serializedAllTradesSinceSession,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        entryPrice: z.union([
          z.string().transform((val) => Number(val)),
          z.number(),
          z.null(),
        ]),
        takeProfitPrice: z.union([
          z.string().transform((val) => Number(val)),
          z.number(),
          z.null(),
        ]),
        stopPrice: z.union([
          z.string().transform((val) => Number(val)),
          z.number(),
          z.null(),
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const setup = await ctx.db.setup.update({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
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
    .input(
      z.object({
        id: z.string(),
        content: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const setup = await ctx.db.setup.update({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        data: {
          content: input.content,
        },
      });
      return setup;
    }),

  updatePrivacy: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        privacy: z.enum(["public", "private"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const setup = await ctx.db.setup.update({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        data: {
          privacy: input.privacy,
        },
      });
      return setup;
    }),

  updatePair: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        pairId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First find the pair to get its information
      const pair = await ctx.db.pair.findUnique({
        where: { id: input.pairId },
        select: { symbol: true },
      });

      if (!pair) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pair not found",
        });
      }

      // Extract base symbol for coin lookup
      const baseSymbol = pair.symbol.split("/")[0];
      const coin = await ctx.db.coin.findFirst({
        where: { symbol: baseSymbol },
      });

      const setup = await ctx.db.setup.update({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        data: {
          pairId: input.pairId,
          coinId: coin?.id,
        },
        include: {
          pair: true,
          coin: true,
        },
      });
      return setup;
    }),

  deleteSetup: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure the user owns the setup before deleting
      const setup = await ctx.db.setup.findUnique({
        where: {
          id: input.id,
        },
        select: { userId: true },
      });

      if (!setup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Setup not found",
        });
      }

      if (setup.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to delete this setup",
        });
      }

      await ctx.db.setup.delete({
        where: {
          id: input.id,
        },
      });

      return { success: true };
    }),
});
