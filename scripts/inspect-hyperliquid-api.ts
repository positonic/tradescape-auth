#!/usr/bin/env bun
import ccxt from "ccxt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function inspectHyperliquidAPI() {
  console.log("🔍 Inspecting Hyperliquid API data via CCXT...\n");

  try {
    // Get user's exchange credentials

    // Initialize CCXT exchange
    const exchange = new ccxt.hyperliquid({
      apiKey: "-",
      secret: "-",
      // Hyperliquid specific options
      walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS!, // Hyperliquid uses wallet address as API key
    });

    // Test connection
    console.log("📡 Testing API connection...");
    await exchange.loadMarkets();
    console.log("✅ Connected to Hyperliquid\n");

    // Fetch recent trades
    console.log("📊 Fetching recent trades...");
    const trades = await exchange.fetchMyTrades(undefined, undefined, 10);

    console.log(`Found ${trades.length} recent trades:\n`);

    // Show raw trade structure
    if (trades.length > 0) {
      console.log("🔬 RAW TRADE STRUCTURE (First Trade):");
      console.log("=====================================");
      console.log(JSON.stringify(trades[0], null, 2));
      console.log("\n");

      // Show all trades in readable format
      console.log("📋 ALL TRADES SUMMARY:");
      console.log("======================");

      trades.forEach((trade, index) => {
        console.log(`\n🔹 Trade ${index + 1}:`);
        console.log(`   ID: ${trade.id}`);
        console.log(`   Order ID: ${trade.order}`);
        console.log(`   Symbol: ${trade.symbol}`);
        console.log(`   Type: ${trade.type || "N/A"}`);
        console.log(`   Side: ${trade.side}`);
        console.log(`   Price: $${trade.price}`);
        console.log(`   Amount: ${trade.amount}`);
        console.log(`   Cost: $${trade.cost}`);
        console.log(
          `   Fee: ${trade.fee ? `${trade.fee.cost} ${trade.fee.currency}` : "N/A"}`,
        );
        const timestampValue = trade.timestamp ?? null;
        const timestampLabel = timestampValue
          ? new Date(Number(timestampValue)).toLocaleString()
          : "N/A";
        console.log(`   Timestamp: ${timestampLabel}`);
        console.log(`   Datetime: ${trade.datetime}`);
        console.log(`   Taker/Maker: ${trade.takerOrMaker || "N/A"}`);

        // Show any additional info
        if (trade.info) {
          console.log(
            `   Additional Info Keys: ${Object.keys(trade.info).join(", ")}`,
          );
        }
      });
    }

    // Fetch open orders
    console.log("\n\n📂 Fetching open orders...");
    const openOrders = await exchange.fetchOpenOrders();
    console.log(`Found ${openOrders.length} open orders`);

    if (openOrders.length > 0) {
      console.log("\n🔬 RAW ORDER STRUCTURE (First Order):");
      console.log("=====================================");
      console.log(JSON.stringify(openOrders[0], null, 2));
    }

    // Fetch positions if available
    console.log("\n\n📍 Checking if positions endpoint is available...");
    if (exchange.has["fetchPositions"]) {
      const positions = await exchange.fetchPositions();
      console.log(`Found ${positions.length} open positions`);

      if (positions.length > 0) {
        console.log("\n🔬 RAW POSITION STRUCTURE (First Position):");
        console.log("==========================================");
        console.log(JSON.stringify(positions[0], null, 2));
      }
    } else {
      console.log("❌ Positions endpoint not available");
    }

    // Show available methods
    console.log("\n\n🛠️ AVAILABLE CCXT METHODS FOR HYPERLIQUID:");
    console.log("==========================================");
    const methods = [
      "fetchTrades",
      "fetchMyTrades",
      "fetchOrders",
      "fetchOpenOrders",
      "fetchClosedOrders",
      "fetchOrder",
      "fetchPositions",
      "fetchBalance",
      "fetchTicker",
      "fetchTickers",
      "fetchOHLCV",
      "fetchOrderBook",
    ];

    methods.forEach((method) => {
      const hasMethod = exchange.has[method];
      console.log(`${hasMethod ? "✅" : "❌"} ${method}: ${hasMethod}`);
    });

    // Show exchange info
    console.log("\n\n📝 EXCHANGE INFO:");
    console.log("=================");
    console.log(`Name: ${exchange.name}`);
    console.log(`Version: ${exchange.version}`);
    console.log(`Rate Limit: ${exchange.rateLimit}ms`);
    console.log(
      `Timeframes: ${exchange.timeframes ? Object.keys(exchange.timeframes).join(", ") : "N/A"}`,
    );
  } catch (error) {
    console.error("❌ Error inspecting Hyperliquid API:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

await inspectHyperliquidAPI();
