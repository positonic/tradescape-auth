export interface PortfolioSnapshot {
  id: string;
  userId: string;
  exchange: string;
  timestamp: Date;
  totalUsdValue: number;
}

export interface PortfolioValueChange {
  previous: PortfolioSnapshot;
  current: PortfolioSnapshot;
  changes: {
    totalUsdValueChange: number;
    totalUsdValueChangePercent: number;
    timeDifference: number; // milliseconds between snapshots
  };
}

export interface SnapshotListFilters {
  startDate?: Date;
  endDate?: Date;
  exchange?: string;
  limit?: number;
  offset?: number;
}

export interface CreateSnapshotInput {
  exchange: string;
  totalUsdValue: number;
}

export interface SnapshotConfig {
  frequency: "hourly" | "daily" | "weekly";
  retentionDays: number;
  autoCleanup: boolean;
  exchanges: string[];
}