import WebSocket from "ws";
import ccxt from "ccxt";
import type { Exchange } from "ccxt";

interface HyperliquidCredentials {
  apiKey: string;
  apiSecret: string;
  walletAddress: string;
}

interface LivePosition {
  pair: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  percentage: number;
  timestamp: number;
  stopLoss?: number;
  riskAmount: number;
  riskType?: string;
  leverage?: number;
  marginUsed?: number;
  positionValue?: number;
  liquidationPrice?: number;
  funding?: {
    allTime: number;
    sinceOpen: number;
  };
}

interface LiveBalance {
  asset: string;
  free: number;
  used: number;
  total: number;
  usdValue: number;
}

interface LiveOrder {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  type: string;
  amount: number;
  price: number;
  filled: number;
  remaining: number;
  status: string;
  timestamp: number;
  triggerPrice?: number;
  triggerCondition?: string;
  reduceOnly: boolean;
  timeInForce?: string;
  isStopOrder: boolean;
  isTakeProfitOrder: boolean;
}

interface LiveData {
  positions: LivePosition[];
  balances: LiveBalance[];
  orders: LiveOrder[];
  totalUsdValue: number;
  timestamp: number;
}

interface UserConnection {
  credentials: HyperliquidCredentials;
  ws: WebSocket | null;
  exchange: Exchange | null;
  lastData: LiveData | null;
  isConnected: boolean;
  subscriptions: Set<string>;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type HyperliquidMessage = {
  channel?: string;
  data?: JsonValue;
};

type PositionLike = {
  size?: number | string;
  amount?: number | string;
  contracts?: number | string;
  szi?: number | string;
  entryPrice?: number | string;
  price?: number | string;
  avgPrice?: number | string;
  averagePrice?: number | string;
  markPrice?: number | string;
  lastPrice?: number | string;
  unrealizedPnl?: number | string;
  pnl?: number | string;
  percentage?: number | string;
  percent?: number | string;
  symbol?: string;
  pair?: string;
  coin?: string;
  side?: string;
  timestamp?: number;
  stopLoss?: number | string;
  stopPrice?: number | string;
  sl?: number | string;
  collateral?: number | string;
  initialMargin?: number | string;
  notional?: number | string;
  leverage?: number | string;
  info?: {
    position?: {
      coin?: string;
      liquidationPx?: number | string;
      marginUsed?: number | string;
      positionValue?: number | string;
      leverage?: {
        value?: number | string;
      };
      cumFunding?: {
        allTime?: number | string;
        sinceOpen?: number | string;
      };
    };
  };
};

type OrderLike = {
  id?: string;
  symbol?: string;
  side?: string;
  type?: string;
  amount?: number | string;
  price?: number | string;
  filled?: number | string;
  remaining?: number | string;
  status?: string;
  timestamp?: number;
  triggerPrice?: number | string;
  stopPrice?: number | string;
  reduceOnly?: boolean;
  timeInForce?: string;
  info?: {
    oid?: string;
    orderType?: string;
    sz?: number | string;
    limitPx?: number | string;
    triggerPx?: number | string;
    triggerCondition?: string;
    reduceOnly?: boolean;
    tif?: string;
    coin?: string;
  };
};

type BalanceLike = {
  free?: number;
  used?: number;
  total?: number;
  usdValue?: number;
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const parseJsonSafely = (input: string): JsonValue | null => {
  try {
    return JSON.parse(input) as JsonValue;
  } catch {
    return null;
  }
};

const rawDataToString = (data: WebSocket.RawData): string => {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data).toString("utf8");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositionLike = (value: unknown): value is PositionLike =>
  isRecord(value);

const isOrderLike = (value: unknown): value is OrderLike => isRecord(value);

export class HyperliquidWebSocketManager {
  private static instance: HyperliquidWebSocketManager;
  private userConnections: Map<string, UserConnection>;
  private readonly WS_URL = "wss://api.hyperliquid.xyz/ws";
  private readonly RECONNECT_DELAY = 5000;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  private constructor() {
    this.userConnections = new Map<string, UserConnection>();
  }

  static getInstance(): HyperliquidWebSocketManager {
    if (!HyperliquidWebSocketManager.instance) {
      HyperliquidWebSocketManager.instance = new HyperliquidWebSocketManager();
    }
    return HyperliquidWebSocketManager.instance;
  }

  async subscribeUser(
    userId: string,
    credentials: HyperliquidCredentials,
  ): Promise<void> {
    try {
      // Clean up existing connection if any
      if (this.userConnections.has(userId)) {
        await this.unsubscribeUser(userId);
      }

      // Create new connection
      const userConnection: UserConnection = {
        credentials,
        ws: null,
        exchange: null,
        lastData: null,
        isConnected: false,
        subscriptions: new Set(),
      };

      this.userConnections.set(userId, userConnection);

      // Initialize CCXT exchange for REST API fallback
      await this.initializeExchange(userId);

      // Create WebSocket connection
      await this.createWebSocketConnection(userId);

      // Get initial data via REST API
      await this.fetchInitialData(userId);
    } catch (error) {
      console.error(`Failed to subscribe user ${userId}:`, error);
      this.userConnections.delete(userId);
      throw error;
    }
  }

  async unsubscribeUser(userId: string): Promise<void> {
    const connection = this.userConnections.get(userId);
    if (!connection) return;

    try {
      // Close WebSocket connection
      if (connection.ws) {
        connection.ws.close();
      }

      // Clean up exchange
      if (connection.exchange) {
        // CCXT exchanges don't need explicit cleanup
        connection.exchange = null;
      }

      // Remove from connections
      this.userConnections.delete(userId);

      console.log(`User ${userId} unsubscribed from live data`);
    } catch (error) {
      console.error(`Failed to unsubscribe user ${userId}:`, error);
    }
  }

  async getCurrentData(userId: string): Promise<LiveData | null> {
    const connection = this.userConnections.get(userId);
    if (!connection) return null;

    // Try to get fresh data if connection exists
    if (connection.isConnected) {
      try {
        await this.fetchInitialData(userId);
      } catch (error) {
        console.error(`Failed to fetch fresh data for user ${userId}:`, error);
      }
    }

    return connection.lastData;
  }

  isUserConnected(userId: string): boolean {
    const connection = this.userConnections.get(userId);
    return connection?.isConnected ?? false;
  }

  private async initializeExchange(userId: string): Promise<void> {
    const connection = this.userConnections.get(userId);
    if (!connection) throw new Error("User connection not found");

    try {
      // Create CCXT exchange instance for Hyperliquid
      // Note: Hyperliquid may require different authentication approach
      const exchange = new ccxt.hyperliquid({
        apiKey: connection.credentials.apiKey ?? undefined,
        secret: connection.credentials.apiSecret ?? undefined,
        walletAddress: connection.credentials.walletAddress,
        sandbox: false,
        enableRateLimit: true,
      });

      connection.exchange = exchange;
      console.log(`Exchange initialized for user ${userId}`);
    } catch (error) {
      console.error(`Failed to initialize exchange for user ${userId}:`, error);
      throw error;
    }
  }

  private async createWebSocketConnection(userId: string): Promise<void> {
    const connection = this.userConnections.get(userId);
    if (!connection) throw new Error("User connection not found");

    try {
      const ws = new WebSocket(this.WS_URL);
      connection.ws = ws;

      ws.on("open", () => {
        console.log(`WebSocket connected for user ${userId}`);
        connection.isConnected = true;
        this.subscribeToChannels(userId);
      });

      ws.on("message", (data: WebSocket.RawData) => {
        const raw = rawDataToString(data);
        const parsed = parseJsonSafely(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          console.error(
            `Failed to parse WebSocket message for user ${userId}`,
          );
          return;
        }

        this.handleWebSocketMessage(userId, parsed as HyperliquidMessage);
      });

      ws.on("close", () => {
        console.log(`WebSocket disconnected for user ${userId}`);
        connection.isConnected = false;
        this.scheduleReconnect(userId);
      });

      ws.on("error", (error: Error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
        connection.isConnected = false;
      });
    } catch (error) {
      console.error(
        `Failed to create WebSocket connection for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  private subscribeToChannels(userId: string): void {
    const connection = this.userConnections.get(userId);
    if (!connection?.ws) return;

    try {
      const subscriptions = [
        {
          method: "subscribe",
          subscription: {
            type: "userEvents",
            user: connection.credentials.walletAddress,
          },
        },
        {
          method: "subscribe",
          subscription: {
            type: "activeAssetData",
            user: connection.credentials.walletAddress,
          },
        },
        {
          method: "subscribe",
          subscription: {
            type: "userFills",
            user: connection.credentials.walletAddress,
          },
        },
      ];

      subscriptions.forEach((sub) => {
        connection.ws?.send(JSON.stringify(sub));
        connection.subscriptions.add(sub.subscription.type);
      });

      console.log(`Subscribed to channels for user ${userId}`);
    } catch (error) {
      console.error(
        `Failed to subscribe to channels for user ${userId}:`,
        error,
      );
    }
  }

  private handleWebSocketMessage(
    userId: string,
    message: HyperliquidMessage,
  ): void {
    const connection = this.userConnections.get(userId);
    if (!connection) return;

    try {
      // Handle subscription confirmation
      if (message.channel === "subscriptionResponse") {
        console.log(`Subscription confirmed for user ${userId}:`, message.data);
        return;
      }

      // Handle different message types
      if (message.channel === "userEvents") {
        this.handleUserEvents(userId, message.data);
      } else if (message.channel === "activeAssetData") {
        this.handleActiveAssetData(userId, message.data);
      } else if (message.channel === "userFills") {
        this.handleUserFills(userId, message.data);
      }

      // Trigger data refresh after receiving updates
      this.debouncedDataRefresh(userId);
    } catch (error) {
      console.error(
        `Failed to handle WebSocket message for user ${userId}:`,
        error,
      );
    }
  }

  private handleUserEvents(userId: string, data: JsonValue | undefined): void {
    console.log(`User events for ${userId}:`, data);
    // Handle fills, funding, liquidations, etc.
  }

  private handleActiveAssetData(
    userId: string,
    data: JsonValue | undefined,
  ): void {
    console.log(`Active asset data for ${userId}:`, data);
    // Handle position and balance updates
  }

  private handleUserFills(userId: string, data: JsonValue | undefined): void {
    //console.log(`User fills for ${userId}:`, data);
    // Handle trade fills
  }

  private async fetchInitialData(userId: string): Promise<void> {
    const connection = this.userConnections.get(userId);
    if (!connection?.exchange) return;

    try {
      // Use CCXT exchange directly for data fetching
      const exchange = connection.exchange;

      // Fetch positions and balances
      const [rawPositions, rawBalances] = await Promise.all([
        exchange.fetchPositions ? exchange.fetchPositions() : [],
        exchange.fetchBalance ? exchange.fetchBalance() : {},
      ]);

      const positions = Array.isArray(rawPositions)
        ? rawPositions.filter(isPositionLike)
        : [];
      const balances = isRecord(rawBalances) ? rawBalances : {};

      // Debug: Log raw position data
      console.log(
        `🔍 Raw positions data for user ${userId}:`,
        JSON.stringify(positions, null, 2),
      );

      // Also fetch open orders to check for stop orders
      let openOrders: OrderLike[] = [];
      try {
        if (exchange.fetchOpenOrders) {
          const rawOpenOrders = await exchange.fetchOpenOrders();
          openOrders = Array.isArray(rawOpenOrders)
            ? rawOpenOrders.filter(isOrderLike)
            : [];
          // console.log(
          //   `🔍 Raw open orders for user ${userId}:`,
          //   JSON.stringify(openOrders, null, 2),
          // );
          console.log(
            `🔍 Raw open orders for user for HYPE ${userId}:`,
            JSON.stringify(
              openOrders.filter((order) => order.symbol === "HYPE/USDC:USDC"),
              null,
              2,
            ),
          );
        }
      } catch (orderError) {
        console.warn(
          `Failed to fetch open orders for user ${userId}:`,
          orderError,
        );
      }

      // Transform data to our format
      const liveData: LiveData = {
        positions: this.transformPositions(positions, openOrders),
        balances: this.transformBalances(balances),
        orders: this.transformOrders(openOrders),
        totalUsdValue: this.calculateTotalUsdValue(balances),
        timestamp: Date.now(),
      };

      connection.lastData = liveData;

      // Emit to client if this is an update
      this.emitLiveDataUpdate(userId, liveData);
    } catch (error) {
      console.error(`Failed to fetch initial data for user ${userId}:`, error);
    }
  }

  private transformPositions(
    positions: PositionLike[],
    openOrders: OrderLike[] = [],
  ): LivePosition[] {
    return positions.map((position) => {
      // Debug: Log each position
      console.log(`🔍 Processing position:`, JSON.stringify(position, null, 2));

      // Try different fields for size - Hyperliquid might use different field names
      const size = Math.abs(
        toNumber(position.size) ||
          toNumber(position.amount) ||
          toNumber(position.contracts) ||
          toNumber(position.szi),
      );

      const entryPrice = toNumber(
        position.entryPrice ??
          position.price ??
          position.avgPrice ??
          position.averagePrice,
      );

      const markPrice = toNumber(
        position.markPrice ?? position.price ?? position.lastPrice,
      );

      const pnl = toNumber(position.unrealizedPnl ?? position.pnl);
      const percentage = toNumber(position.percentage ?? position.percent);

      // Look for stop orders related to this position
      const positionSymbol =
        position.symbol ?? position.pair ?? position.coin ?? undefined;
      const positionCoin =
        position.info?.position?.coin ?? positionSymbol?.split("/")[0];
      let stopLoss: number | undefined;

      if (openOrders && openOrders.length > 0) {
        const stopOrder = openOrders.find((order) => {
          // Match by symbol or coin
          const orderCoin = order.info?.coin ?? order.symbol?.split("/")[0];
          const symbolMatch =
            order.symbol === positionSymbol || orderCoin === positionCoin;

          // Check if it's a stop order and reduce-only (closing position)
          const infoOrderType = order.info?.orderType?.toLowerCase();
          const orderType = order.type?.toLowerCase();
          const isStopOrder =
            infoOrderType?.includes("stop") ??
            orderType?.includes("stop") ??
            false;

          const isReduceOnly =
            order.reduceOnly === true || order.info?.reduceOnly === true;

          return symbolMatch && isStopOrder && isReduceOnly;
        });

        if (stopOrder) {
          stopLoss = toNumber(
            stopOrder.triggerPrice ??
              stopOrder.info?.triggerPx ??
              stopOrder.price,
          );
          console.log(
            `🎯 Found stop order for ${positionSymbol} (${positionCoin}):`,
            {
              triggerPrice: stopOrder.triggerPrice,
              triggerPx: stopOrder.info?.triggerPx,
              triggerCondition: stopOrder.info?.triggerCondition,
              reduceOnly: stopOrder.reduceOnly,
            },
          );
        }
      }

      // Also check if position object itself has stop loss data
      if (!stopLoss) {
        const stopLossValue = toNumber(
          position.stopLoss ?? position.stopPrice ?? position.sl,
        );
        stopLoss = stopLossValue > 0 ? stopLossValue : undefined;
      }

      // Calculate risk amount
      let riskAmount: number;
      let riskType: string;

      if (stopLoss && entryPrice && size) {
        // Calculate risk based on stop loss: (entry price - stop price) * quantity
        const priceDiff = Math.abs(entryPrice - stopLoss);
        riskAmount = priceDiff * size;
        riskType = "stop-based";
        console.log(
          `💰 Risk with stop: ${priceDiff} * ${size} = ${riskAmount}`,
        );
      } else {
        // No stop loss - use best available risk calculation
        const liquidationValue = toNumber(position.info?.position?.liquidationPx);
        const liquidationPrice =
          liquidationValue > 0 ? liquidationValue : undefined;
        const marginUsed = toNumber(
          position.collateral ??
            position.initialMargin ??
            position.info?.position?.marginUsed,
        );

        if (liquidationPrice && liquidationPrice > 0 && entryPrice && size) {
          // Use liquidation-based risk (more realistic)
          const priceDiff = Math.abs(entryPrice - liquidationPrice);
          riskAmount = priceDiff * size;
          riskType = "liquidation-based";
          console.log(
            `💰 Risk without stop (liquidation): ${priceDiff} * ${size} = ${riskAmount}`,
          );
        } else if (marginUsed > 0) {
          // Use margin-based risk (actual capital at risk)
          riskAmount = marginUsed;
          riskType = "margin-based";
          console.log(`💰 Risk without stop (margin): ${marginUsed}`);
        } else {
          // Fallback to full loss scenario
          riskAmount = entryPrice * size;
          riskType = "full-loss";
          console.log(
            `💰 Risk without stop (full loss): ${entryPrice} * ${size} = ${riskAmount}`,
          );
        }
      }

      // Extract additional trading data
      const leverage = toNumber(
        position.leverage ?? position.info?.position?.leverage?.value,
      );
      const marginUsed = toNumber(
        position.collateral ??
          position.initialMargin ??
          position.info?.position?.marginUsed,
      );
      const positionValue = toNumber(
        position.notional ?? position.info?.position?.positionValue,
      );
      const liquidationValue = toNumber(position.info?.position?.liquidationPx);
      const liquidationPrice =
        liquidationValue > 0 ? liquidationValue : undefined;

      // Extract funding data
      const funding = position.info?.position?.cumFunding
        ? {
            allTime: toNumber(position.info.position.cumFunding.allTime),
            sinceOpen: toNumber(position.info.position.cumFunding.sinceOpen),
          }
        : undefined;

      const result: LivePosition = {
        pair: positionSymbol ?? "UNKNOWN",
        side:
          position.side === "buy" ||
          position.side === "long" ||
          (position.side === "sell" && size < 0)
            ? "long"
            : "short",
        size,
        entryPrice,
        markPrice,
        unrealizedPnl: pnl,
        percentage,
        timestamp: position.timestamp ?? Date.now(),
        stopLoss,
        riskAmount,
        riskType,
        leverage: leverage > 0 ? leverage : undefined,
        marginUsed: marginUsed > 0 ? marginUsed : undefined,
        positionValue: positionValue > 0 ? positionValue : undefined,
        liquidationPrice,
        funding,
      };

      console.log(`✅ Transformed position:`, result);
      return result;
    });
  }

  private transformOrders(orders: OrderLike[]): LiveOrder[] {
    return orders.map((order) => {
      const infoOrderType = order.info?.orderType?.toLowerCase();
      const orderType = order.type?.toLowerCase();
      const isStopOrder =
        infoOrderType?.includes("stop") ?? orderType?.includes("stop") ?? false;

      const isTakeProfitOrder =
        order.info?.orderType === "Take Profit Market" ||
        infoOrderType?.includes("take profit") === true ||
        orderType?.includes("take profit") === true ||
        infoOrderType?.includes("tp") === true;

      return {
        id: order.id ?? order.info?.oid ?? "unknown",
        symbol: order.symbol ?? "UNKNOWN",
        side: (order.side ?? "buy") as "buy" | "sell",
        type: order.type ?? order.info?.orderType ?? "unknown",
        amount: toNumber(order.amount ?? order.info?.sz),
        price: toNumber(order.price ?? order.info?.limitPx),
        filled: toNumber(order.filled),
        remaining: toNumber(order.remaining ?? order.info?.sz),
        status: order.status ?? "unknown",
        timestamp: order.timestamp ?? Date.now(),
        triggerPrice: (() => {
          const trigger = toNumber(order.triggerPrice ?? order.info?.triggerPx);
          return trigger > 0 ? trigger : undefined;
        })(),
        triggerCondition:
          order.info?.triggerCondition !== "N/A"
            ? order.info?.triggerCondition
            : undefined,
        reduceOnly:
          order.reduceOnly === true || order.info?.reduceOnly === true,
        timeInForce: order.timeInForce ?? order.info?.tif ?? undefined,
        isStopOrder,
        isTakeProfitOrder,
      };
    });
  }

  private transformBalances(
    balances: Record<string, unknown>,
  ): LiveBalance[] {
    const result: LiveBalance[] = [];

    for (const [asset, balance] of Object.entries(balances)) {
      if (asset === "info" || asset === "timestamp" || asset === "datetime")
        continue;

      if (!isRecord(balance)) continue;
      const bal = balance as BalanceLike;
      const total = toNumber(bal.total);
      if (total > 0) {
        result.push({
          asset: asset.toUpperCase(),
          free: toNumber(bal.free),
          used: toNumber(bal.used),
          total: total,
          usdValue: toNumber(bal.usdValue),
        });
      }
    }

    return result;
  }

  private calculateTotalUsdValue(balances: Record<string, unknown>): number {
    let total = 0;
    for (const [asset, balance] of Object.entries(balances)) {
      if (asset === "info" || asset === "timestamp" || asset === "datetime")
        continue;
      if (!isRecord(balance)) continue;
      const bal = balance as BalanceLike;
      total += toNumber(bal.usdValue);
    }
    return total;
  }

  private debounceTimers: Map<string, NodeJS.Timeout> =
    new Map<string, NodeJS.Timeout>();

  private debouncedDataRefresh(userId: string): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      void this.fetchInitialData(userId);
      this.debounceTimers.delete(userId);
    }, 1000); // 1 second debounce

    this.debounceTimers.set(userId, timer);
  }

  private emitLiveDataUpdate(userId: string, data: LiveData): void {
    console.log(`Live data update for user ${userId}:`, {
      positions: data.positions.length,
      balances: data.balances.length,
      totalUsdValue: data.totalUsdValue,
    });

    // Data is stored in connection.lastData and can be accessed via tRPC
    // Client will poll for updates using the getCurrentLiveData endpoint
  }

  private scheduleReconnect(userId: string): void {
    const connection = this.userConnections.get(userId);
    if (!connection) return;

    setTimeout(() => {
      if (this.userConnections.has(userId)) {
        console.log(`Attempting to reconnect user ${userId}`);
        void this.createWebSocketConnection(userId);
      }
    }, this.RECONNECT_DELAY);
  }

  // Cleanup method to be called on server shutdown
  public async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.userConnections.keys()).map(
      (userId) => this.unsubscribeUser(userId),
    );
    await Promise.all(cleanupPromises);
  }
}
