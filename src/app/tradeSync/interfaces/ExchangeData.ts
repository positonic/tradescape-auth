export interface Position {
  coin: string;
  size: number;
  leverage: {
    type: string;
    value: string;
  };
  entryPrice: number;
  positionValue: number;
  unrealizedPnl: number;
  returnOnEquity: number;
  liquidationPrice: number | null;
  marginUsed: number;
  maxLeverage: string;
  cumulativeFunding: {
    allTime: string;
    sinceOpen: string;
    sinceChange: string;
  };
}

export interface MarginSummary {
  accountValue: number;
  totalNotionalPosition: number;
  totalRawUsd: number;
  totalMarginUsed: number;
}

export interface TokenBalance {
  total: number;
  free: number;
  used: number;
  usdValue: number;
}

export interface Balances {
  [exchange: string]: {
    total: {
      [currency: string]: number;
    };
    used?: {
      [currency: string]: number;
    };
    free?: {
      [currency: string]: number;
    };
    usdValue: {
      [currency: string]: number;
    };
  };
}

export interface ExchangeData {
  exchange: string;
  timestamp: number;
  datetime: string;
  marginSummary?: MarginSummary;
  crossMarginSummary?: MarginSummary;
  crossMaintenanceMarginUsed?: number;
  withdrawable?: number;
  positions: Position[];
  balances: {
    [token: string]: TokenBalance;
  };
  totalUsdValue: number;
}

export interface ApiResponse {
  data: ExchangeData[];
  error?: string;
}
