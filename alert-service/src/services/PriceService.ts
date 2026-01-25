import ccxt from "ccxt";
import type Redis from "ioredis";
import { getMarketIdentifier, redisKeys } from "../utils/redis.js";
import { config } from "../config.js";

export class PriceService {
  private exchange: ccxt.Exchange;
  private redis: Redis;
  private priceCache: Map<string, { price: number; timestamp: number }> =
    new Map();
  private cacheTtlMs = 2000; // 2 second cache

  constructor(redis: Redis) {
    this.redis = redis;
    // Initialize Binance exchange (can be extended to support multiple)
    this.exchange = new ccxt.binance({
      enableRateLimit: true,
    });
  }

  /**
   * Get unique markets that have alerts configured
   */
  async getMarketsWithAlerts(): Promise<Set<string>> {
    const markets = new Set<string>();

    // Scan Redis for all alert keys to find unique markets
    // Pattern: price_alerts:BINANCE:*:* and candle_alerts:BINANCE:*:*:*
    const priceKeys = await this.scanKeys("price_alerts:*");
    const candleKeys = await this.scanKeys("candle_alerts:*");

    for (const key of [...priceKeys, ...candleKeys]) {
      // Extract market from key: price_alerts:BINANCE:BTCUSDT:ABOVE -> BINANCE:BTCUSDT
      const parts = key.split(":");
      if (parts.length >= 3) {
        const market = `${parts[1]}:${parts[2]}`;
        markets.add(market);
      }
    }

    return markets;
  }

  /**
   * Scan Redis keys matching a pattern
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";

    do {
      const [nextCursor, foundKeys] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      keys.push(...foundKeys);
    } while (cursor !== "0");

    return keys;
  }

  /**
   * Convert market identifier to CCXT symbol
   * BINANCE:BTCUSDT -> BTC/USDT
   * Returns null for invalid/unparseable symbols
   */
  private marketToSymbol(market: string): string | null {
    // Remove exchange prefix: BINANCE:BTCUSDT -> BTCUSDT
    const symbol = market.split(":")[1] ?? market;

    // If symbol already contains "/", return as-is
    if (symbol.includes("/")) {
      return symbol;
    }

    // Skip symbols that are too short to be valid pairs
    if (symbol.length < 5) {
      console.warn(`[PriceService] Skipping invalid market symbol: ${market}`);
      return null;
    }

    // Common quote currencies to split on (order matters - longer first)
    const quotes = ["USDT", "USDC", "BUSD", "USD", "BTC", "ETH"];

    for (const quote of quotes) {
      if (symbol.endsWith(quote) && symbol.length > quote.length) {
        const base = symbol.slice(0, -quote.length);
        // Ensure valid pair: base must exist and not equal quote (no BTC/BTC)
        if (base.length > 0 && base.toUpperCase() !== quote.toUpperCase()) {
          return `${base}/${quote}`;
        }
      }
    }

    // Fallback for 8+ char symbols: assume last 4 chars are quote
    if (symbol.length >= 8) {
      const base = symbol.slice(0, -4);
      const quote = symbol.slice(-4);
      return `${base}/${quote}`;
    }

    console.warn(`[PriceService] Could not parse market symbol: ${market}`);
    return null;
  }

  /**
   * Fetch current price for a symbol
   */
  async fetchPrice(symbol: string): Promise<number | null> {
    const market = getMarketIdentifier(symbol);

    // Check cache first
    const cached = this.priceCache.get(market);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.price;
    }

    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      const price = ticker.last ?? ticker.close ?? null;

      if (price !== null) {
        this.priceCache.set(market, { price, timestamp: Date.now() });
      }

      return price;
    } catch (error) {
      console.error(`[PriceService] Error fetching ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch prices for all markets with alerts
   * Returns Map of market -> price
   */
  async fetchAllPrices(): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const markets = await this.getMarketsWithAlerts();

    if (markets.size === 0) {
      return prices;
    }

    console.log(`[PriceService] Fetching prices for ${markets.size} markets`);

    // Fetch prices in parallel with rate limiting
    const fetchPromises: Promise<void>[] = [];

    for (const market of markets) {
      const symbol = this.marketToSymbol(market);

      // Skip invalid symbols
      if (!symbol) {
        continue;
      }

      fetchPromises.push(
        (async () => {
          const price = await this.fetchPrice(symbol);
          if (price !== null) {
            prices.set(market, price);
          }
        })(),
      );
    }

    await Promise.all(fetchPromises);

    return prices;
  }

  /**
   * Fetch OHLCV candle data for candle close alerts
   */
  async fetchCandleClose(
    symbol: string,
    interval: string,
  ): Promise<number | null> {
    try {
      // Map interval format: 4h -> 4h, 1d -> 1d (CCXT compatible)
      const ccxtInterval = interval.toLowerCase();

      // Fetch last 2 candles to get the most recently closed one
      const ohlcv = await this.exchange.fetchOHLCV(
        symbol,
        ccxtInterval,
        undefined,
        2,
      );

      if (ohlcv && ohlcv.length >= 2) {
        // Return close price of second-to-last candle (most recently closed)
        const lastClosedCandle = ohlcv[ohlcv.length - 2];
        return lastClosedCandle?.[4] ?? null; // Index 4 is close price
      }

      return null;
    } catch (error) {
      console.error(
        `[PriceService] Error fetching candle for ${symbol}:`,
        error,
      );
      return null;
    }
  }
}
