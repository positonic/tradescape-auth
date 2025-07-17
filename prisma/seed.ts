#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fetchCoinsFromCoinGecko() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=1000&page=1&sparkline=false'
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.map((coin: any) => ({
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      imageUrl: coin.image,
      coinId: coin.id
    }));
  } catch (error) {
    console.error('Error fetching from CoinGecko:', error);
    return [];
  }
}

async function main() {
  console.log('🌱 Start seeding ...')

  // Fetch coins from CoinGecko
  console.log('Fetching coins from CoinGecko...')
  const coins = await fetchCoinsFromCoinGecko()
  
  if (coins.length === 0) {
    console.log('No coins fetched from CoinGecko, using fallback data...')
    // Fallback to static data if API fails
    coins.push(...[
      {
        name: 'Bitcoin',
        symbol: 'BTC',
        imageUrl: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
        coinId: 'bitcoin'
      },
      {
        name: 'Ethereum',
        symbol: 'ETH',
        imageUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        coinId: 'ethereum'
      },
      {
        name: 'Solana',
        symbol: 'SOL',
        imageUrl: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
        coinId: 'solana'
      },
      {
        name: 'BNB',
        symbol: 'BNB',
        imageUrl: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
        coinId: 'binancecoin'
      },
      {
        name: 'XRP',
        symbol: 'XRP',
        imageUrl: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
        coinId: 'ripple'
      },
      {
        name: 'Cardano',
        symbol: 'ADA',
        imageUrl: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
        coinId: 'cardano'
      },
      {
        name: 'Avalanche',
        symbol: 'AVAX',
        imageUrl: 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
        coinId: 'avalanche-2'
      }
    ])
  }

  // Create coins
  console.log(`Creating ${coins.length} coins...`)
  for (const coin of coins) {
    try {
      const result = await prisma.coin.upsert({
        where: { coinId: coin.coinId },
        update: coin,
        create: coin,
      })
      console.log(`Created/Updated coin ${result.name} with id: ${result.id}`)
    } catch (error) {
      console.error(`Failed to create/update coin ${coin.name}:`, error)
    }
  }

  // Create exchanges
  console.log('📈 Creating exchanges...')
  const exchanges = [
    { name: 'binance' },
    { name: 'coinbase' },
    { name: 'kraken' },
    { name: 'kucoin' },
    { name: 'bybit' },
    { name: 'okx' },
    { name: 'hyperliquid' }
  ]

  for (const exchange of exchanges) {
    try {
      const result = await prisma.exchange.upsert({
        where: { name: exchange.name },
        update: exchange,
        create: exchange,
      })
      console.log(`✅ Created/Updated exchange ${result.name} with id: ${result.id}`)
    } catch (error) {
      console.error(`❌ Failed to create/update exchange ${exchange.name}:`, error)
    }
  }

  // Create trading pairs based on the screenshot
  console.log('💱 Creating trading pairs...')
  const tradingPairs = [
    'BTCUSDT',
    'POPCAT/USDT',
    'DOGE/USDT',
    'GOAT/USDT',
    'MOVE/USDT',
    'PENGU/USDT',
    'XRP/USDT',
    'ZEREBRO/USDT',
    'HFUN/USDC',
    'HYPE/USDC',
    'LICK/USDC',
    'PANDA/USDC',
    'PURR/USDC',
    'VAULT/USDC',
    'ALGO/USDT',
    'SUI/USDT',
    'HBARUSDT',
    'AIXBT/USDC:USDC',
    'FARTCOIN/USDC:USDC',
    'HYPE/USDC:USDC',
    'TRUMP/USDC:USDC',
    // Add common pairs
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT',
    'BNB/USDT',
    'ADA/USDT',
    'AVAX/USDT',
    'DOT/USDT',
    'MATIC/USDT'
  ]

  for (const pairSymbol of tradingPairs) {
    try {
      const result = await prisma.pair.upsert({
        where: { symbol: pairSymbol },
        update: { symbol: pairSymbol },
        create: { symbol: pairSymbol },
      })
      console.log(`✅ Created/Updated pair ${result.symbol} with id: ${result.id}`)
    } catch (error) {
      console.error(`❌ Failed to create/update pair ${pairSymbol}:`, error)
    }
  }

  // Create some sample UserPair associations (you'll need to replace 'sample-user-id' with actual user ID)
  console.log('👤 Creating sample UserPair associations...')
  const sampleUserId = 'sample-user-id' // Replace with actual user ID when testing
  
  // Skip UserPair creation for now since we don't have a real user ID
  console.log('⚠️  Skipping UserPair creation - replace sampleUserId with actual user ID for testing')

  console.log('\n📊 Seeding Summary:')
  console.log(`✅ Created ${coins.length} coins`)
  console.log(`✅ Created ${exchanges.length} exchanges`)
  console.log(`✅ Created ${tradingPairs.length} trading pairs`)
  console.log('🎉 Seeding finished successfully!')
}

await main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  }) 