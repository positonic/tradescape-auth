import { PrismaClient, Prisma } from "@prisma/client";
import { Position } from "../exchange/types";

export class PositionRepository {
  constructor(private prisma: PrismaClient) {}

  async saveAll(
    positions: Position[],
    userId: string,
  ): Promise<Array<Position & { id: number }>> {
    if (positions.length === 0) return [];

    console.log(
      `📊 [PositionRepository] Saving ${positions.length} positions for user ${userId}`,
    );

    const savedPositions: Array<Position & { id: number }> = [];

    for (const position of positions) {
      try {
        // Find or create pair record
        const pairRecord = await this.findOrCreatePair(position.pair);

        // Calculate position metrics
        const totalVolume = position.orders.reduce(
          (sum, order) => sum + Number(order.amount || 0),
          0,
        );
        const buyVolume = position.orders
          .filter((o) => o.type === "buy")
          .reduce((sum, order) => sum + Number(order.amount || 0), 0);
        const sellVolume = position.orders
          .filter((o) => o.type === "sell")
          .reduce((sum, order) => sum + Number(order.amount || 0), 0);

        const avgEntryPrice =
          buyVolume > 0 ? (position.buyCost || 0) / buyVolume : 0;
        const avgExitPrice =
          sellVolume > 0 ? (position.sellCost || 0) / sellVolume : 0;

        // Validate and convert values
        const buyCostSafe = this.safeNumber(position.buyCost);
        const sellCostSafe = this.safeNumber(position.sellCost);
        const profitLossSafe = this.safeNumber(position.profitLoss);
        // USE position.quantity (calculated max position size) instead of totalVolume (sum of all orders)
        const positionSizeSafe = this.safeNumber(position.quantity);
        const durationSafe = this.safeNumber(position.duration);
        const timeSafe = this.safeBigInt(position.time);

        // Debug logging only in development
        if (process.env.NODE_ENV === "development") {
          console.log(`🔍 [PositionRepository] Position data check:`, {
            pair: position.pair,
            buyCost: position.buyCost,
            sellCost: position.sellCost,
            profitLoss: position.profitLoss,
            duration: position.duration,
            time: position.time,
            amount: position.quantity,
            totalVolume,
            buyVolume,
            sellVolume,
          });
        }

        // Special debug logging for UNI/USDC:USDC to track the fix
        if (position.pair === "UNI/USDC:USDC") {
          console.log(
            `%c🔧 POSITION REPOSITORY FIX: ${position.pair}`,
            "background: red; color: white; font-weight: bold; padding: 2px 8px;",
          );
          console.log(
            `%c❌ OLD (wrong) totalVolume: ${totalVolume} (sum of all orders)`,
            "background: red; color: white; font-weight: bold; padding: 2px 8px;",
          );
          console.log(
            `%c✅ NEW (correct) position.quantity: ${position.quantity} (max position size)`,
            "background: green; color: white; font-weight: bold; padding: 2px 8px;",
          );
          console.log(
            `%c💾 Saving amount as: ${positionSizeSafe}`,
            "background: blue; color: white; font-weight: bold; padding: 2px 8px;",
          );
        }

        // Determine position status
        const isOpen = Math.abs(buyVolume - sellVolume) > 0.00001;
        const status = isOpen ? "open" : "closed";

        const positionData = {
          status,
          positionType: "automated", // Mark as automated aggregation
          direction: position.type,
          pair: position.pair,
          pairId: pairRecord?.id,
          averageEntryPrice: new Prisma.Decimal(avgEntryPrice || 0),
          averageExitPrice: new Prisma.Decimal(avgExitPrice || 0),
          totalCostBuy: new Prisma.Decimal(buyCostSafe),
          totalCostSell: new Prisma.Decimal(sellCostSafe),
          amount: new Prisma.Decimal(positionSizeSafe),
          profitLoss: new Prisma.Decimal(profitLossSafe),
          duration: this.formatDuration(durationSafe),
          time: timeSafe,
          userId,
        };
        console.log("!!!!!!!!positionData is ", positionData);
        // Create the position
        const createdPosition = await this.prisma.position.create({
          data: positionData,
        });

        // Link orders to this position
        const orderIds = position.orders
          .map((order) => order.id)
          .filter((id) => id !== undefined);
        if (orderIds.length > 0) {
          await this.prisma.order.updateMany({
            where: {
              id: { in: orderIds },
              userId,
            },
            data: {
              positionId: createdPosition.id,
            },
          });
        }

        savedPositions.push({
          ...position,
          id: createdPosition.id,
        });

        console.log(
          `✅ [PositionRepository] Created position ${createdPosition.id} for ${position.pair}`,
        );
      } catch (error) {
        console.error(
          `❌ [PositionRepository] Failed to save position for ${position.pair}:`,
          error,
        );
      }
    }

    console.log(
      `📊 [PositionRepository] Successfully saved ${savedPositions.length} positions`,
    );
    return savedPositions;
  }

  private async findOrCreatePair(
    pairSymbol: string,
  ): Promise<{ id: number } | null> {
    try {
      // Try to find existing pair
      let pairRecord = await this.prisma.pair.findUnique({
        where: { symbol: pairSymbol },
        select: { id: true },
      });

      if (!pairRecord) {
        // Try to find by normalized symbol (remove :USDC suffix)
        const normalizedSymbol = pairSymbol.split(":")[0];
        if (normalizedSymbol && normalizedSymbol !== pairSymbol) {
          pairRecord = await this.prisma.pair.findUnique({
            where: { symbol: normalizedSymbol },
            select: { id: true },
          });
        }
      }

      if (!pairRecord) {
        // Create new pair record
        pairRecord = await this.prisma.pair.create({
          data: {
            symbol: pairSymbol,
            baseCoinId: 1, // Default base coin
            quoteCoinId: 1, // Default quote coin
          },
          select: { id: true },
        });
        console.log(
          `📝 [PositionRepository] Created new Pair record for ${pairSymbol}`,
        );
      }

      return pairRecord;
    } catch (error) {
      console.error(
        `❌ [PositionRepository] Error finding/creating pair ${pairSymbol}:`,
        error,
      );
      return null;
    }
  }

  private formatDuration(durationMs: number): string {
    const minutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  }

  private safeNumber(value: any): number {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return 0;
    }

    // Handle NaN
    if (typeof value === "number" && isNaN(value)) {
      return 0;
    }

    // Handle string values (convert to number)
    if (typeof value === "string") {
      // Remove any non-numeric characters except dots and minus
      const cleaned = value.replace(/[^0-9.-]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }

    // Handle bigint
    if (typeof value === "bigint") {
      return Number(value);
    }

    // Handle number
    if (typeof value === "number") {
      return value;
    }

    // Default fallback
    return 0;
  }

  private safeBigInt(value: any): bigint {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return BigInt(0);
    }

    // Handle string values
    if (typeof value === "string") {
      // Remove any non-numeric characters except minus
      const cleaned = value.replace(/[^0-9-]/g, "");
      try {
        return BigInt(cleaned || "0");
      } catch {
        return BigInt(0);
      }
    }

    // Handle number
    if (typeof value === "number") {
      return BigInt(Math.floor(value));
    }

    // Handle bigint
    if (typeof value === "bigint") {
      return value;
    }

    // Default fallback
    return BigInt(0);
  }

  async getPositionsByPair(userId: string, pairId: number): Promise<any[]> {
    return await this.prisma.position.findMany({
      where: {
        userId,
        pairId,
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
    });
  }

  async getPositionsByUser(userId: string): Promise<any[]> {
    return await this.prisma.position.findMany({
      where: {
        userId,
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
    });
  }

  async deletePosition(positionId: number, userId: string): Promise<boolean> {
    try {
      // Unlink orders from this position
      await this.prisma.order.updateMany({
        where: {
          positionId,
          userId,
        },
        data: {
          positionId: null,
        },
      });

      // Delete the position
      await this.prisma.position.delete({
        where: {
          id: positionId,
          userId, // Ensure user owns this position
        },
      });

      return true;
    } catch (error) {
      console.error(
        `❌ [PositionRepository] Error deleting position ${positionId}:`,
        error,
      );
      return false;
    }
  }
}
