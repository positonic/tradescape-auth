import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getDayBoundsMs, getTodayDateString } from "~/lib/tradeUtils";

interface PairBreakdown {
  pair: string;
  tradeCount: number;
  orderCount: number;
  buyVolume: number;
  sellVolume: number;
  netPnL: number;
  fees: number;
}

export const dailyRouter = createTRPCRouter({
  getSummary: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { date } = input;

      try {
        const { startMs, endMs } = getDayBoundsMs(date);
        const dayStart = BigInt(startMs);
        const dayEnd = BigInt(endMs);

        // Run queries in parallel
        const [trades, orders, positionsOpened, positionsClosed] =
          await Promise.all([
            ctx.db.userTrade.findMany({
              where: {
                userId,
                time: { gte: dayStart, lt: dayEnd },
              },
              orderBy: { time: "asc" },
            }),
            ctx.db.order.findMany({
              where: {
                userId,
                time: { gte: dayStart, lt: dayEnd },
              },
              orderBy: { time: "asc" },
            }),
            ctx.db.position.findMany({
              where: {
                userId,
                time: { gte: dayStart, lt: dayEnd },
              },
              orderBy: { time: "asc" },
            }),
            ctx.db.position.findMany({
              where: {
                userId,
                status: "closed",
                updatedAt: {
                  gte: new Date(startMs),
                  lt: new Date(endMs),
                },
              },
              orderBy: { time: "asc" },
            }),
          ]);

        // Deduplicate positions (a position opened and closed same day appears in both)
        const closedPositionIds = new Set(
          positionsClosed.map((p) => p.id),
        );
        const openedOnly = positionsOpened.filter(
          (p) => !closedPositionIds.has(p.id),
        );

        // Compute stats from orders
        let totalVolume = 0;
        let netPnL = 0;
        let winCount = 0;
        let lossCount = 0;
        let totalFees = 0;
        let largestWin = 0;
        let largestLoss = 0;

        const pairMap = new Map<string, PairBreakdown>();

        for (const order of orders) {
          const cost = Number(order.totalCost);
          const fee = Number(order.fee);
          const pnl = order.closedPnL ? Number(order.closedPnL) : 0;

          totalVolume += cost;
          totalFees += fee;
          netPnL += pnl;

          if (order.closedPnL !== null) {
            if (pnl > 0) {
              winCount += 1;
              if (pnl > largestWin) largestWin = pnl;
            } else if (pnl < 0) {
              lossCount += 1;
              if (pnl < largestLoss) largestLoss = pnl;
            }
          }

          // Build pair breakdown
          const existing = pairMap.get(order.pair) ?? {
            pair: order.pair,
            tradeCount: 0,
            orderCount: 0,
            buyVolume: 0,
            sellVolume: 0,
            netPnL: 0,
            fees: 0,
          };

          existing.orderCount += 1;
          existing.fees += fee;
          existing.netPnL += pnl;

          if (order.type === "buy") {
            existing.buyVolume += cost;
          } else {
            existing.sellVolume += cost;
          }

          pairMap.set(order.pair, existing);
        }

        // Count raw trades per pair
        for (const trade of trades) {
          const existing = pairMap.get(trade.pair);
          if (existing) {
            existing.tradeCount += 1;
          }
        }

        const uniquePairs = pairMap.size;
        const totalDecisions = winCount + lossCount;
        const winRate = totalDecisions > 0 ? (winCount / totalDecisions) * 100 : 0;

        const pairBreakdowns = Array.from(pairMap.values()).sort(
          (a, b) => Math.abs(b.netPnL) - Math.abs(a.netPnL),
        );

        // Check adjacent days for navigation hints
        const prevDayStart = BigInt(startMs - 86400000);
        const nextDayEnd = BigInt(endMs + 86400000);
        const isToday = date === getTodayDateString();

        const [prevCount, nextCount] = await Promise.all([
          ctx.db.order.count({
            where: {
              userId,
              time: { gte: prevDayStart, lt: dayStart },
            },
          }),
          isToday
            ? Promise.resolve(0)
            : ctx.db.order.count({
                where: {
                  userId,
                  time: { gte: dayEnd, lt: nextDayEnd },
                },
              }),
        ]);

        return {
          date,
          stats: {
            totalTrades: trades.length,
            totalOrders: orders.length,
            totalVolume,
            netPnL,
            winCount,
            lossCount,
            winRate,
            uniquePairs,
            totalFees,
            largestWin,
            largestLoss,
          },
          pairBreakdowns,
          timeline: orders,
          positions: {
            opened: openedOnly,
            closed: positionsClosed,
          },
          hasPreviousDay: prevCount > 0,
          hasNextDay: nextCount > 0,
        };
      } catch (error) {
        console.error("Failed to fetch daily summary:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch daily summary",
          cause: error,
        });
      }
    }),
});
