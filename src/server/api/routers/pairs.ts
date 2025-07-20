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
import { PositionRepository } from "~/app/tradeSync/repositories/PositionRepository";
import { EnhancedPositionAggregator } from "~/app/tradeSync/aggregation/EnhancedPositionAggregator";
import { sortDescending } from "~/lib/tradeUtils";
import { TRPCError } from "@trpc/server";
import type { Trade } from "~/app/tradeSync/interfaces/Trade";
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

  validatePositionCreation: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        console.log('🔍 Validating position creation effectiveness...');

        // Get all automated positions with their orders
        const positions = await ctx.db.position.findMany({
          where: {
            positionType: 'automated',
            userId: ctx.session.user.id,
          },
          include: {
            orders: {
              select: {
                id: true,
                type: true,
                amount: true,
                totalCost: true,
                time: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        console.log(`📊 Found ${positions.length} automated positions to analyze`);

        let completePositions = 0;
        let partialPositions = 0;
        let buyOnlyPositions = 0;
        let sellOnlyPositions = 0;
        let positivePositions = 0;
        let negativePositions = 0;
        let breakEvenPositions = 0;
        let totalOrders = 0;
        let totalProfitLoss = 0;
        const positionsByPair: Record<string, number> = {};

        for (const position of positions) {
          const pairSymbol = position.pair;
          positionsByPair[pairSymbol] = (positionsByPair[pairSymbol] || 0) + 1;

          totalOrders += position.orders.length;

          // Analyze order types
          const buyOrders = position.orders.filter(order => order.type === 'buy');
          const sellOrders = position.orders.filter(order => order.type === 'sell');

          // Calculate volumes
          const buyVolume = buyOrders.reduce((sum, order) => sum + Number(order.amount), 0);
          const sellVolume = sellOrders.reduce((sum, order) => sum + Number(order.amount), 0);

          // Classify position type
          if (buyOrders.length > 0 && sellOrders.length > 0) {
            const volumeDiff = Math.abs(buyVolume - sellVolume);
            const avgVolume = (buyVolume + sellVolume) / 2;
            const balancePercentage = avgVolume > 0 ? (volumeDiff / avgVolume) * 100 : 0;
            
            if (balancePercentage <= 1) {
              completePositions++;
            } else {
              partialPositions++;
            }
          } else if (buyOrders.length > 0) {
            buyOnlyPositions++;
          } else if (sellOrders.length > 0) {
            sellOnlyPositions++;
          }

          // Analyze profit/loss
          const pnl = Number(position.profitLoss);
          totalProfitLoss += pnl;

          if (pnl > 0.01) {
            positivePositions++;
          } else if (pnl < -0.01) {
            negativePositions++;
          } else {
            breakEvenPositions++;
          }
        }

        const analysis = {
          totalPositions: positions.length,
          completePositions,
          partialPositions,
          buyOnlyPositions,
          sellOnlyPositions,
          positionsByPair,
          averageOrdersPerPosition: positions.length > 0 ? totalOrders / positions.length : 0,
          averageProfitLoss: positions.length > 0 ? totalProfitLoss / positions.length : 0,
          positivePositions,
          negativePositions,
          breakEvenPositions,
          completenessScore: positions.length > 0 ? (completePositions / positions.length) * 100 : 0,
          profitabilityScore: positions.length > 0 ? (positivePositions / positions.length) * 100 : 0,
          topTradingPairs: Object.entries(positionsByPair)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([pair, count]) => ({ pair, count })),
        };

        return analysis;
      } catch (error) {
        console.error('❌ Error validating positions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to validate position creation',
        });
      }
    }),

  createPositionsFromExistingOrders: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        pairFilter: z.string().optional(),
        dryRun: z.boolean().optional().default(false),
        maxOrders: z.number().optional().default(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { userId, pairFilter, dryRun, maxOrders } = input;
        const currentUserId = userId || ctx.session.user.id;
        
        console.log('🚀 Creating positions from existing orders...');
        console.log('📋 Input:', { userId: currentUserId, pairFilter, dryRun, maxOrders });

        // Build where clause for orders
        const whereClause: any = {
          positionId: null,
          userId: currentUserId,
        };

        if (pairFilter) {
          whereClause.pair = {
            contains: pairFilter
          };
        }

        // Get orders without positions
        const orders = await ctx.db.order.findMany({
          where: whereClause,
          orderBy: {
            time: 'asc'
          },
          take: maxOrders
        });

        console.log(`📦 Found ${orders.length} orders without positions`);

        if (orders.length === 0) {
          return {
            success: true,
            message: 'No orders need position creation',
            ordersProcessed: 0,
            positionsCreated: 0
          };
        }

        // Convert database orders to Order interface
        const mappedOrders = orders.map(dbOrder => ({
          id: dbOrder.id,
          ordertxid: dbOrder.ordertxid || `order-${dbOrder.id}`,
          time: Number(dbOrder.time),
          date: new Date(Number(dbOrder.time)),
          type: dbOrder.type as 'buy' | 'sell',
          direction: dbOrder.direction || undefined,
          pair: dbOrder.pair,
          amount: Number(dbOrder.amount),
          highestPrice: Number(dbOrder.highestPrice),
          lowestPrice: Number(dbOrder.lowestPrice),
          averagePrice: Number(dbOrder.averagePrice),
          totalCost: Number(dbOrder.totalCost),
          exchange: dbOrder.exchange,
          trades: [], // Empty for now as we don't need trade details for position creation
          fee: Number(dbOrder.fee),
          closedPnL: Number(dbOrder.closedPnL) || 0,
          status: dbOrder.status || undefined,
        }));

        if (dryRun) {
          // Just show what would be created
          const positionAggregator = EnhancedPositionAggregator.createForStrategy('positionByDirection');
          const positions = positionAggregator.aggregate(mappedOrders);
          
          return {
            success: true,
            message: `Dry run: Would create ${positions.length} positions from ${orders.length} orders`,
            ordersProcessed: orders.length,
            positionsCreated: positions.length,
            dryRun: true
          };
        }

        // Create positions
        const positionAggregator = EnhancedPositionAggregator.createForStrategy('positionByDirection');
        const positions = positionAggregator.aggregate(mappedOrders);
        
        console.log(`📊 Generated ${positions.length} positions`);

        if (positions.length > 0) {
          const positionRepository = new PositionRepository(ctx.db);
          const savedPositions = await positionRepository.saveAll(positions, currentUserId);
          
          console.log(`✅ Successfully saved ${savedPositions.length} positions`);
          
          return {
            success: true,
            message: `Created ${savedPositions.length} positions from ${orders.length} orders`,
            ordersProcessed: orders.length,
            positionsCreated: savedPositions.length
          };
        }

        return {
          success: true,
          message: 'No positions could be created from the available orders',
          ordersProcessed: orders.length,
          positionsCreated: 0
        };

      } catch (error) {
        console.error('❌ Error creating positions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create positions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
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
        
        console.log('🔄 Starting sync trades mutation:', { 
          userId, 
          mode, 
          since,
          hasEncryptedKeys: !!encryptedKeys 
        });
        
        // 1. Run the sync to get sync status
        const tradeSyncService = new TradeSyncService();
        console.log('🚀 Calling TradeSyncService.syncTrades...');
        const syncResult = await tradeSyncService.syncTrades(userId, encryptedKeys, mode, since);
        console.log('📊 TradeSyncService result:', syncResult);
        
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
              
              // Generate and save positions from orders
              console.log(`🏗️  Creating positions from ${savedOrders.length} orders...`);
              try {
                const positionAggregator = EnhancedPositionAggregator.createForStrategy('positionByDirection');
                const positions = positionAggregator.aggregate(savedOrders);
                
                console.log(`📊 Generated ${positions.length} positions`);
                
                if (positions.length > 0) {
                  const positionRepository = new PositionRepository(ctx.db);
                  const savedPositions = await positionRepository.saveAll(positions, userId);
                  console.log(`✅ Successfully saved ${savedPositions.length} positions`);
                }
              } catch (positionError) {
                console.error('❌ Error creating positions:', positionError);
                // Don't fail the entire sync if position creation fails
              }
            }
            
            // Update trade-order relationships
            await Promise.all(
              trades.allTrades.map(async (trade: Trade) => {
                if (!trade?.tradeId) return;
                
                try {
                  await ctx.db.userTrade.update({
                    where: { tradeId: trade.tradeId },
                    data: { ordertxid: trade.ordertxid ?? '' },
                  });
                } catch (updateError) {
                  console.error('Error updating trade-order relationship:', updateError);
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

  deleteAllPositions: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const userId = ctx.session.user.id;
        console.log('🗑️ Starting deletion of all positions for user:', userId);

        // First, get count of positions to delete
        const count = await ctx.db.position.count({
          where: {
            userId: userId
          }
        });
        
        console.log(`📊 Found ${count} positions to delete`);
        
        if (count === 0) {
          return {
            success: true,
            message: 'No positions to delete',
            deletedCount: 0
          };
        }

        // Get all positions with their order IDs to unlink them
        const positions = await ctx.db.position.findMany({
          where: {
            userId: userId
          },
          include: {
            orders: {
              select: {
                id: true
              }
            }
          }
        });
        
        console.log(`🔗 Found ${positions.length} positions with ${positions.reduce((sum, p) => sum + p.orders.length, 0)} linked orders`);
        
        // First, unlink all orders from positions
        if (positions.some(p => p.orders.length > 0)) {
          console.log('🔗 Unlinking orders from positions...');
          const unlinkResult = await ctx.db.order.updateMany({
            where: {
              positionId: {
                in: positions.map(p => p.id)
              }
            },
            data: {
              positionId: null
            }
          });
          
          console.log(`✅ Unlinked ${unlinkResult.count} orders from positions`);
        }
        
        // Then delete all positions
        console.log('🗑️ Deleting all positions...');
        const deleteResult = await ctx.db.position.deleteMany({
          where: {
            userId: userId
          }
        });
        
        console.log(`✅ Deleted ${deleteResult.count} positions`);
        
        // Verify cleanup
        const remainingCount = await ctx.db.position.count({
          where: {
            userId: userId
          }
        });
        
        if (remainingCount === 0) {
          console.log('✅ Position deletion completed successfully');
          return {
            success: true,
            message: `Successfully deleted ${deleteResult.count} positions`,
            deletedCount: deleteResult.count
          };
        } else {
          console.warn(`⚠️ Warning: ${remainingCount} positions still remain`);
          return {
            success: false,
            message: `Deletion incomplete: ${remainingCount} positions still remain`,
            deletedCount: deleteResult.count
          };
        }
        
      } catch (error) {
        console.error('❌ Error deleting positions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete positions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
});
