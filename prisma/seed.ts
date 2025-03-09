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
  console.log('Start seeding ...')

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

  // Create some common trading pairs
  console.log('Creating trading pairs...')
  const commonSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'DOT', 'MATIC']
  const pairs = commonSymbols.map(symbol => ({ symbol: `${symbol}/USDT` }))

  for (const pair of pairs) {
    try {
      const result = await prisma.pair.upsert({
        where: { symbol: pair.symbol },
        update: pair,
        create: pair,
      })
      console.log(`Created/Updated pair ${result.symbol} with id: ${result.id}`)
    } catch (error) {
      console.error(`Failed to create/update pair ${pair.symbol}:`, error)
    }
  }

  console.log('Seeding finished')
}

await main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  }) 