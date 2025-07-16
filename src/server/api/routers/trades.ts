import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { initUserExchange } from "~/lib/userExchangeInit";
import { decryptFromTransmission, validateKeys } from "~/lib/keyEncryption";
import type { TradeResponseData } from "~/lib/tradeUtils";
import { DefaultTradeMapper, DefaultOrderMapper } from "~/app/tradeSync/repositories/mappers/tradeMappers";
import { UserTradeRepository } from "~/app/tradeSync/repositories/UserTradeRepository";
import { OrderRepository } from "~/app/tradeSync/repositories/OrderRepository";
import { sortDescending } from "~/lib/tradeUtils";
import { db } from "~/server/db";

export const tradesRouter = createTRPCRouter({
  syncTrades: protectedProcedure
    .input(
      z.object({
        encryptedKeys: z.string(),
        since: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }): Promise<TradeResponseData> => {
      try {
        const userId = ctx.session.user.id;
        const { encryptedKeys, since } = input;

        const { userExchange, error } = await initUserExchange(
          encryptedKeys,
          userId
        );
        if (error || !userExchange) {
          return {
            trades: [],
            orders: [],
            positions: [],
            error: error || 'Failed to initialize exchange',
          };
        }
       // Get updated user pairs using the UserExchange class method
    await userExchange.loadUserPairs();

    // Fetch trades
    const trades = await userExchange.getTrades();
    console.log(`Fetched ${trades.allTrades.length} trades`);
    // Update the last sync times for all exchanges that were queried
    await userExchange.updateLastSyncTimes(Object.keys(userExchange.exchanges));

    // Create mapper instances
    const tradeMapper = new DefaultTradeMapper();
    const orderMapper = new DefaultOrderMapper();

    // Pass them to the repository
    const tradeRepository = new UserTradeRepository(
      db,
      tradeMapper,
      orderMapper
    );
    // Save trades
    await tradeRepository.saveAll(trades.allTrades, Number(userId));

    // Generate and save orders
    const orders =
      userExchange.getOrders(trades.allTrades)?.sort(sortDescending) || [];
    console.log(`Generated orders (${orders.length})`, orders);

    if (orders.length > 0) {
      const orderRepository = new OrderRepository(db);
      const savedOrders = await orderRepository.saveAll(orders, Number(userId));
      await tradeRepository.updateTradeOrderRelations(savedOrders);
    }

    // Only update trade-order relationships if there are trades
    if (trades.allTrades && trades.allTrades.length > 0) {
      await Promise.all(
        trades.allTrades.map(async (trade) => {
          if (!trade || !trade.tradeId) {
            console.log('Invalid trade:', trade);
            return;
          }

          try {
            await db.userTrade.update({
              where: { tradeId: trade.tradeId },
              data: { ordertxid: trade.ordertxid ?? '' },
            });
          } catch (error) {
            console.error(
              'Error updating trade-order relationship:',
              error,
              'Trade:',
              trade
            );
          }
        })
      );
    }

    const flattenedTrades = trades.allTrades?.flat() || [];
    // Debug which property is causing the BigInt issue
    flattenedTrades.forEach((trade) => {
      Object.entries(trade).forEach(([key, value]) => {
        if (typeof value === 'bigint') {
          console.log(`Trade BigInt found - Key: ${key}, Value: ${value}`);
        }
      });
    });

    orders.forEach((order) => {
      Object.entries(order).forEach(([key, value]) => {
        if (typeof value === 'bigint') {
          console.log(`Order BigInt found - Key: ${key}, Value: ${value}`);
        }
      });
    });
    console.log('flattenedTrades', flattenedTrades);
    return {
      trades: flattenedTrades,
      orders,
      positions: [],
      error: '',
    };
  }  catch (error) {
        console.error('Failed to process trade-sync request:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process trade-sync request",
        });
      }
    }),

  getTrades: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, offset } = input;

      // TODO: Implement once userTrade model is added to Prisma schema
      // For now, return mock data
      return {
        trades: [],
        totalCount: 0,
        hasMore: false,
      };
    }),

  getOrders: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, offset } = input;

      // TODO: Implement once order model is added to Prisma schema
      // For now, return mock data
      return {
        orders: [],
        totalCount: 0,
        hasMore: false,
      };
    }),
});