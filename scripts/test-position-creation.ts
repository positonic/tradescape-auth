#!/usr/bin/env bun

import { EnhancedPositionAggregator } from "../src/app/tradeSync/aggregation/EnhancedPositionAggregator.js";
import type { Order } from "../src/app/tradeSync/interfaces/Order.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Sample order data for testing different scenarios
/* COMMENTED OUT - Using real data instead
const sampleOrders: Order[] = [
  // Scenario 1: Simple buy-sell pair (should create 1 position)
  {
    id: 1,
    ordertxid: "order-1",
    time: 1700000000000,
    date: new Date(1700000000000),
    type: "buy",
    direction: "Open Long",
    pair: "BTC/USDT",
    amount: 1.0,
    highestPrice: 50000,
    lowestPrice: 50000,
    averagePrice: 50000,
    totalCost: 50000,
    exchange: "binance",
    trades: [],
    fee: 25,
    closedPnL: 0,
  },
  {
    id: 2,
    ordertxid: "order-2", 
    time: 1700001000000,
    date: new Date(1700001000000),
    type: "sell",
    direction: "Close Long",
    pair: "BTC/USDT",
    amount: 1.0,
    highestPrice: 51000,
    lowestPrice: 51000,
    averagePrice: 51000,
    totalCost: 51000,
    exchange: "binance",
    trades: [],
    fee: 25.5,
    closedPnL: 950,
  },

  // Scenario 2: DCA strategy (multiple buys, then sell)
  {
    id: 3,
    ordertxid: "order-3",
    time: 1700002000000,
    date: new Date(1700002000000),
    type: "buy",
    direction: "Open Long",
    pair: "ETH/USDT",
    amount: 2.0,
    highestPrice: 3000,
    lowestPrice: 3000,
    averagePrice: 3000,
    totalCost: 6000,
    exchange: "binance",
    trades: [],
    fee: 3,
    closedPnL: 0,
  },
  {
    id: 4,
    ordertxid: "order-4",
    time: 1700003000000,
    date: new Date(1700003000000),
    type: "buy",
    direction: "Add Long", 
    pair: "ETH/USDT",
    amount: 1.0,
    highestPrice: 2900,
    lowestPrice: 2900,
    averagePrice: 2900,
    totalCost: 2900,
    exchange: "binance",
    trades: [],
    fee: 1.45,
    closedPnL: 0,
  },
  {
    id: 5,
    ordertxid: "order-5",
    time: 1700004000000,
    date: new Date(1700004000000),
    type: "sell",
    direction: "Close Long",
    pair: "ETH/USDT", 
    amount: 3.0,
    highestPrice: 3100,
    lowestPrice: 3100,
    averagePrice: 3100,
    totalCost: 9300,
    exchange: "binance",
    trades: [],
    fee: 4.65,
    closedPnL: 390,
  },

  // Scenario 3: Partial position (buy only, no matching sell)
  {
    id: 6,
    ordertxid: "order-6",
    time: 1700005000000,
    date: new Date(1700005000000),
    type: "buy",
    direction: "Open Long",
    pair: "ADA/USDT",
    amount: 1000,
    highestPrice: 0.5,
    lowestPrice: 0.5,
    averagePrice: 0.5,
    totalCost: 500,
    exchange: "binance",
    trades: [],
    fee: 0.25,
    closedPnL: 0,
  },

  // Scenario 4: Unbalanced volumes (should test threshold logic)
  {
    id: 7,
    ordertxid: "order-7",
    time: 1700006000000,
    date: new Date(1700006000000),
    type: "buy",
    direction: "Open Long",
    pair: "SOL/USDT",
    amount: 10.0,
    highestPrice: 100,
    lowestPrice: 100,
    averagePrice: 100,
    totalCost: 1000,
    exchange: "binance",
    trades: [],
    fee: 0.5,
    closedPnL: 0,
  },
  {
    id: 8,
    ordertxid: "order-8",
    time: 1700007000000,
    date: new Date(1700007000000),
    type: "sell",
    direction: "Close Long",
    pair: "SOL/USDT",
    amount: 9.5, // Slightly unbalanced (5% difference)
    highestPrice: 105,
    lowestPrice: 105,
    averagePrice: 105,
    totalCost: 997.5,
    exchange: "binance",
    trades: [],
    fee: 0.5,
    closedPnL: -3,
  },
];
*/

async function fetchRealOrders(
  pair: string = "UNI/USDC:USDC",
): Promise<Order[]> {
  console.log(`🔍 Fetching orders for pair: ${pair}`);

  try {
    const dbOrders = await prisma.order.findMany({
      where: {
        pair: pair,
      },
      orderBy: {
        time: "asc",
      },
      include: {
        trades: true,
      },
    });

    console.log(`📦 Found ${dbOrders.length} orders in database`);

    // Convert DB orders to our Order interface
    const orders: Order[] = dbOrders.map((dbOrder) => ({
      id: dbOrder.id,
      ordertxid: dbOrder.ordertxid ?? `order-${dbOrder.id}`,
      time: Number(dbOrder.time),
      date: new Date(Number(dbOrder.time)),
      type: dbOrder.type as "buy" | "sell",
      direction: dbOrder.direction ?? undefined,
      pair: dbOrder.pair,
      amount: Number(dbOrder.amount),
      highestPrice: Number(dbOrder.highestPrice),
      lowestPrice: Number(dbOrder.lowestPrice),
      averagePrice: Number(dbOrder.averagePrice),
      totalCost: Number(dbOrder.totalCost),
      exchange: dbOrder.exchange,
      trades:
        dbOrder.trades?.map((trade) => ({
          id: trade.id?.toString() ?? "",
          tradeId: trade.tradeId ?? "",
          ordertxid: trade.ordertxid ?? "",
          pair: trade.pair,
          time: Number(trade.time),
          type: trade.type as "buy" | "sell",
          ordertype: trade.ordertype ?? "",
          price: trade.price,
          cost: trade.cost ?? "0",
          fee: trade.fee ?? "0",
          vol: Number(trade.vol),
          margin: trade.margin ?? "0",
          leverage: trade.leverage ?? "0",
          misc: trade.misc ?? "",
          exchange: trade.exchange,
          date:
            trade.time !== null && trade.time !== undefined
              ? new Date(Number(trade.time))
              : undefined,
          closedPnL: Number(trade.closedPnL ?? 0),
          direction: trade.direction ?? undefined,
          transactionId: trade.transactionId ?? undefined,
        })) ?? [],
      fee: Number(dbOrder.fee),
      closedPnL: Number(dbOrder.closedPnL ?? 0),
    }));

    // Output the raw data for copying
    console.log("\n📋 RAW ORDER DATA (copy this for hardcoding):");
    console.log("=".repeat(60));
    console.log(
      "const realOrders: Order[] = " + JSON.stringify(orders, null, 2) + ";",
    );
    console.log("=".repeat(60));

    return orders;
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    return [];
  }
}

async function testPositionCreation() {
  console.log("🧪 Testing Position Creation Logic");
  console.log("=".repeat(50));

  // Fetch real orders
  //const realOrders = await fetchRealOrders("UNI/USDC:USDC");
  const realOrders: Order[] = [
    {
      id: 1766,
      ordertxid: "87513745321",
      time: 1745195419788,
      type: "buy",
      direction: "Close Short",
      pair: "UNI/USDC:USDC",
      amount: 153,
      highestPrice: 5.3703,
      lowestPrice: 5.3687,
      averagePrice: 5.369835686274509,
      totalCost: 821.5848599999999,
      exchange: "Hyperliquid",
      trades: [
        {
          id: "6653",
          tradeId: "583626178087527",
          ordertxid: "87513745321",
          pair: "UNI/USDC:USDC",
          time: 1745195419788,
          type: "buy",
          ordertype: "undefined",
          price: "5.3703",
          cost: "583.21458",
          fee: "0.204125",
          vol: 108.6,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -9.188646,
          direction: "Close Short",
          transactionId:
            "0x7f014ee853c0d6ca8dce0421efe935013300ba4f7bd52082310e3558cb571c88",
        },
        {
          id: "6654",
          tradeId: "938908202226511",
          ordertxid: "87513745321",
          pair: "UNI/USDC:USDC",
          time: 1745195419788,
          type: "buy",
          ordertype: "undefined",
          price: "5.3687",
          cost: "238.37028",
          fee: "0.083429",
          vol: 44.4,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -3.685644,
          direction: "Close Short",
          transactionId:
            "0x7f014ee853c0d6ca8dce0421efe935013300ba4f7bd52082310e3558cb571c88",
        },
      ],
      fee: 0.287554,
      closedPnL: -12.87429,
    },
    {
      id: 1183,
      ordertxid: "106298736960",
      time: 1750884972680,
      type: "buy",
      direction: "Open Long",
      pair: "UNI/USDC:USDC",
      amount: 28.4,
      highestPrice: 7.0378,
      lowestPrice: 7.0378,
      averagePrice: 7.0378,
      totalCost: 199.87352,
      exchange: "Hyperliquid",
      trades: [
        {
          id: "6652",
          tradeId: "1029647171966920",
          ordertxid: "106298736960",
          pair: "UNI/USDC:USDC",
          time: 1750884972680,
          type: "buy",
          ordertype: "undefined",
          price: "7.0378",
          cost: "199.87352",
          fee: "0.089943",
          vol: 28.4,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0x4933538c4667a25d7e7204263c683e020cde00091661e93e4f07d6c37ecc6e3d",
        },
      ],
      fee: 0.089943,
      closedPnL: 0,
    },
    {
      id: 1182,
      ordertxid: "106298904359",
      time: 1750885011611,
      type: "buy",
      direction: "Open Long",
      pair: "UNI/USDC:USDC",
      amount: 56.8,
      highestPrice: 7.0379,
      lowestPrice: 7.0379,
      averagePrice: 7.0379,
      totalCost: 399.75272,
      exchange: "Hyperliquid",
      trades: [
        {
          id: "6651",
          tradeId: "231739836726320",
          ordertxid: "106298904359",
          pair: "UNI/USDC:USDC",
          time: 1750885011611,
          type: "buy",
          ordertype: "undefined",
          price: "7.0379",
          cost: "399.75272",
          fee: "0.179888",
          vol: 56.8,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0x3f70f0bfc4b8e57548b204263c6a2701c800d296a4380dcdf28d702e72230709",
        },
      ],
      fee: 0.179888,
      closedPnL: 0,
    },
    {
      id: 1174,
      ordertxid: "106778062194",
      time: 1751010944136,
      type: "sell",
      direction: "Close Long",
      pair: "UNI/USDC:USDC",
      amount: 85.2,
      highestPrice: 6.8544,
      lowestPrice: 6.8544,
      averagePrice: 6.8544,
      totalCost: 583.9948800000001,
      exchange: "Hyperliquid",
      trades: [
        {
          id: "6650",
          tradeId: "257756349846226",
          ordertxid: "106778062194",
          pair: "UNI/USDC:USDC",
          time: 1751010944136,
          type: "sell",
          ordertype: "undefined",
          price: "6.8544",
          cost: "583.99488",
          fee: "0.262797",
          vol: 85.2,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -15.630792,
          direction: "Close Long",
          transactionId:
            "0x864d8683fe38308303b804265543310202e10077108f98cbf7abd3f6241fa556",
        },
      ],
      fee: 0.262797,
      closedPnL: -15.630792,
    },
    {
      id: 1154,
      ordertxid: "108018418219",
      time: 1751377783064,
      type: "buy",
      direction: "Open Long",
      pair: "UNI/USDC:USDC",
      amount: 143.1,
      highestPrice: 6.9936,
      lowestPrice: 6.9936,
      averagePrice: 6.9936,
      totalCost: 1000.78416,
      exchange: "Hyperliquid",
      trades: [
        {
          id: "6648",
          tradeId: "134112808038177",
          ordertxid: "108018418219",
          pair: "UNI/USDC:USDC",
          time: 1751377783064,
          type: "buy",
          ordertype: "undefined",
          price: "6.9936",
          cost: "391.6416",
          fee: "0.176238",
          vol: 56,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0x111d08b00f866d2cb91604269d3f440201a20018d25f160f8110a1b03c06d987",
        },
        {
          id: "6649",
          tradeId: "301577781645230",
          ordertxid: "108018418219",
          pair: "UNI/USDC:USDC",
          time: 1751377783064,
          type: "buy",
          ordertype: "undefined",
          price: "6.9936",
          cost: "609.14256",
          fee: "0.274114",
          vol: 87.1,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0x111d08b00f866d2cb91604269d3f440201a20018d25f160f8110a1b03c06d987",
        },
      ],
      fee: 0.450352,
      closedPnL: 0,
    },
    {
      id: 1153,
      ordertxid: "108022146039",
      time: 1751378453291,
      type: "buy",
      direction: "Open Long",
      pair: "UNI/USDC:USDC",
      amount: 428.9,
      highestPrice: 6.9984,
      lowestPrice: 6.9964,
      averagePrice: 6.998047843320121,
      totalCost: 3001.46272,
      exchange: "Hyperliquid",
      trades: [
        {
          id: "6644",
          tradeId: "1073319745141137",
          ordertxid: "108022146039",
          pair: "UNI/USDC:USDC",
          time: 1751378453291,
          type: "buy",
          ordertype: "undefined",
          price: "6.9978",
          cost: "592.01388",
          fee: "0.266406",
          vol: 84.6,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0xe703d260c336448cd87304269d615101b30023775d6adcd8840142a3b8998e90",
        },
        {
          id: "6645",
          tradeId: "447558101673938",
          ordertxid: "108022146039",
          pair: "UNI/USDC:USDC",
          time: 1751378453291,
          type: "buy",
          ordertype: "undefined",
          price: "6.9964",
          cost: "181.20676",
          fee: "0.081543",
          vol: 25.9,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0xe703d260c336448cd87304269d615101b30023775d6adcd8840142a3b8998e90",
        },
        {
          id: "6646",
          tradeId: "828031450146747",
          ordertxid: "108022146039",
          pair: "UNI/USDC:USDC",
          time: 1751378453291,
          type: "buy",
          ordertype: "undefined",
          price: "6.9984",
          cost: "1662.81984",
          fee: "0.748268",
          vol: 237.6,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0xe703d260c336448cd87304269d615101b30023775d6adcd8840142a3b8998e90",
        },
        {
          id: "6647",
          tradeId: "98264605496628",
          ordertxid: "108022146039",
          pair: "UNI/USDC:USDC",
          time: 1751378453291,
          type: "buy",
          ordertype: "undefined",
          price: "6.9978",
          cost: "565.42224",
          fee: "0.25444",
          vol: 80.8,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0xe703d260c336448cd87304269d615101b30023775d6adcd8840142a3b8998e90",
        },
      ],
      fee: 1.350657,
      closedPnL: 0,
    },
    {
      id: 1162,
      ordertxid: "108022222894",
      time: 1751380104516,
      type: "sell",
      direction: "Close Long",
      pair: "UNI/USDC:USDC",
      amount: 572,
      highestPrice: 6.9331,
      lowestPrice: 6.9306,
      averagePrice: 6.931632972027971,
      totalCost: 3964.89406,
      exchange: "Hyperliquid",
      trades: [
        {
          id: "6638",
          tradeId: "1013745054815963",
          ordertxid: "108022222894",
          pair: "UNI/USDC:USDC",
          time: 1751380104516,
          type: "sell",
          ordertype: "undefined",
          price: "6.932",
          cost: "88.0364",
          fee: "0.039616",
          vol: 12.7,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -0.824611,
          direction: "Close Long",
          transactionId:
            "0x80605f8e2fb8f41193ba04269db439000023995a899df7ae8284fe7f29b684ad",
        },
        {
          id: "6639",
          tradeId: "414612934049347",
          ordertxid: "108022222894",
          pair: "UNI/USDC:USDC",
          time: 1751380104516,
          type: "sell",
          ordertype: "undefined",
          price: "6.9331",
          cost: "656.56457",
          fee: "0.295454",
          vol: 94.7,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -6.044701,
          direction: "Close Long",
          transactionId:
            "0x80605f8e2fb8f41193ba04269db439000023995a899df7ae8284fe7f29b684ad",
        },
        {
          id: "6640",
          tradeId: "899926112657727",
          ordertxid: "108022222894",
          pair: "UNI/USDC:USDC",
          time: 1751380104516,
          type: "sell",
          ordertype: "undefined",
          price: "6.9328",
          cost: "109.53824",
          fee: "0.049292",
          vol: 15.8,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -1.013254,
          direction: "Close Long",
          transactionId:
            "0x80605f8e2fb8f41193ba04269db439000023995a899df7ae8284fe7f29b684ad",
        },
        {
          id: "6641",
          tradeId: "956576294823974",
          ordertxid: "108022222894",
          pair: "UNI/USDC:USDC",
          time: 1751380104516,
          type: "sell",
          ordertype: "undefined",
          price: "6.9321",
          cost: "639.83283",
          fee: "0.287924",
          vol: 92.3,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -5.983809,
          direction: "Close Long",
          transactionId:
            "0x80605f8e2fb8f41193ba04269db439000023995a899df7ae8284fe7f29b684ad",
        },
        {
          id: "6642",
          tradeId: "96301802552810",
          ordertxid: "108022222894",
          pair: "UNI/USDC:USDC",
          time: 1751380104516,
          type: "sell",
          ordertype: "undefined",
          price: "6.9306",
          cost: "1057.60956",
          fee: "0.475924",
          vol: 152.6,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -10.121958,
          direction: "Close Long",
          transactionId:
            "0x80605f8e2fb8f41193ba04269db439000023995a899df7ae8284fe7f29b684ad",
        },
        {
          id: "6643",
          tradeId: "970553960093548",
          ordertxid: "108022222894",
          pair: "UNI/USDC:USDC",
          time: 1751380104516,
          type: "sell",
          ordertype: "undefined",
          price: "6.9314",
          cost: "1413.31246",
          fee: "0.63599",
          vol: 203.9,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -13.361567,
          direction: "Close Long",
          transactionId:
            "0x80605f8e2fb8f41193ba04269db439000023995a899df7ae8284fe7f29b684ad",
        },
      ],
      fee: 1.7842,
      closedPnL: -37.3499,
    },
    {
      id: 931,
      ordertxid: "114876142969",
      time: 1752681696894,
      type: "buy",
      direction: "Open Long",
      pair: "UNI/USDC:USDC",
      amount: 224.3,
      highestPrice: 8.914,
      lowestPrice: 8.914,
      averagePrice: 8.914,
      totalCost: 1999.4102,
      exchange: "Hyperliquid",
      trades: [
        {
          id: "6635",
          tradeId: "11441936167045",
          ordertxid: "114876142969",
          pair: "UNI/USDC:USDC",
          time: 1752681696894,
          type: "buy",
          ordertype: "undefined",
          price: "8.914",
          cost: "1043.8294",
          fee: "0.156574",
          vol: 117.1,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0x3c7c54fdaaf8cffc00f304279fb02a02091500e3c6ff63ad72cda64ceb5dd5e1",
        },
        {
          id: "6636",
          tradeId: "714106623967658",
          ordertxid: "114876142969",
          pair: "UNI/USDC:USDC",
          time: 1752681696894,
          type: "buy",
          ordertype: "undefined",
          price: "8.914",
          cost: "673.007",
          fee: "0.100951",
          vol: 75.5,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0xdf4333b697f9ec9a720c04279fb02a02095b00bb74f58cfc8e088f0007fb7888",
        },
        {
          id: "6637",
          tradeId: "830590278040562",
          ordertxid: "114876142969",
          pair: "UNI/USDC:USDC",
          time: 1752681681160,
          type: "buy",
          ordertype: "undefined",
          price: "8.914",
          cost: "282.5738",
          fee: "0.042386",
          vol: 31.7,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0xc7f5b81bb3574e9d2c3804279faf6d00006cc28694025152cb10849857b7e3be",
        },
      ],
      fee: 0.299911,
      closedPnL: 0,
    },
    {
      id: 887,
      ordertxid: "115182783327",
      time: 1752783647698,
      type: "sell",
      direction: "Close Long",
      pair: "UNI/USDC:USDC",
      amount: 224.3,
      highestPrice: 8.6535,
      lowestPrice: 8.6511,
      averagePrice: 8.652658314757021,
      totalCost: 1940.79126,
      exchange: "Hyperliquid",
      trades: [
        {
          id: "6629",
          tradeId: "437504288131305",
          ordertxid: "115182783327",
          pair: "UNI/USDC:USDC",
          time: 1752783647698,
          type: "sell",
          ordertype: "undefined",
          price: "8.6535",
          cost: "404.9838",
          fee: "0.182242",
          vol: 46.8,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -12.1914,
          direction: "Close Long",
          transactionId:
            "0xe8258142846804c024c60427b376160000915ccbf72cd060503996fecd83c5d1",
        },
        {
          id: "6630",
          tradeId: "522862215827388",
          ordertxid: "115182783327",
          pair: "UNI/USDC:USDC",
          time: 1752783647698,
          type: "sell",
          ordertype: "undefined",
          price: "8.6511",
          cost: "472.35006",
          fee: "0.212557",
          vol: 54.6,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -14.35434,
          direction: "Close Long",
          transactionId:
            "0xe8258142846804c024c60427b376160000915ccbf72cd060503996fecd83c5d1",
        },
        {
          id: "6631",
          tradeId: "730109301142226",
          ordertxid: "115182783327",
          pair: "UNI/USDC:USDC",
          time: 1752783647698,
          type: "sell",
          ordertype: "undefined",
          price: "8.6531",
          cost: "406.6957",
          fee: "0.183013",
          vol: 47,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -12.2623,
          direction: "Close Long",
          transactionId:
            "0xe8258142846804c024c60427b376160000915ccbf72cd060503996fecd83c5d1",
        },
        {
          id: "6632",
          tradeId: "879874479751986",
          ordertxid: "115182783327",
          pair: "UNI/USDC:USDC",
          time: 1752783647698,
          type: "sell",
          ordertype: "undefined",
          price: "8.653",
          cost: "229.3045",
          fee: "0.103187",
          vol: 26.5,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -6.9165,
          direction: "Close Long",
          transactionId:
            "0xe8258142846804c024c60427b376160000915ccbf72cd060503996fecd83c5d1",
        },
        {
          id: "6633",
          tradeId: "910809506357629",
          ordertxid: "115182783327",
          pair: "UNI/USDC:USDC",
          time: 1752783647698,
          type: "sell",
          ordertype: "undefined",
          price: "8.653",
          cost: "340.9282",
          fee: "0.153417",
          vol: 39.4,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -10.2834,
          direction: "Close Long",
          transactionId:
            "0xe8258142846804c024c60427b376160000915ccbf72cd060503996fecd83c5d1",
        },
        {
          id: "6634",
          tradeId: "97489022633405",
          ordertxid: "115182783327",
          pair: "UNI/USDC:USDC",
          time: 1752783647698,
          type: "sell",
          ordertype: "undefined",
          price: "8.6529",
          cost: "86.529",
          fee: "0.038938",
          vol: 10,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: -2.611,
          direction: "Close Long",
          transactionId:
            "0xe8258142846804c024c60427b376160000915ccbf72cd060503996fecd83c5d1",
        },
      ],
      fee: 0.8733540000000001,
      closedPnL: -58.61894,
    },
    {
      id: 859,
      ordertxid: "116468877771",
      time: 1752849842156,
      type: "buy",
      direction: "Open Long",
      pair: "UNI/USDC:USDC",
      amount: 290,
      highestPrice: 10.35,
      lowestPrice: 10.35,
      averagePrice: 10.35,
      totalCost: 3001.5,
      exchange: "Hyperliquid",
      trades: [
        {
          id: "6627",
          tradeId: "456224419134047",
          ordertxid: "116468877771",
          pair: "UNI/USDC:USDC",
          time: 1752849842156,
          type: "buy",
          ordertype: "undefined",
          price: "10.35",
          cost: "2031.705",
          fee: "0.914267",
          vol: 196.3,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0x6ad49905d5883a0bf8010427c02fb6020531009fcad2aba90f1c9bfb6d56473a",
        },
        {
          id: "6628",
          tradeId: "701862900078717",
          ordertxid: "116468877771",
          pair: "UNI/USDC:USDC",
          time: 1752849842156,
          type: "buy",
          ordertype: "undefined",
          price: "10.35",
          cost: "969.795",
          fee: "0.436407",
          vol: 93.7,
          margin: "0",
          leverage: "0",
          misc: "",
          exchange: "Hyperliquid",
          closedPnL: 0,
          direction: "Open Long",
          transactionId:
            "0x6ad49905d5883a0bf8010427c02fb6020531009fcad2aba90f1c9bfb6d56473a",
        },
      ],
      fee: 1.350674,
      closedPnL: 0,
    },
  ];

  if (realOrders.length === 0) {
    console.log("❌ No orders found! Cannot test position creation.");
    return;
  }

  // Test different strategies
  const strategies = [
    "conservative",
    "aggressive",
    "dca",
    "positionByDirection",
  ] as const;

  strategies.forEach((strategy) => {
    console.log(`\n📊 Testing ${strategy.toUpperCase()} strategy:`);
    console.log("-".repeat(30));

    const aggregator = EnhancedPositionAggregator.createForStrategy(strategy);
    const positions = aggregator.aggregate(realOrders);

    console.log(`✅ Created ${positions.length} positions`);

    positions.forEach((position, index) => {
      console.log(`\nPosition ${index + 1}:`);
      console.log(`  📈 Pair: ${position.pair}`);
      console.log(`  🔄 Type: ${position.type}`);
      console.log(`  💰 P&L: $${position.profitLoss?.toFixed(2) || "N/A"}`);
      console.log(`  📦 Orders: ${position.orders?.length || 0}`);
      console.log(`  🎯 Quantity: ${position.quantity}`);
      console.log(`  💵 Buy Cost: $${position.buyCost?.toFixed(2) || "N/A"}`);
      console.log(`  💸 Sell Cost: $${position.sellCost?.toFixed(2) || "N/A"}`);
      console.log(
        `  ⏱️  Duration: ${position.duration ? Math.round(position.duration / 1000 / 60) : "N/A"} minutes`,
      );

      // Show order details
      if (position.orders && position.orders.length > 0) {
        console.log(`  📋 Order breakdown:`);
        position.orders.forEach((order) => {
          console.log(
            `    - ${order.type} ${order.amount} at $${order.averagePrice} (${order.direction || "N/A"})`,
          );
        });
      }
    });
  });

  // Test edge cases
  console.log("\n🔍 Testing Edge Cases:");
  console.log("-".repeat(30));

  // Empty orders
  const emptyResult = new EnhancedPositionAggregator().aggregate([]);
  console.log(`📭 Empty orders → ${emptyResult.length} positions`);

  // Single order
  if (realOrders.length > 0) {
    const firstOrder = realOrders[0];
    if (firstOrder) {
      const singleOrderResult = new EnhancedPositionAggregator().aggregate([
        firstOrder,
      ]);
      console.log(`📦 Single order → ${singleOrderResult.length} positions`);
    }
  }

  // Different pairs mixed
  const mixedPairsResult = new EnhancedPositionAggregator().aggregate(
    realOrders,
  );
  const pairCounts = mixedPairsResult.reduce(
    (acc, pos) => {
      acc[pos.pair] = (acc[pos.pair] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log(`🔀 Mixed pairs → positions per pair:`, pairCounts);
}

async function analyzeCurrentIssues() {
  console.log("\n🐛 Analyzing Current Issues:");
  console.log("=".repeat(50));

  // Fetch real orders for analysis
  const realOrders = await fetchRealOrders("UNI/USDC:USDC");

  if (realOrders.length === 0) {
    console.log("❌ No orders found for analysis.");
    return;
  }

  const aggregator = new EnhancedPositionAggregator();
  const positions = aggregator.aggregate(realOrders);

  console.log("\n🔍 Issue Analysis:");

  // Check for direction consistency
  positions.forEach((position, i) => {
    if (position.orders && position.orders.length > 1) {
      const directions = position.orders
        .map((o) => o.direction)
        .filter(Boolean);
      const types = position.orders.map((o) => o.type);

      console.log(`\nPosition ${i + 1} (${position.pair}):`);
      console.log(`  🎯 Position Type: ${position.type}`);
      console.log(`  📊 Order Types: [${types.join(", ")}]`);
      console.log(`  🧭 Directions: [${directions.join(", ")}]`);

      // Check if position type matches order pattern
      const hasOpenLong = directions.some((d) => d?.includes("Open Long"));
      const hasCloseLong = directions.some((d) => d?.includes("Close Long"));

      if (hasOpenLong && hasCloseLong && position.type !== "long") {
        console.log(
          `  ⚠️  Issue: Has Open/Close Long pattern but position type is '${position.type}'`,
        );
      }
    }
  });
}

// Run the tests
async function main() {
  try {
    await testPositionCreation();
    await analyzeCurrentIssues();

    console.log("\n✅ Test completed successfully!");
    console.log(
      "\n💡 To run this script: bun scripts/test-position-creation.ts",
    );
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
