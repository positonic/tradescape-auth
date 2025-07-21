import { type PrismaClient } from "@prisma/client";
import { HyperliquidWebSocketManager } from "../hyperliquid/WebSocketManager";
import { decryptFromTransmission } from "../../lib/keyEncryption";
import Exchange from "../../app/tradeSync/exchange/Exchange";
import ccxt from "ccxt";
import type {
  PortfolioSnapshot,
  CreateSnapshotInput,
  SnapshotListFilters,
  PortfolioValueChange,
} from "../../lib/interfaces/BalanceSnapshot";

export class PortfolioSnapshotService {
  constructor(private db: PrismaClient) {}

  /**
   * Capture a snapshot from either live data or direct exchange fetch
   */
  async captureSnapshot(
    userId: string,
    encryptedKeys?: string,
  ): Promise<PortfolioSnapshot> {
    let totalUsdValue = 0;
    let exchange = "unknown";

    // Try to get data from live WebSocket connection first
    try {
      const wsManager = HyperliquidWebSocketManager.getInstance();
      const liveData = await wsManager.getCurrentData(userId);

      if (liveData) {
        totalUsdValue = liveData.totalUsdValue;
        exchange = "hyperliquid";
      }
    } catch (error) {
      console.log("No live data available, will try direct exchange fetch");
    }

    // If no live data and we have encrypted keys, fetch directly from exchange
    if (totalUsdValue === 0 && encryptedKeys) {
      try {
        const decryptedKeys = decryptFromTransmission(encryptedKeys);
        if (decryptedKeys && decryptedKeys.length > 0) {
          const hyperliquidKeys = decryptedKeys[0];

          if (hyperliquidKeys?.walletAddress) {
            const exchangeClient = new Exchange(
              ccxt,
              hyperliquidKeys.apiKey ?? "",
              hyperliquidKeys.apiSecret ?? "",
              "hyperliquid",
              hyperliquidKeys.walletAddress,
            );

            const balanceData = await exchangeClient.getBalances();
            totalUsdValue = balanceData.totalUsdValue;
            exchange = "hyperliquid";
          }
        }
      } catch (error) {
        console.error("Failed to fetch balance from exchange:", error);
      }
    }

    // Allow 0 value snapshots - user might have $0 portfolio or there might be a calculation issue
    if (totalUsdValue === 0) {
      console.warn(
        "Portfolio value is $0 - this might be correct or indicate a USD calculation issue in the exchange data",
      );
    }

    // Prepare snapshot data
    const snapshotInput: CreateSnapshotInput = {
      exchange,
      totalUsdValue,
    };

    return await this.createSnapshot(userId, snapshotInput);
  }

  /**
   * Create a snapshot in the database
   */
  async createSnapshot(
    userId: string,
    input: CreateSnapshotInput,
  ): Promise<PortfolioSnapshot> {
    const snapshot = await this.db.portfolioSnapshot.create({
      data: {
        userId,
        exchange: input.exchange,
        totalUsdValue: input.totalUsdValue,
      },
    });

    return this.transformDatabaseSnapshot(snapshot);
  }

  /**
   * Get snapshots for a user with optional filters
   */
  async getSnapshots(
    userId: string,
    filters: SnapshotListFilters = {},
  ): Promise<PortfolioSnapshot[]> {
    const { startDate, endDate, exchange, limit = 50, offset = 0 } = filters;

    const snapshots = await this.db.portfolioSnapshot.findMany({
      where: {
        userId,
        ...(exchange && { exchange }),
        ...(startDate &&
          endDate && {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          }),
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
      skip: offset,
    });

    return snapshots.map(this.transformDatabaseSnapshot);
  }

  /**
   * Get a specific snapshot by ID
   */
  async getSnapshot(
    snapshotId: string,
    userId: string,
  ): Promise<PortfolioSnapshot | null> {
    const snapshot = await this.db.portfolioSnapshot.findFirst({
      where: {
        id: snapshotId,
        userId,
      },
    });

    return snapshot ? this.transformDatabaseSnapshot(snapshot) : null;
  }

  /**
   * Compare two snapshots
   */
  async compareSnapshots(
    userId: string,
    previousSnapshotId: string,
    currentSnapshotId: string,
  ): Promise<PortfolioValueChange> {
    const [previous, current] = await Promise.all([
      this.getSnapshot(previousSnapshotId, userId),
      this.getSnapshot(currentSnapshotId, userId),
    ]);

    if (!previous || !current) {
      throw new Error("One or both snapshots not found");
    }

    // Calculate total value changes
    const totalUsdValueChange = current.totalUsdValue - previous.totalUsdValue;
    const totalUsdValueChangePercent =
      previous.totalUsdValue > 0
        ? (totalUsdValueChange / previous.totalUsdValue) * 100
        : 0;

    const timeDifference =
      current.timestamp.getTime() - previous.timestamp.getTime();

    return {
      previous,
      current,
      changes: {
        totalUsdValueChange,
        totalUsdValueChangePercent,
        timeDifference,
      },
    };
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string, userId: string): Promise<boolean> {
    const result = await this.db.portfolioSnapshot.deleteMany({
      where: {
        id: snapshotId,
        userId,
      },
    });

    return result.count > 0;
  }

  /**
   * Clean up old snapshots based on retention policy
   */
  async cleanupOldSnapshots(
    userId: string,
    retentionDays: number = 30,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.portfolioSnapshot.deleteMany({
      where: {
        userId,
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Transform database snapshot to interface format
   */
  private transformDatabaseSnapshot(snapshot: any): PortfolioSnapshot {
    return {
      id: snapshot.id,
      userId: snapshot.userId,
      exchange: snapshot.exchange,
      timestamp: snapshot.timestamp,
      totalUsdValue: Number(snapshot.totalUsdValue),
    };
  }
}
