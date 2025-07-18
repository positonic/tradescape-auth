import WebSocket from "ws";
import ccxt from "ccxt";
import Exchange from "../../app/tradeSync/exchange/Exchange";

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
}

interface LiveBalance {
  asset: string;
  free: number;
  used: number;
  total: number;
  usdValue: number;
}

interface LiveData {
  positions: LivePosition[];
  balances: LiveBalance[];
  totalUsdValue: number;
  timestamp: number;
}

interface UserConnection {
  credentials: HyperliquidCredentials;
  ws: WebSocket | null;
  exchange: any | null;
  lastData: LiveData | null;
  isConnected: boolean;
  subscriptions: Set<string>;
}

export class HyperliquidWebSocketManager {
  private static instance: HyperliquidWebSocketManager;
  private userConnections: Map<string, UserConnection> = new Map();
  private readonly WS_URL = "wss://api.hyperliquid.xyz/ws";
  private readonly RECONNECT_DELAY = 5000;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  private constructor() {}

  static getInstance(): HyperliquidWebSocketManager {
    if (!HyperliquidWebSocketManager.instance) {
      HyperliquidWebSocketManager.instance = new HyperliquidWebSocketManager();
    }
    return HyperliquidWebSocketManager.instance;
  }

  async subscribeUser(userId: string, credentials: HyperliquidCredentials): Promise<void> {
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
        apiKey: connection.credentials.apiKey || undefined,
        secret: connection.credentials.apiSecret || undefined,
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

      ws.on("message", (data: any) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(userId, message);
        } catch (error) {
          console.error(`Failed to parse WebSocket message for user ${userId}:`, error);
        }
      });

      ws.on("close", () => {
        console.log(`WebSocket disconnected for user ${userId}`);
        connection.isConnected = false;
        this.scheduleReconnect(userId);
      });

      ws.on("error", (error: any) => {
        console.error(`WebSocket error for user ${userId}:`, error);
        connection.isConnected = false;
      });

    } catch (error) {
      console.error(`Failed to create WebSocket connection for user ${userId}:`, error);
      throw error;
    }
  }

  private subscribeToChannels(userId: string): void {
    const connection = this.userConnections.get(userId);
    if (!connection || !connection.ws) return;

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
        connection.ws!.send(JSON.stringify(sub));
        connection.subscriptions.add(sub.subscription.type);
      });

      console.log(`Subscribed to channels for user ${userId}`);
    } catch (error) {
      console.error(`Failed to subscribe to channels for user ${userId}:`, error);
    }
  }

  private handleWebSocketMessage(userId: string, message: any): void {
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
      console.error(`Failed to handle WebSocket message for user ${userId}:`, error);
    }
  }

  private handleUserEvents(userId: string, data: any): void {
    console.log(`User events for ${userId}:`, data);
    // Handle fills, funding, liquidations, etc.
  }

  private handleActiveAssetData(userId: string, data: any): void {
    console.log(`Active asset data for ${userId}:`, data);
    // Handle position and balance updates
  }

  private handleUserFills(userId: string, data: any): void {
    console.log(`User fills for ${userId}:`, data);
    // Handle trade fills
  }

  private async fetchInitialData(userId: string): Promise<void> {
    const connection = this.userConnections.get(userId);
    if (!connection || !connection.exchange) return;

    try {
      // Use CCXT exchange directly for data fetching
      const exchange = connection.exchange;
      
      // Fetch positions and balances
      const [positions, balances] = await Promise.all([
        exchange.fetchPositions ? exchange.fetchPositions() : [],
        exchange.fetchBalance ? exchange.fetchBalance() : {},
      ]);

      // Transform data to our format
      const liveData: LiveData = {
        positions: this.transformPositions(positions),
        balances: this.transformBalances(balances),
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

  private transformPositions(positions: any[]): LivePosition[] {
    return positions.map(position => ({
      pair: position.symbol || position.pair || "UNKNOWN",
      side: position.side === "buy" || position.side === "long" ? "long" : "short",
      size: Math.abs(position.size || position.amount || 0),
      entryPrice: position.entryPrice || position.price || 0,
      markPrice: position.markPrice || position.price || 0,
      unrealizedPnl: position.unrealizedPnl || 0,
      percentage: position.percentage || 0,
      timestamp: position.timestamp || Date.now(),
    }));
  }

  private transformBalances(balances: any): LiveBalance[] {
    const result: LiveBalance[] = [];
    
    for (const [asset, balance] of Object.entries(balances)) {
      if (asset === "info" || asset === "timestamp" || asset === "datetime") continue;
      
      const bal = balance as any;
      if (bal.total > 0) {
        result.push({
          asset: asset.toUpperCase(),
          free: bal.free || 0,
          used: bal.used || 0,
          total: bal.total || 0,
          usdValue: bal.usdValue || 0,
        });
      }
    }
    
    return result;
  }

  private calculateTotalUsdValue(balances: any): number {
    let total = 0;
    for (const [asset, balance] of Object.entries(balances)) {
      if (asset === "info" || asset === "timestamp" || asset === "datetime") continue;
      const bal = balance as any;
      total += bal.usdValue || 0;
    }
    return total;
  }

  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  private debouncedDataRefresh(userId: string): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.fetchInitialData(userId);
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
        this.createWebSocketConnection(userId);
      }
    }, this.RECONNECT_DELAY);
  }

  // Cleanup method to be called on server shutdown
  public async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.userConnections.keys()).map(
      userId => this.unsubscribeUser(userId)
    );
    await Promise.all(cleanupPromises);
  }
}