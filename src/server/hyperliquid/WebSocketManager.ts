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
    //console.log(`User fills for ${userId}:`, data);
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

      // Debug: Log raw position data
      console.log(`🔍 Raw positions data for user ${userId}:`, JSON.stringify(positions, null, 2));
      
      // Also fetch open orders to check for stop orders
      let openOrders: any[] = [];
      try {
        if (exchange.fetchOpenOrders) {
          openOrders = await exchange.fetchOpenOrders();
          console.log(`🔍 Raw open orders for user ${userId}:`, JSON.stringify(openOrders, null, 2));
        }
      } catch (orderError) {
        console.warn(`Failed to fetch open orders for user ${userId}:`, orderError);
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

  private transformPositions(positions: any[], openOrders: any[] = []): LivePosition[] {
    return positions.map(position => {
      // Debug: Log each position
      console.log(`🔍 Processing position:`, JSON.stringify(position, null, 2));
      
      // Try different fields for size - Hyperliquid might use different field names
      const size = Math.abs(
        parseFloat(position.size) || 
        parseFloat(position.amount) || 
        parseFloat(position.contracts) ||
        parseFloat(position.szi) || // Hyperliquid specific field
        0
      );
      
      const entryPrice = parseFloat(
        position.entryPrice || 
        position.price || 
        position.avgPrice ||
        position.averagePrice ||
        0
      );
      
      const markPrice = parseFloat(
        position.markPrice || 
        position.price || 
        position.lastPrice ||
        0
      );
      
      const pnl = parseFloat(position.unrealizedPnl || position.pnl || 0);
      const percentage = parseFloat(position.percentage || position.percent || 0);
      
      // Look for stop orders related to this position
      const positionSymbol = position.symbol || position.pair || position.coin;
      const positionCoin = position.info?.position?.coin || positionSymbol?.split('/')[0];
      let stopLoss: number | undefined;
      
      if (openOrders && openOrders.length > 0) {
        const stopOrder = openOrders.find(order => {
          // Match by symbol or coin
          const orderCoin = order.info?.coin || order.symbol?.split('/')[0];
          const symbolMatch = order.symbol === positionSymbol || orderCoin === positionCoin;
          
          // Check if it's a stop order and reduce-only (closing position)
          const isStopOrder = order.info?.isTrigger === true || 
                             order.info?.orderType?.toLowerCase().includes('stop') ||
                             order.type?.toLowerCase().includes('stop') ||
                             order.info?.triggerCondition !== "N/A";
          
          const isReduceOnly = order.reduceOnly === true || order.info?.reduceOnly === true;
          
          return symbolMatch && isStopOrder && isReduceOnly;
        });
        
        if (stopOrder) {
          stopLoss = parseFloat(
            stopOrder.triggerPrice || 
            stopOrder.info?.triggerPx || 
            stopOrder.stopPrice || 
            stopOrder.price || 
            0
          );
          console.log(`🎯 Found stop order for ${positionSymbol} (${positionCoin}):`, {
            triggerPrice: stopOrder.triggerPrice,
            triggerPx: stopOrder.info?.triggerPx,
            triggerCondition: stopOrder.info?.triggerCondition,
            reduceOnly: stopOrder.reduceOnly
          });
        }
      }
      
      // Also check if position object itself has stop loss data
      if (!stopLoss) {
        stopLoss = parseFloat(
          position.stopLoss || 
          position.stopPrice || 
          position.sl ||
          0
        ) || undefined;
      }
      
      // Calculate risk amount
      let riskAmount: number;
      let riskType: string;
      
      if (stopLoss && entryPrice && size) {
        // Calculate risk based on stop loss: (entry price - stop price) * quantity
        const priceDiff = Math.abs(entryPrice - stopLoss);
        riskAmount = priceDiff * size;
        riskType = "stop-based";
        console.log(`💰 Risk with stop: ${priceDiff} * ${size} = ${riskAmount}`);
      } else {
        // No stop loss - use best available risk calculation
        const liquidationPrice = parseFloat(position.info?.position?.liquidationPx || 0) || undefined;
        const marginUsed = parseFloat(position.collateral || position.initialMargin || position.info?.position?.marginUsed || 0);
        
        if (liquidationPrice && liquidationPrice > 0 && entryPrice && size) {
          // Use liquidation-based risk (more realistic)
          const priceDiff = Math.abs(entryPrice - liquidationPrice);
          riskAmount = priceDiff * size;
          riskType = "liquidation-based";
          console.log(`💰 Risk without stop (liquidation): ${priceDiff} * ${size} = ${riskAmount}`);
        } else if (marginUsed > 0) {
          // Use margin-based risk (actual capital at risk)
          riskAmount = marginUsed;
          riskType = "margin-based";
          console.log(`💰 Risk without stop (margin): ${marginUsed}`);
        } else {
          // Fallback to full loss scenario
          riskAmount = entryPrice * size;
          riskType = "full-loss";
          console.log(`💰 Risk without stop (full loss): ${entryPrice} * ${size} = ${riskAmount}`);
        }
      }
      
      // Extract additional trading data
      const leverage = parseFloat(position.leverage || position.info?.position?.leverage?.value || 0);
      const marginUsed = parseFloat(position.collateral || position.initialMargin || position.info?.position?.marginUsed || 0);
      const positionValue = parseFloat(position.notional || position.info?.position?.positionValue || 0);
      const liquidationPrice = parseFloat(position.info?.position?.liquidationPx || 0) || undefined;
      
      // Extract funding data
      const funding = position.info?.position?.cumFunding ? {
        allTime: parseFloat(position.info.position.cumFunding.allTime || 0),
        sinceOpen: parseFloat(position.info.position.cumFunding.sinceOpen || 0),
      } : undefined;

      const result = {
        pair: positionSymbol || "UNKNOWN",
        side: position.side === "buy" || position.side === "long" || (position.side === "sell" && size < 0) ? "long" : "short",
        size,
        entryPrice,
        markPrice,
        unrealizedPnl: pnl,
        percentage,
        timestamp: position.timestamp || Date.now(),
        stopLoss,
        riskAmount,
        riskType,
        leverage: leverage || undefined,
        marginUsed: marginUsed || undefined,
        positionValue: positionValue || undefined,
        liquidationPrice,
        funding,
      };
      
      console.log(`✅ Transformed position:`, result);
      return result;
    });
  }

  private transformOrders(orders: any[]): LiveOrder[] {
    return orders.map(order => {
      const isStopOrder = order.info?.isTrigger === true || 
                         order.info?.orderType?.toLowerCase().includes('stop') ||
                         order.type?.toLowerCase().includes('stop') ||
                         order.info?.triggerCondition !== "N/A";

      return {
        id: order.id || order.info?.oid || 'unknown',
        symbol: order.symbol || 'UNKNOWN',
        side: order.side as "buy" | "sell",
        type: order.type || order.info?.orderType || 'unknown',
        amount: parseFloat(order.amount || order.info?.sz || 0),
        price: parseFloat(order.price || order.info?.limitPx || 0),
        filled: parseFloat(order.filled || 0),
        remaining: parseFloat(order.remaining || order.info?.sz || 0),
        status: order.status || 'unknown',
        timestamp: order.timestamp || Date.now(),
        triggerPrice: order.triggerPrice || parseFloat(order.info?.triggerPx || 0) || undefined,
        triggerCondition: order.info?.triggerCondition !== "N/A" ? order.info?.triggerCondition : undefined,
        reduceOnly: order.reduceOnly === true || order.info?.reduceOnly === true,
        timeInForce: order.timeInForce || order.info?.tif || undefined,
        isStopOrder,
      };
    });
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