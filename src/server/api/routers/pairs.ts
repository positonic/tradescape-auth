import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { TradeSyncService } from "~/app/tradeSync/services/TradeSyncService";
import { initUserExchange } from "~/lib/userExchangeInit";
import { DefaultTradeMapper, DefaultOrderMapper } from "~/app/tradeSync/repositories/mappers/tradeMappers";
import { UserTradeRepository } from "~/app/tradeSync/repositories/UserTradeRepository";
import { OrderRepository } from "~/app/tradeSync/repositories/OrderRepository";
import { sortDescending } from "~/lib/tradeUtils";
import { TRPCError } from "@trpc/server";
export const pairsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const pairs = await ctx.db.pair.findMany({
      select: {
        id: true,
        symbol: true,
      },
      orderBy: {
        symbol: "asc",
      },
    });
    return pairs;
  }),
  syncTrades: protectedProcedure
    .input(
      z.object({
        encryptedKeys: z.string(),
        mode: z.enum(['full', 'incremental']).optional(),
        since: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { encryptedKeys, mode, since } = input;
        const userId = ctx.session.user.id;
        
        // 1. Run the sync to get sync status
        const tradeSyncService = new TradeSyncService();
        const syncResult = await tradeSyncService.syncTrades(userId, encryptedKeys, mode, since);
        
        // 2. If sync was successful, fetch and save the trades
        if (syncResult.success && syncResult.tradesFound > 0) {
          console.log(`💾 Saving ${syncResult.tradesFound} trades to database...`);
          
          const { userExchange, error } = await initUserExchange(encryptedKeys, userId);
          if (error || !userExchange) {
            console.error('Failed to initialize userExchange for saving trades:', error);
            return syncResult;
          }
          
          // Load pairs and get trades
          await userExchange.loadUserPairs();
          const trades = await userExchange.getTrades();
          
          console.log(`📊 Found ${trades.allTrades.length} trades to save`);
          
          if (trades.allTrades.length > 0) {
            // Create mapper instances
            const tradeMapper = new DefaultTradeMapper();
            const orderMapper = new DefaultOrderMapper();
            
            // Save trades to database
            const tradeRepository = new UserTradeRepository(ctx.db, tradeMapper, orderMapper);
            await tradeRepository.saveAll(trades.allTrades, userId);
            
            // Generate and save orders
            const orders = userExchange.getOrders(trades.allTrades)?.sort(sortDescending) || [];
            console.log(`📝 Generated ${orders.length} orders`);
            
            if (orders.length > 0) {
              const orderRepository = new OrderRepository(ctx.db);
              const savedOrders = await orderRepository.saveAll(orders, userId);
              await tradeRepository.updateTradeOrderRelations(savedOrders);
            }
            
            // Update trade-order relationships
            await Promise.all(
              trades.allTrades.map(async (trade) => {
                if (!trade?.tradeId) return;
                
                try {
                  await ctx.db.userTrade.update({
                    where: { tradeId: trade.tradeId },
                    data: { ordertxid: trade.ordertxid ?? '' },
                  });
                } catch (error) {
                  console.error('Error updating trade-order relationship:', error);
                }
              })
            );
            
            console.log(`✅ Successfully saved ${trades.allTrades.length} trades and ${orders.length} orders`);
          }
        }
        
        return syncResult;
        
      } catch (error) {
        console.error('Failed to sync and save trades:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sync and save trades",
        });
      }
    }),
});
