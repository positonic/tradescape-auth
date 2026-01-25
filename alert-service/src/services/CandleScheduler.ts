import type Redis from "ioredis";
import { PriceService } from "./PriceService.js";
import { AlertChecker } from "./AlertChecker.js";
import { redisKeys, getMarketIdentifier } from "../utils/redis.js";

// Supported intervals and their durations in milliseconds
const INTERVAL_MS: Record<string, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

export class CandleScheduler {
  private redis: Redis;
  private priceService: PriceService;
  private alertChecker: AlertChecker;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private running = false;

  constructor(
    redis: Redis,
    priceService: PriceService,
    alertChecker: AlertChecker
  ) {
    this.redis = redis;
    this.priceService = priceService;
    this.alertChecker = alertChecker;
  }

  /**
   * Calculate the next candle close time for a given interval
   */
  private getNextCandleClose(interval: string): Date {
    const now = new Date();
    const intervalMs = INTERVAL_MS[interval];

    if (!intervalMs) {
      throw new Error(`Unknown interval: ${interval}`);
    }

    // Calculate current candle start (rounded down to interval)
    const currentCandleStart = Math.floor(now.getTime() / intervalMs) * intervalMs;

    // Next candle close is when current candle ends
    const nextClose = new Date(currentCandleStart + intervalMs);

    return nextClose;
  }

  /**
   * Get time until next candle close in milliseconds
   */
  private getTimeUntilNextClose(interval: string): number {
    const nextClose = this.getNextCandleClose(interval);
    const delay = nextClose.getTime() - Date.now();

    // Add a small buffer (1 second) to ensure candle is fully closed
    return Math.max(delay + 1000, 1000);
  }

  /**
   * Get unique markets that have candle alerts for a specific interval
   */
  private async getMarketsForInterval(interval: string): Promise<Set<string>> {
    const markets = new Set<string>();

    // Scan for candle_alerts:*:{interval}:* keys
    const pattern = `candle_alerts:*:${interval}:*`;
    let cursor = "0";

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;

      for (const key of keys) {
        // Extract market from key: candle_alerts:BINANCE:BTCUSDT:4h:ABOVE
        const parts = key.split(":");
        if (parts.length >= 3) {
          const market = `${parts[1]}:${parts[2]}`;
          markets.add(market);
        }
      }
    } while (cursor !== "0");

    return markets;
  }

  /**
   * Convert market identifier to CCXT symbol
   */
  private marketToSymbol(market: string): string {
    const symbol = market.split(":")[1] ?? market;
    const quotes = ["USDT", "USDC", "BUSD", "BTC", "ETH", "USD"];

    for (const quote of quotes) {
      if (symbol.endsWith(quote)) {
        const base = symbol.slice(0, -quote.length);
        return `${base}/${quote}`;
      }
    }

    const base = symbol.slice(0, -4);
    const quote = symbol.slice(-4);
    return `${base}/${quote}`;
  }

  /**
   * Run candle close check for a specific interval
   */
  private async runCandleCheck(interval: string): Promise<void> {
    try {
      const markets = await this.getMarketsForInterval(interval);

      if (markets.size === 0) {
        return;
      }

      console.log(
        `[CandleScheduler] Running ${interval} candle check for ${markets.size} markets`
      );

      for (const market of markets) {
        const symbol = this.marketToSymbol(market);
        const closePrice = await this.priceService.fetchCandleClose(
          symbol,
          interval
        );

        if (closePrice !== null) {
          await this.alertChecker.checkCandleAlerts(market, interval, closePrice);
        }
      }
    } catch (error) {
      console.error(`[CandleScheduler] Error in ${interval} check:`, error);
    }
  }

  /**
   * Schedule the next candle check for an interval
   */
  private scheduleNextCheck(interval: string): void {
    if (!this.running) return;

    const delay = this.getTimeUntilNextClose(interval);
    const nextClose = this.getNextCandleClose(interval);

    console.log(
      `[CandleScheduler] Next ${interval} check at ${nextClose.toISOString()} (in ${Math.round(delay / 1000)}s)`
    );

    const timer = setTimeout(async () => {
      await this.runCandleCheck(interval);
      this.scheduleNextCheck(interval);
    }, delay);

    this.timers.set(interval, timer);
  }

  /**
   * Start all candle schedulers
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    console.log("[CandleScheduler] Starting candle close schedulers");

    // Start schedulers for all supported intervals
    for (const interval of Object.keys(INTERVAL_MS)) {
      this.scheduleNextCheck(interval);
    }
  }

  /**
   * Stop all candle schedulers
   */
  stop(): void {
    this.running = false;

    for (const [interval, timer] of this.timers) {
      clearTimeout(timer);
      console.log(`[CandleScheduler] Stopped ${interval} scheduler`);
    }

    this.timers.clear();
  }
}
