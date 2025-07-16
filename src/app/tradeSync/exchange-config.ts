export interface ExchangeConfiguration {
  id: string;
  name: string;
  label: string;
  ccxtId: string;
  enabled: boolean;
  fetchConfig?: {
    defaultType?: string;
    type?: string[];
  };
  requiredCredentials: {
    apiKey: boolean;
    secret: boolean;
    walletAddress?: boolean;
  };
  defaultPairs: string[];
}

export function getExchangeFetchConfig(exchange: string) {
  return exchanges.find((ex) => ex.id === exchange)?.fetchConfig || {};
}

export const exchanges: ExchangeConfiguration[] = [
  {
    id: 'binance',
    name: 'Binance',
    label: 'Binance',
    ccxtId: 'binance',
    enabled: true,
    fetchConfig: {},
    requiredCredentials: {
      apiKey: true,
      secret: true,
    },
    defaultPairs: [
      'DOT/USDT',
      'COTI/USD',
      'JUP/USDT',
      'INJ/USDT',
      'ALGO/USDT',
      'AGIX/USDT',
      'ATOM/USDT',
      'FIL/USDT',
    ],
  },
  {
    id: 'okx',
    name: 'Okx',
    label: 'Okx',
    ccxtId: 'myokx',
    enabled: true,
    fetchConfig: {},
    requiredCredentials: {
      apiKey: true,
      secret: true,
    },
    defaultPairs: [],
  },
  {
    id: 'kucoin',
    name: 'Kucoin',
    label: 'Kucoin',
    ccxtId: 'kucoin',
    enabled: true,
    fetchConfig: {},
    requiredCredentials: {
      apiKey: true,
      secret: true,
    },
    defaultPairs: [],
  },
  {
    id: 'bybit',
    name: 'Bybit',
    label: 'Bybit',
    ccxtId: 'bybit',
    enabled: true,
    fetchConfig: { defaultType: 'spot' },
    requiredCredentials: {
      apiKey: true,
      secret: true,
    },
    defaultPairs: [],
  },
  {
    id: 'kraken',
    name: 'Kraken',
    label: 'Kraken',
    ccxtId: 'kraken',
    enabled: true,
    fetchConfig: {},
    requiredCredentials: {
      apiKey: true,
      secret: true,
    },
    defaultPairs: ['BTC/USDT', 'OP/USD', 'LINK/USD'],
  },
  {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    label: 'Hyperliquid',
    ccxtId: 'hyperliquid',
    enabled: true,
    fetchConfig: { type: ['spot', 'swap'] },
    requiredCredentials: {
      apiKey: true,
      secret: true,
      walletAddress: true,
    },
    defaultPairs: [],
  },
];

// Helper functions
export const getEnabledExchanges = () => exchanges.filter((ex) => ex.enabled);

export const getExchangeById = (id: string) =>
  exchanges.find((ex) => ex.id === id);

export const getExchangeSelectOptions = () => [
  { value: 'All', label: 'All' },
  ...getEnabledExchanges().map((ex) => ({ value: ex.id, label: ex.label })),
];
