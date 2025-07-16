export interface ApiKey {
  exchange: string; //exchange name
  apiKey: string;
  apiSecret: string;
  walletAddress?: string;
  password?: string;
}

export interface ApiKeys {
  [exchangeId: string]: ApiKey;
}
